import type { ConsoleEntityKind } from './consoleQuery';

export interface SqlCondition {
  field: string;
  op: '=' | '!=' | 'LIKE';
  value: string;
}

/**
 * A boolean tree over WHERE conditions, produced by standard-precedence
 * (AND binds tighter than OR) parsing of `field op value (AND|OR ...)*`,
 * with `(...)` for explicit grouping. A bare condition (no AND/OR) parses
 * straight to a `condition` node rather than a redundant single-term group.
 */
export type SqlWhereExpr =
  | { kind: 'condition'; condition: SqlCondition }
  | { kind: 'and'; terms: SqlWhereExpr[] }
  | { kind: 'or'; terms: SqlWhereExpr[] };

export interface SqlWhere {
  expr: SqlWhereExpr;
}

export type SqlAssignment =
  | { field: 'completed' | 'archived'; op: '='; value: string }
  | { field: 'status'; op: '='; value: string }
  | { field: 'label'; op: '+=' | '-='; value: string };

export interface SqlSelect {
  type: 'select';
  table: ConsoleEntityKind;
  where: SqlWhere | null;
}

export interface SqlUpdate {
  type: 'update';
  table: ConsoleEntityKind;
  assignments: SqlAssignment[];
  where: SqlWhere;
}

export interface SqlDelete {
  type: 'delete';
  table: ConsoleEntityKind;
  where: SqlWhere;
}

export type SqlStatement =
  | SqlSelect
  | SqlUpdate
  | SqlDelete
  | { type: 'begin' }
  | { type: 'commit' }
  | { type: 'rollback' };

export interface SqlParseError {
  error: string;
}

function isParseError(value: unknown): value is SqlParseError {
  return typeof value === 'object' && value !== null && 'error' in value;
}

const KEYWORD_PATTERN = /^(select|update|delete|begin|commit|rollback)\b/i;

export const TABLE_ALIASES: Record<string, ConsoleEntityKind> = {
  task: 'task',
  tasks: 'task',
  container: 'container',
  containers: 'container',
  project: 'project',
  projects: 'project',
  label: 'label',
  labels: 'label',
};

/** True if `input` looks like it's meant to be a SQL-ish statement (starts with a recognized keyword). */
export function looksLikeSql(input: string): boolean {
  return KEYWORD_PATTERN.test(input.trim());
}

export interface Token {
  text: string;
  quoted: boolean;
}

const PUNCTUATION = ['!=', '+=', '-=', '=', ',', '*', '(', ')'];

/** Exported for the SQL autocomplete engine, which needs the same quote-aware tokenization to inspect partial input. */
export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  const n = input.length;
  let i = 0;
  while (i < n) {
    while (i < n && /\s/.test(input[i])) i++;
    if (i >= n) break;

    if (input[i] === '"' || input[i] === "'") {
      const quote = input[i];
      i++;
      const start = i;
      while (i < n && input[i] !== quote) i++;
      tokens.push({ text: input.slice(start, i), quoted: true });
      if (i < n) i++;
      continue;
    }

    const punct = PUNCTUATION.find((p) => input.startsWith(p, i));
    if (punct) {
      tokens.push({ text: punct, quoted: false });
      i += punct.length;
      continue;
    }

    const start = i;
    while (i < n && !/\s/.test(input[i]) && !PUNCTUATION.some((p) => input.startsWith(p, i)) && input[i] !== '"' && input[i] !== "'") {
      i++;
    }
    if (i === start) {
      // Shouldn't happen, but avoid an infinite loop on an unexpected character.
      i++;
      continue;
    }
    tokens.push({ text: input.slice(start, i), quoted: false });
  }
  return tokens;
}

class Cursor {
  private pos = 0;
  constructor(private tokens: Token[]) {}

  peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  next(): Token | undefined {
    return this.tokens[this.pos++];
  }

  atEnd(): boolean {
    return this.pos >= this.tokens.length;
  }

  /** Consumes the next token if it case-insensitively matches `word`, returning whether it did. */
  consumeKeyword(word: string): boolean {
    const tok = this.peek();
    if (tok && !tok.quoted && tok.text.toLowerCase() === word.toLowerCase()) {
      this.pos++;
      return true;
    }
    return false;
  }
}

function parseTable(cursor: Cursor): ConsoleEntityKind | SqlParseError {
  const tok = cursor.next();
  if (!tok) return { error: 'Expected a table name (tasks, containers, projects, or labels).' };
  const table = TABLE_ALIASES[tok.text.toLowerCase()];
  if (!table) return { error: `Unknown table "${tok.text}". Use tasks, containers, projects, or labels.` };
  return table;
}

function parseValue(cursor: Cursor): string | SqlParseError {
  const tok = cursor.next();
  if (!tok) return { error: 'Expected a value.' };
  return tok.text;
}

function parseCondition(cursor: Cursor): SqlCondition | SqlParseError {
  const fieldTok = cursor.next();
  if (!fieldTok) return { error: 'Expected a field name.' };
  const field = fieldTok.text.toLowerCase();

  let op: SqlCondition['op'] | null = null;
  if (cursor.consumeKeyword('!=')) op = '!=';
  else if (cursor.consumeKeyword('LIKE')) op = 'LIKE';
  else if (cursor.consumeKeyword('=')) op = '=';
  if (!op) return { error: `Expected =, !=, or LIKE after "${field}".` };

  const value = parseValue(cursor);
  if (isParseError(value)) return value;

  return { field, op, value };
}

/** `(` orExpr `)` | condition */
function parseAtom(cursor: Cursor): SqlWhereExpr | SqlParseError {
  if (cursor.consumeKeyword('(')) {
    const inner = parseOrExpr(cursor);
    if (isParseError(inner)) return inner;
    if (!cursor.consumeKeyword(')')) return { error: 'Expected a closing ")".' };
    return inner;
  }
  const condition = parseCondition(cursor);
  return isParseError(condition) ? condition : { kind: 'condition', condition };
}

/** atom (AND atom)* — AND binds tighter than OR. */
function parseAndExpr(cursor: Cursor): SqlWhereExpr | SqlParseError {
  const first = parseAtom(cursor);
  if (isParseError(first)) return first;
  const terms = [first];
  while (cursor.consumeKeyword('AND')) {
    const next = parseAtom(cursor);
    if (isParseError(next)) return next;
    terms.push(next);
  }
  return terms.length === 1 ? terms[0] : { kind: 'and', terms };
}

/** andExpr (OR andExpr)* */
function parseOrExpr(cursor: Cursor): SqlWhereExpr | SqlParseError {
  const first = parseAndExpr(cursor);
  if (isParseError(first)) return first;
  const terms = [first];
  while (cursor.consumeKeyword('OR')) {
    const next = parseAndExpr(cursor);
    if (isParseError(next)) return next;
    terms.push(next);
  }
  return terms.length === 1 ? terms[0] : { kind: 'or', terms };
}

function parseWhere(cursor: Cursor): SqlWhere | SqlParseError {
  const expr = parseOrExpr(cursor);
  return isParseError(expr) ? expr : { expr };
}

function parseAssignment(cursor: Cursor): SqlAssignment | SqlParseError {
  const fieldTok = cursor.next();
  if (!fieldTok) return { error: 'Expected a field name after SET.' };
  const field = fieldTok.text.toLowerCase();

  if (field === 'label') {
    let op: '+=' | '-=' | null = null;
    if (cursor.consumeKeyword('+=')) op = '+=';
    else if (cursor.consumeKeyword('-=')) op = '-=';
    else return { error: 'label must be assigned with += or -= (e.g. label += \'urgent\').' };
    const value = parseValue(cursor);
    if (isParseError(value)) return value;
    return { field: 'label', op, value };
  }

  if (field !== 'completed' && field !== 'archived' && field !== 'status') {
    return { error: `Unsupported SET field "${field}". Use completed, archived, status, or label.` };
  }
  if (!cursor.consumeKeyword('=')) return { error: `Expected = after "${field}".` };
  const value = parseValue(cursor);
  if (isParseError(value)) return value;
  return { field, op: '=', value };
}

/**
 * Parses a SQL-ish console statement. Returns null when `input` doesn't
 * start with a recognized keyword at all (so the caller can fall through to
 * the plain query/action console modes); returns a SqlParseError once it
 * commits to SQL but the rest doesn't parse, so a partial/broken statement
 * never silently falls back to an unrelated free-text search.
 */
export function parseSqlStatement(input: string): SqlStatement | SqlParseError | null {
  const trimmed = input.trim();
  if (!looksLikeSql(trimmed)) return null;

  const cursor = new Cursor(tokenize(trimmed));

  if (cursor.consumeKeyword('BEGIN')) {
    cursor.consumeKeyword('TRANSACTION');
    return cursor.atEnd() ? { type: 'begin' } : { error: 'Unexpected text after BEGIN.' };
  }
  if (cursor.consumeKeyword('COMMIT')) {
    return cursor.atEnd() ? { type: 'commit' } : { error: 'Unexpected text after COMMIT.' };
  }
  if (cursor.consumeKeyword('ROLLBACK')) {
    return cursor.atEnd() ? { type: 'rollback' } : { error: 'Unexpected text after ROLLBACK.' };
  }

  if (cursor.consumeKeyword('SELECT')) {
    if (!cursor.consumeKeyword('*')) return { error: 'Expected * after SELECT (only SELECT * is supported).' };
    if (!cursor.consumeKeyword('FROM')) return { error: 'Expected FROM after SELECT *.' };
    const table = parseTable(cursor);
    if (isParseError(table)) return table;
    let where: SqlWhere | null = null;
    if (cursor.consumeKeyword('WHERE')) {
      const parsed = parseWhere(cursor);
      if (isParseError(parsed)) return parsed;
      where = parsed;
    }
    if (!cursor.atEnd()) return { error: 'Unexpected text after the WHERE clause.' };
    return { type: 'select', table, where };
  }

  if (cursor.consumeKeyword('UPDATE')) {
    const table = parseTable(cursor);
    if (isParseError(table)) return table;
    if (!cursor.consumeKeyword('SET')) return { error: 'Expected SET after the table name.' };
    const assignments: SqlAssignment[] = [];
    for (;;) {
      const assignment = parseAssignment(cursor);
      if (isParseError(assignment)) return assignment;
      assignments.push(assignment);
      if (cursor.consumeKeyword(',')) continue;
      break;
    }
    if (!cursor.consumeKeyword('WHERE')) {
      return { error: 'UPDATE requires a WHERE clause (use WHERE 1=1 to target every row).' };
    }
    const where = parseWhere(cursor);
    if (isParseError(where)) return where;
    if (!cursor.atEnd()) return { error: 'Unexpected text after the WHERE clause.' };
    return { type: 'update', table, assignments, where };
  }

  if (cursor.consumeKeyword('DELETE')) {
    if (!cursor.consumeKeyword('FROM')) return { error: 'Expected FROM after DELETE.' };
    const table = parseTable(cursor);
    if (isParseError(table)) return table;
    if (!cursor.consumeKeyword('WHERE')) {
      return { error: 'DELETE requires a WHERE clause (use WHERE 1=1 to target every row).' };
    }
    const where = parseWhere(cursor);
    if (isParseError(where)) return where;
    if (!cursor.atEnd()) return { error: 'Unexpected text after the WHERE clause.' };
    return { type: 'delete', table, where };
  }

  return { error: 'Unrecognized statement.' };
}

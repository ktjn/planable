import type { Label, Project } from '../db/schema';
import { tokenize, TABLE_ALIASES } from './sqlLanguage';
import { firstStartingWith } from './consoleAutocomplete';

export interface SqlAutocompleteData {
  labels: Label[];
  projects: Project[];
}

const TABLES = ['tasks', 'containers', 'projects', 'labels', 'task', 'container', 'project', 'label'];
const STATUS_VALUES = ['todo', 'doing', 'blocked', 'done'];
const DAY_VALUES = ['mon', 'tue', 'wed', 'thu', 'fri', 'unplanned'];
const BOOL_VALUES = ['true', 'false'];
const SET_FIELDS = ['completed', 'archived', 'status', 'label'];

/** WHERE-clause fields each table actually supports (mirrors consoleSearch's FIELD_KINDS + free-text fields). */
const WHERE_FIELDS: Record<string, string[]> = {
  task: ['label', 'day', 'project', 'done', 'archived', 'repeat', 'title', 'description'],
  container: ['label', 'status', 'project', 'archived', 'kanban', 'name'],
  project: ['name'],
  label: ['color', 'name'],
};

function fieldsForTable(table: string): string[] {
  const kind = TABLE_ALIASES[table.toLowerCase()];
  return kind ? WHERE_FIELDS[kind] : [];
}

function valueCandidatesFor(field: string, data: SqlAutocompleteData): string[] | null {
  switch (field) {
    case 'label':
      return data.labels.map((l) => l.name.toLowerCase());
    case 'project':
      return data.projects.map((p) => p.name.toLowerCase());
    case 'status':
      return STATUS_VALUES;
    case 'day':
      return DAY_VALUES;
    case 'done':
    case 'completed':
    case 'archived':
    case 'repeat':
    case 'kanban':
      return BOOL_VALUES;
    default:
      return null;
  }
}

/** Structural tokens (keywords, table/field names, operators) only suggest once at least one character is typed. */
function matchKeyword(candidates: string[], partial: string): string | null {
  if (partial.length === 0) return null;
  return firstStartingWith(candidates, partial) ?? null;
}

/** Values may suggest the first candidate even with nothing typed yet, matching the plain query language's `label:` behavior. */
function matchValue(candidates: string[], partial: string): string | null {
  return firstStartingWith(candidates, partial) ?? null;
}

function splitOnAny(tokens: string[], separators: string[]): string[][] {
  const groups: string[][] = [[]];
  for (const token of tokens) {
    if (separators.includes(token.toUpperCase())) groups.push([]);
    else groups[groups.length - 1].push(token);
  }
  return groups;
}

/**
 * Suggests the next token within a `WHERE field (= | != | LIKE) value ((AND|OR) ...)*`
 * clause, given the tokens already typed after WHERE. Shared by SELECT,
 * UPDATE, and DELETE, which all use the identical WHERE grammar.
 *
 * Parenthesized groups are supported by the parser but not by this
 * best-effort completer: tracking "are we inside parens, and at what
 * position" through the same last-space/last-quote token split used
 * elsewhere gets fragile fast (e.g. `(l` with no space before the field),
 * so a WHERE clause containing `(`/`)` simply stops offering suggestions
 * rather than risk a wrong one — typed-out or pasted parenthesized
 * expressions still parse and run correctly, only ghost-text stops.
 */
function suggestWhereNext(tokens: string[], partial: string, fields: string[], data: SqlAutocompleteData): string | null {
  if (tokens.some((t) => t === '(' || t === ')')) return null;
  const groups = splitOnAny(tokens, ['AND', 'OR']);
  const current = groups[groups.length - 1];
  if (current.length === 0) return matchKeyword(fields, partial);
  if (current.length === 1) return matchKeyword(['=', '!=', 'LIKE'], partial);
  if (current.length === 2) {
    const field = current[0].toLowerCase();
    const candidates = valueCandidatesFor(field, data);
    return candidates ? matchValue(candidates, partial) : null;
  }
  return matchKeyword(['AND', 'OR'], partial);
}

function suggestSetNext(tokens: string[], partial: string, data: SqlAutocompleteData): string | null {
  const groups = splitOnAny(tokens, [',']);
  const current = groups[groups.length - 1];
  if (current.length === 0) return matchKeyword(SET_FIELDS, partial);
  if (current.length === 1) {
    const field = current[0].toLowerCase();
    return field === 'label' ? matchKeyword(['+=', '-='], partial) : matchKeyword(['='], partial);
  }
  if (current.length === 2) {
    const field = current[0].toLowerCase();
    if (field === 'label') return matchValue(data.labels.map((l) => l.name.toLowerCase()), partial);
    if (field === 'status') return matchValue(STATUS_VALUES, partial);
    if (field === 'completed' || field === 'archived') return matchValue(BOOL_VALUES, partial);
    return null;
  }
  return matchKeyword(['WHERE'], partial);
}

function suggestForSelect(tokens: string[], partial: string, data: SqlAutocompleteData): string | null {
  if (tokens.length === 1) return matchKeyword(['*'], partial);
  if (tokens.length === 2) return matchKeyword(['FROM'], partial);
  if (tokens.length === 3) return matchKeyword(TABLES, partial);
  const rest = tokens.slice(4);
  if (rest.length === 0) return matchKeyword(['WHERE'], partial);
  if (rest[0].toUpperCase() !== 'WHERE') return null;
  return suggestWhereNext(rest.slice(1), partial, fieldsForTable(tokens[3]), data);
}

function suggestForUpdate(tokens: string[], partial: string, data: SqlAutocompleteData): string | null {
  if (tokens.length === 1) return matchKeyword(TABLES, partial);
  if (tokens.length === 2) return matchKeyword(['SET'], partial);
  const rest = tokens.slice(3);
  const whereIdx = rest.findIndex((t) => t.toUpperCase() === 'WHERE');
  if (whereIdx === -1) return suggestSetNext(rest, partial, data);
  return suggestWhereNext(rest.slice(whereIdx + 1), partial, fieldsForTable(tokens[1]), data);
}

function suggestForDelete(tokens: string[], partial: string, data: SqlAutocompleteData): string | null {
  if (tokens.length === 1) return matchKeyword(['FROM'], partial);
  if (tokens.length === 2) return matchKeyword(TABLES, partial);
  const rest = tokens.slice(3);
  if (rest.length === 0) return matchKeyword(['WHERE'], partial);
  if (rest[0].toUpperCase() !== 'WHERE') return null;
  return suggestWhereNext(rest.slice(1), partial, fieldsForTable(tokens[2]), data);
}

/** Dispatches to the right per-verb suggester given the complete tokens typed so far and the in-progress partial token. */
function dispatchSuggestion(priorTokens: string[], partial: string, data: SqlAutocompleteData): string | null {
  if (priorTokens.length === 0) return null;
  const verb = priorTokens[0].toUpperCase();
  if (verb === 'SELECT') return suggestForSelect(priorTokens, partial, data);
  if (verb === 'UPDATE') return suggestForUpdate(priorTokens, partial, data);
  if (verb === 'DELETE') return suggestForDelete(priorTokens, partial, data);
  if (verb === 'BEGIN' && priorTokens.length === 1) return matchKeyword(['TRANSACTION'], partial);
  return null;
}

/**
 * If `input` ends inside an unterminated `'` or `"` quote, returns the quote
 * character, the index of the opening quote, and the (unclosed) text typed
 * inside it so far. Lets the completer recognize a multi-word WHERE/SET
 * value (e.g. `WHERE project = 'Website Re`) that the plain space-tokenizer
 * would otherwise split into multiple unrelated tokens.
 */
function findTrailingOpenQuote(input: string): { quoteChar: string; quoteIndex: number; partial: string } | null {
  let quoteChar: string | null = null;
  let quoteIndex = -1;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (quoteChar) {
      if (ch === quoteChar) quoteChar = null;
    } else if (ch === '"' || ch === "'") {
      quoteChar = ch;
      quoteIndex = i;
    }
  }
  return quoteChar ? { quoteChar, quoteIndex, partial: input.slice(quoteIndex + 1) } : null;
}

/**
 * Ghost-text completion for SQL-ish console statements. Returns the full
 * replacement string for `query`, or null when there's nothing to suggest.
 */
export function suggestSqlCompletion(query: string, data: SqlAutocompleteData): string | null {
  const openQuote = findTrailingOpenQuote(query);
  if (openQuote) {
    const beforeQuote = query.slice(0, openQuote.quoteIndex);
    const priorTokens = tokenize(beforeQuote).map((t) => t.text);
    const partial = openQuote.partial.toLowerCase();
    const suggestion = dispatchSuggestion(priorTokens, partial, data);
    if (!suggestion) return null;
    // Only append what's left of the matched candidate plus the closing quote — the
    // already-typed quoted text (whatever case the user used) is kept verbatim.
    return `${query}${suggestion.slice(partial.length)}${openQuote.quoteChar} `;
  }

  const lastSpace = query.lastIndexOf(' ');
  const prefix = query.slice(0, lastSpace + 1);
  const partial = query.slice(lastSpace + 1);
  const priorTokens = tokenize(prefix).map((t) => t.text);
  const suggestion = dispatchSuggestion(priorTokens, partial, data);
  return suggestion ? `${prefix}${suggestion} ` : null;
}

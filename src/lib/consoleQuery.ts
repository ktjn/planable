export type ConsoleEntityKind = 'task' | 'container' | 'project' | 'label';

export interface QueryFilter {
  field: string;
  value: string;
  negate: boolean;
}

export interface QueryTerm {
  text: string;
  negate: boolean;
}

export interface ItemQuery {
  kind: 'items';
  /** Explicit `type:`/`task`/`container:` tokens the user typed; null means "not restricted". */
  types: ConsoleEntityKind[] | null;
  filters: QueryFilter[];
  terms: QueryTerm[];
}

export interface ActionQuery {
  kind: 'action';
  text: string;
}

export type ConsoleQuery = ItemQuery | ActionQuery;

const TYPE_ALIASES: Record<string, ConsoleEntityKind> = {
  task: 'task',
  tasks: 'task',
  container: 'container',
  containers: 'container',
  project: 'project',
  projects: 'project',
  label: 'label',
  labels: 'label',
};

interface RawToken {
  text: string;
  negate: boolean;
  quoted: boolean;
}

function tokenize(input: string): RawToken[] {
  const tokens: RawToken[] = [];
  const n = input.length;
  let i = 0;
  while (i < n) {
    while (i < n && /\s/.test(input[i])) i++;
    if (i >= n) break;

    let negate = false;
    if (input[i] === '-') {
      negate = true;
      i++;
    }

    let text: string;
    let quoted = false;
    if (input[i] === '"') {
      quoted = true;
      i++;
      const start = i;
      while (i < n && input[i] !== '"') i++;
      text = input.slice(start, i);
      if (i < n) i++; // skip closing quote
    } else {
      const start = i;
      while (i < n && !/\s/.test(input[i])) i++;
      text = input.slice(start, i);
    }

    if (text.length > 0) tokens.push({ text, negate, quoted });
  }
  return tokens;
}

/**
 * Parses a single line of console input into either an action query (leading
 * `>`) or an item query. See docs/decisions.md for the query language spec.
 */
export function parseConsoleQuery(input: string): ConsoleQuery {
  const trimmed = input.trim();
  if (trimmed.startsWith('>')) {
    return { kind: 'action', text: trimmed.slice(1).trim() };
  }
  return parseItemQuery(trimmed);
}

function parseItemQuery(input: string): ItemQuery {
  const types: ConsoleEntityKind[] = [];
  const filters: QueryFilter[] = [];
  const terms: QueryTerm[] = [];

  for (const tok of tokenize(input)) {
    const lower = tok.text.toLowerCase();
    const colonIdx = tok.text.indexOf(':');

    if (!tok.quoted && !tok.negate && colonIdx === -1 && TYPE_ALIASES[lower]) {
      types.push(TYPE_ALIASES[lower]);
      continue;
    }

    if (!tok.quoted && colonIdx > 0) {
      filters.push({
        field: tok.text.slice(0, colonIdx).toLowerCase(),
        value: tok.text.slice(colonIdx + 1).toLowerCase(),
        negate: tok.negate,
      });
      continue;
    }

    terms.push({ text: lower, negate: tok.negate });
  }

  return { kind: 'items', types: types.length > 0 ? types : null, filters, terms };
}

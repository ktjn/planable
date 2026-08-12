import type { Label, Project } from '../db/schema';
import type { ConsoleAction } from './consoleActions';

export interface AutocompleteData {
  labels: Label[];
  projects: Project[];
  actions: ConsoleAction[];
}

const TYPE_KEYWORDS = ['task', 'container', 'project', 'label'];
const FIELD_NAMES = ['label:', 'status:', 'day:', 'project:', 'done:', 'archived:', 'repeat:', 'color:'];
const STATUS_VALUES = ['todo', 'doing', 'blocked', 'done'];
const DAY_VALUES = ['mon', 'tue', 'wed', 'thu', 'fri', 'unplanned'];
const BOOL_VALUES = ['true', 'false'];

function firstStartingWith(candidates: string[], prefix: string): string | undefined {
  const lower = prefix.toLowerCase();
  return candidates.find((c) => c.toLowerCase().startsWith(lower) && c.toLowerCase() !== lower);
}

function valueCandidates(field: string, data: AutocompleteData): string[] | null {
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
      return BOOL_VALUES;
    default:
      return null;
  }
}

function suggestActionCompletion(query: string, actions: ConsoleAction[]): string | null {
  const gtIdx = query.indexOf('>');
  const before = query.slice(0, gtIdx + 1);
  const rest = query.slice(gtIdx + 1);
  const typed = rest.trimStart();
  if (typed.length === 0) return null;
  const leadingSpace = rest.slice(0, rest.length - typed.length);
  const match = actions.find(
    (a) => a.invoke.startsWith(typed.toLowerCase()) && a.invoke !== typed.toLowerCase(),
  );
  if (!match) return null;
  return `${before}${leadingSpace}${match.invoke} `;
}

/**
 * Suggests an inline ("ghost text") completion for the token currently being
 * typed in the console input. Returns the full replacement string for
 * `query` — i.e. `query` plus whatever should follow the cursor — or null
 * when there's nothing worth suggesting (empty input, no match, or the
 * current token is already a full match).
 */
export function suggestCompletion(query: string, data: AutocompleteData): string | null {
  if (query.length === 0) return null;

  if (query.trimStart().startsWith('>')) {
    return suggestActionCompletion(query, data.actions);
  }

  const lastSpace = query.lastIndexOf(' ');
  const prefix = query.slice(0, lastSpace + 1);
  const token = query.slice(lastSpace + 1);
  if (token.length === 0) return null;

  const negate = token.startsWith('-');
  const bare = negate ? token.slice(1) : token;
  if (bare.length === 0) return null;
  const colonIdx = bare.indexOf(':');

  if (colonIdx === -1) {
    const match = firstStartingWith([...FIELD_NAMES, ...TYPE_KEYWORDS], bare);
    if (!match) return null;
    const completed = (negate ? '-' : '') + match;
    const needsTrailingSpace = !match.endsWith(':');
    return prefix + completed + (needsTrailingSpace ? ' ' : '');
  }

  const field = bare.slice(0, colonIdx).toLowerCase();
  const valuePrefix = bare.slice(colonIdx + 1);
  const candidates = valueCandidates(field, data);
  if (!candidates) return null;
  const match = firstStartingWith(candidates, valuePrefix);
  if (!match) return null;
  return `${prefix}${negate ? '-' : ''}${field}:${match} `;
}

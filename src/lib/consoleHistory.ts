const STORAGE_KEY = 'planable:console-history';
const MAX_HISTORY = 50;

/** Reads the persisted console history, most-recent-first. Never throws. */
export function loadConsoleHistory(): string[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((e): e is string => typeof e === 'string') : [];
  } catch {
    return [];
  }
}

/** Persists console history. Never throws (e.g. storage full or unavailable in private browsing). */
export function saveConsoleHistory(history: string[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)));
  } catch {
    // Not persisted this run; in-memory history for the current session still works.
  }
}

/** Prepends a newly-run query, skipping blanks and immediate repeats, capped at MAX_HISTORY. */
export function pushConsoleHistory(history: string[], entry: string): string[] {
  const trimmed = entry.trim();
  if (!trimmed || history[0] === trimmed) return history;
  return [trimmed, ...history].slice(0, MAX_HISTORY);
}

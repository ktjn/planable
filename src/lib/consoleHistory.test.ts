import { describe, it, expect, beforeEach } from 'vitest';
import { loadConsoleHistory, saveConsoleHistory, pushConsoleHistory } from './consoleHistory';

describe('pushConsoleHistory', () => {
  it('prepends a new entry', () => {
    expect(pushConsoleHistory(['old'], 'new')).toEqual(['new', 'old']);
  });

  it('trims whitespace', () => {
    expect(pushConsoleHistory([], '  task label:bug  ')).toEqual(['task label:bug']);
  });

  it('ignores blank entries', () => {
    expect(pushConsoleHistory(['a'], '   ')).toEqual(['a']);
    expect(pushConsoleHistory([], '')).toEqual([]);
  });

  it('skips an immediate repeat of the most recent entry', () => {
    expect(pushConsoleHistory(['a', 'b'], 'a')).toEqual(['a', 'b']);
  });

  it('allows a repeat that is not the immediately preceding entry', () => {
    expect(pushConsoleHistory(['b', 'a'], 'a')).toEqual(['a', 'b', 'a']);
  });

  it('caps history length at 50', () => {
    const full = Array.from({ length: 50 }, (_, i) => `q${i}`);
    const next = pushConsoleHistory(full, 'newest');
    expect(next).toHaveLength(50);
    expect(next[0]).toBe('newest');
    expect(next).not.toContain('q49');
  });
});

describe('loadConsoleHistory / saveConsoleHistory', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('round-trips through localStorage', () => {
    saveConsoleHistory(['task label:bug', '> reset']);
    expect(loadConsoleHistory()).toEqual(['task label:bug', '> reset']);
  });

  it('returns an empty array when nothing is stored', () => {
    expect(loadConsoleHistory()).toEqual([]);
  });

  it('ignores malformed stored data instead of throwing', () => {
    localStorage.setItem('planable:console-history', 'not json');
    expect(loadConsoleHistory()).toEqual([]);
    localStorage.setItem('planable:console-history', JSON.stringify({ not: 'an array' }));
    expect(loadConsoleHistory()).toEqual([]);
  });

  it('filters out non-string entries from stored data', () => {
    localStorage.setItem('planable:console-history', JSON.stringify(['ok', 42, null, 'also ok']));
    expect(loadConsoleHistory()).toEqual(['ok', 'also ok']);
  });
});

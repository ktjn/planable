import { describe, it, expect } from 'vitest';
import { parseConsoleQuery } from './consoleQuery';

describe('parseConsoleQuery', () => {
  it('parses a leading > as an action query', () => {
    const parsed = parseConsoleQuery('> reset');
    expect(parsed).toEqual({ kind: 'action', text: 'reset' });
  });

  it('trims whitespace around the action text', () => {
    expect(parseConsoleQuery('>   goto kanban  ')).toEqual({ kind: 'action', text: 'goto kanban' });
  });

  it('parses bare type keywords', () => {
    const parsed = parseConsoleQuery('task container');
    expect(parsed).toEqual({
      kind: 'items',
      types: ['task', 'container'],
      filters: [],
      terms: [],
    });
  });

  it('parses plural type keywords the same as singular', () => {
    const parsed = parseConsoleQuery('tasks');
    expect(parsed).toMatchObject({ types: ['task'] });
  });

  it('parses field:value filters, lowercased', () => {
    const parsed = parseConsoleQuery('label:Bug status:Doing');
    expect(parsed).toEqual({
      kind: 'items',
      types: null,
      filters: [
        { field: 'label', value: 'bug', negate: false },
        { field: 'status', value: 'doing', negate: false },
      ],
      terms: [],
    });
  });

  it('parses negated filters and terms with a leading -', () => {
    const parsed = parseConsoleQuery('-label:bug -urgent');
    expect(parsed).toEqual({
      kind: 'items',
      types: null,
      filters: [{ field: 'label', value: 'bug', negate: true }],
      terms: [{ text: 'urgent', negate: true }],
    });
  });

  it('parses quoted phrases as a single term, ignoring type/filter parsing inside quotes', () => {
    const parsed = parseConsoleQuery('"fix nav bar" label:bug');
    expect(parsed).toEqual({
      kind: 'items',
      types: null,
      filters: [{ field: 'label', value: 'bug', negate: false }],
      terms: [{ text: 'fix nav bar', negate: false }],
    });
  });

  it('treats a quoted type keyword as a free-text term, not a type filter', () => {
    const parsed = parseConsoleQuery('"task"');
    expect(parsed).toEqual({
      kind: 'items',
      types: null,
      filters: [],
      terms: [{ text: 'task', negate: false }],
    });
  });

  it('combines types, filters, and free text terms', () => {
    const parsed = parseConsoleQuery('task label:bug fix nav');
    expect(parsed).toEqual({
      kind: 'items',
      types: ['task'],
      filters: [{ field: 'label', value: 'bug', negate: false }],
      terms: [
        { text: 'fix', negate: false },
        { text: 'nav', negate: false },
      ],
    });
  });

  it('returns empty query shape for blank input', () => {
    expect(parseConsoleQuery('')).toEqual({ kind: 'items', types: null, filters: [], terms: [] });
    expect(parseConsoleQuery('   ')).toEqual({ kind: 'items', types: null, filters: [], terms: [] });
  });
});

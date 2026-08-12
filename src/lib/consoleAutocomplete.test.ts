import { describe, it, expect } from 'vitest';
import { suggestCompletion } from './consoleAutocomplete';
import { buildConsoleActions } from './consoleActions';
import type { Label, Project } from '../db/schema';

// Ordered alphabetically, matching how ConsolePanel feeds in `listLabels()` results.
const labels: Label[] = [
  { id: 'l2', name: 'Blocked-by-design', color: '#a855f7' },
  { id: 'l1', name: 'Bug', color: '#ef4444' },
  { id: 'l3', name: 'Feature', color: '#3b82f6' },
];
const projects: Project[] = [
  { id: 'p1', name: 'Website Redesign', order: 0 },
  { id: 'p2', name: 'Mobile App', order: 1 },
];
const actions = buildConsoleActions({
  navigate: () => {},
  toggleTheme: () => {},
  resetAll: async () => {},
  addSampleData: async () => {},
  projects: projects.map((p) => ({ id: p.id, name: p.name })),
});

const data = { labels, projects, actions };

describe('suggestCompletion', () => {
  it('returns null for an empty query', () => {
    expect(suggestCompletion('', data)).toBeNull();
  });

  it('returns null once a type keyword token already fully matches', () => {
    expect(suggestCompletion('label', data)).toBe('label:');
    expect(suggestCompletion('container', data)).toBeNull();
  });

  it('completes a bare token to a field name, preferring fields over type keywords', () => {
    // "l" is a prefix of both the "label" type keyword and the "label:" field.
    expect(suggestCompletion('l', data)).toBe('label:');
  });

  it('completes a bare token to a type keyword and adds a trailing space', () => {
    expect(suggestCompletion('con', data)).toBe('container ');
  });

  it('completes after a preceding token, preserving the prefix', () => {
    expect(suggestCompletion('task l', data)).toBe('task label:');
  });

  it('completes label: values from live labels, case-insensitively', () => {
    expect(suggestCompletion('label:bu', data)).toBe('label:bug ');
    expect(suggestCompletion('label:BU', data)).toBe('label:bug ');
  });

  it('picks the first matching label in list order when several share a prefix', () => {
    expect(suggestCompletion('label:b', data)).toBe('label:blocked-by-design ');
  });

  it('suggests the first label alphabetically when the value is empty', () => {
    expect(suggestCompletion('label:', data)).toBe('label:blocked-by-design ');
  });

  it('completes status: values from a fixed alias list', () => {
    expect(suggestCompletion('status:do', data)).toBe('status:doing ');
  });

  it('completes day: values', () => {
    expect(suggestCompletion('day:t', data)).toBe('day:tue ');
  });

  it('completes boolean-valued fields', () => {
    expect(suggestCompletion('done:t', data)).toBe('done:true ');
    expect(suggestCompletion('archived:f', data)).toBe('archived:false ');
    expect(suggestCompletion('repeat:tr', data)).toBe('repeat:true ');
  });

  it('completes project: values from live projects', () => {
    expect(suggestCompletion('project:mo', data)).toBe('project:mobile app ');
  });

  it('returns null for an unknown field', () => {
    expect(suggestCompletion('color:re', data)).toBeNull();
  });

  it('preserves a leading - negation on the completed token', () => {
    expect(suggestCompletion('-l', data)).toBe('-label:');
    expect(suggestCompletion('-label:bu', data)).toBe('-label:bug ');
  });

  it('returns null when nothing matches the typed prefix', () => {
    expect(suggestCompletion('xyz', data)).toBeNull();
    expect(suggestCompletion('label:zzz', data)).toBeNull();
  });

  it('completes action invocations after a > prefix', () => {
    expect(suggestCompletion('> goto k', data)).toBe('> goto kanban ');
    expect(suggestCompletion('>res', data)).toBe('>reset ');
  });

  it('completes open-project actions by project name', () => {
    expect(suggestCompletion('> open project web', data)).toBe('> open project website redesign ');
  });

  it('returns null after > with no text typed yet', () => {
    expect(suggestCompletion('>', data)).toBeNull();
    expect(suggestCompletion('> ', data)).toBeNull();
  });

  it('returns null once the action text already fully matches an invoke phrase', () => {
    expect(suggestCompletion('> reset', data)).toBeNull();
  });
});

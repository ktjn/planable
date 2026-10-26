import { describe, it, expect } from 'vitest';
import formatDoc from '../../docs/markdown-format.md?raw';
import { LLM_PROMPT } from './llmPrompt';
import { parseMarkdown } from './markdownFormat';

describe('LLM_PROMPT', () => {
  it('starts with the conversion instructions', () => {
    expect(LLM_PROMPT.startsWith('# Task\n')).toBe(true);
    expect(LLM_PROMPT).toContain('OneNote');
  });

  it('embeds the full format reference, including the example', () => {
    expect(LLM_PROMPT).toContain(formatDoc.trim());
    const example = /````markdown planable-example\n([\s\S]*?)\n````/.exec(LLM_PROMPT);
    expect(example).not.toBeNull();
    expect(parseMarkdown(example![1]).warnings).toEqual([]);
  });

  it('ends where the user pastes their notes', () => {
    expect(LLM_PROMPT.endsWith('# Notes to convert\n\nThe notes follow below.\n\n')).toBe(true);
  });

  it('only mentions metadata keys the parser accepts', () => {
    const keys = [...LLM_PROMPT.matchAll(/`(\w+): (?:\w[^`]*)`/g)].map((m) => m[1]);
    const known = new Set(['labels', 'kanban', 'archived', 'week', 'repeat', 'completed', 'planable', 'key']);
    expect(keys.filter((k) => !known.has(k))).toEqual([]);
  });
});

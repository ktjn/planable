import instructions from '../../docs/markdown-llm-prompt.md?raw';
import formatDoc from '../../docs/markdown-format.md?raw';

export const LLM_PROMPT = [
  instructions.trim(),
  '---',
  '# Format reference',
  formatDoc.trim(),
  '---',
  '# Notes to convert',
  'The notes follow below.',
  '',
].join('\n\n');

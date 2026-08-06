import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';

function Harness({ handler }: { handler: () => void }) {
  useKeyboardShortcuts([
    { key: 'k', handler, target: 'nav', description: 'Go to Kanban' },
    { key: '/', handler, target: 'nav', description: 'Quick search' },
    { key: 'f', ctrl: true, handler, target: 'nav', description: 'Search' },
  ]);
  return (
    <div>
      <input aria-label="text input" />
      <span>harness</span>
    </div>
  );
}

describe('useKeyboardShortcuts', () => {
  it('fires the handler for a plain key', async () => {
    const handler = vi.fn();
    render(<Harness handler={handler} />);
    await userEvent.keyboard('k');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('fires on Ctrl+key combos', async () => {
    const handler = vi.fn();
    render(<Harness handler={handler} />);
    await userEvent.keyboard('{Control>}f{/Control}');
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('ignores keystrokes typed into an input', async () => {
    const handler = vi.fn();
    render(<Harness handler={handler} />);
    const input = screen.getByLabelText('text input');
    await userEvent.click(input);
    await userEvent.keyboard('k');
    expect(handler).not.toHaveBeenCalled();
  });
});

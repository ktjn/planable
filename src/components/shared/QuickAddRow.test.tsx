import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { QuickAddRow } from './QuickAddRow';

describe('QuickAddRow', () => {
  it('shows an idle button, then an input that calls onAdd on Enter and stays open for the next entry', async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    render(<QuickAddRow onAdd={onAdd} />);

    await userEvent.click(screen.getByText('+ Quick add'));
    const input = screen.getByPlaceholderText('Type a title…');
    await userEvent.type(input, 'First task{Enter}');

    expect(onAdd).toHaveBeenCalledWith('First task');
    expect(screen.getByPlaceholderText('Type a title…')).toHaveValue('');
  });

  it('ignores Enter with an empty or whitespace-only title', async () => {
    const onAdd = vi.fn();
    render(<QuickAddRow onAdd={onAdd} />);

    await userEvent.click(screen.getByText('+ Quick add'));
    await userEvent.type(screen.getByPlaceholderText('Type a title…'), '   {Enter}');

    expect(onAdd).not.toHaveBeenCalled();
  });

  it('returns to the idle button on Escape', async () => {
    const onAdd = vi.fn();
    render(<QuickAddRow onAdd={onAdd} />);

    await userEvent.click(screen.getByText('+ Quick add'));
    await userEvent.type(screen.getByPlaceholderText('Type a title…'), '{Escape}');

    expect(screen.getByText('+ Quick add')).toBeInTheDocument();
  });
});

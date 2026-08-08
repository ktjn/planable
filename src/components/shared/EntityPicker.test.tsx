import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { EntityPicker } from './EntityPicker';

const entities = [
  { id: '1', title: 'Alpha', subtitle: 'Project A' },
  { id: '2', title: 'Beta', subtitle: 'Project B' },
];

describe('EntityPicker', () => {
  it('filters entities by query', async () => {
    render(
      <EntityPicker
        open
        onOpenChange={vi.fn()}
        title="Pick"
        placeholder="Search"
        entities={entities}
        onSelect={vi.fn()}
        emptyMessage="No matches"
      />,
    );
    await userEvent.type(screen.getByPlaceholderText('Search'), 'Alpha');
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.queryByText('Beta')).not.toBeInTheDocument();
  });

  it('calls onSelect with the entity id', async () => {
    const onSelect = vi.fn();
    render(
      <EntityPicker
        open
        onOpenChange={vi.fn()}
        title="Pick"
        placeholder="Search"
        entities={entities}
        onSelect={onSelect}
        emptyMessage="No matches"
      />,
    );
    await userEvent.type(screen.getByPlaceholderText('Search'), 'Beta');
    await userEvent.click(screen.getByText('Beta'));
    expect(onSelect).toHaveBeenCalledWith('2');
  });
});

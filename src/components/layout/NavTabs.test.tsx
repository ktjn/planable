import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { PlanableDB } from '../../db/db';

vi.mock('../../db/db', async () => {
  const { PlanableDB } = await vi.importActual<typeof import('../../db/db')>('../../db/db');
  return { db: new PlanableDB(`test-navtabs-${Math.random()}`) };
});

import { NavTabs } from './NavTabs';
import { createProject } from '../../db/repositories/projects';

describe('NavTabs', () => {
  it('renders Weekly Plan, Kanban, Inbox, and project tabs, and calls onSelect', async () => {
    await createProject('Alpha');
    const onSelect = vi.fn();
    render(<NavTabs active={{ kind: 'weekly' }} onSelect={onSelect} />);

    expect(await screen.findByText('Weekly Plan')).toBeInTheDocument();
    expect(screen.getByText('Kanban')).toBeInTheDocument();
    expect(await screen.findByText('Inbox')).toBeInTheDocument();
    expect(await screen.findByText('Alpha')).toBeInTheDocument();

    await userEvent.click(screen.getByText('Kanban'));
    expect(onSelect).toHaveBeenCalledWith({ kind: 'kanban' });
  });

  it('creates a project via the "+" affordance and it becomes selectable', async () => {
    const onSelect = vi.fn();
    render(<NavTabs active={{ kind: 'weekly' }} onSelect={onSelect} />);

    await userEvent.click(screen.getByLabelText('Add project'));
    await userEvent.type(screen.getByPlaceholderText('New project name'), 'New Project{Enter}');

    expect(await screen.findByText('New Project')).toBeInTheDocument();
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'project', projectId: expect.any(String) }),
    );
  });
});

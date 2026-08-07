import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../db/db', async () => {
  const { PlanableDB } = await vi.importActual<typeof import('../../db/db')>('../../db/db');
  return { db: new PlanableDB(`test-kanbanview-${Math.random()}`) };
});

import { KanbanView } from './KanbanView';
import { createContainer, addContainerToKanban, setContainerKanbanStatus } from '../../db/repositories/containers';
import { createProject } from '../../db/repositories/projects';
import { db } from '../../db/db';

describe('KanbanView', () => {
  it('shows a container in the correct status column', async () => {
    const project = await createProject('Eng');
    const container = await createContainer(project.id, 'Ship it');
    await addContainerToKanban(container.id);
    await setContainerKanbanStatus(container.id, 'Doing');

    render(<KanbanView />);

    expect(await screen.findByText('Ship it')).toBeInTheDocument();
    expect(screen.getByText('Doing').closest('section')).toContainElement(screen.getByText('Ship it'));
  });

  it('quick-adds a task directly into a scheduled container without changing its Kanban status', async () => {
    const project = await createProject('P3');
    const container = await createContainer(project.id, 'Stream');
    await addContainerToKanban(container.id);
    await setContainerKanbanStatus(container.id, 'Doing');

    render(<KanbanView />);
    const doingSection = screen.getByText('Doing').closest('section')!;
    await within(doingSection).findByText('Stream');
    await userEvent.click(within(doingSection).getByRole('button', { name: 'Add task to Stream' }));
    await userEvent.type(within(doingSection).getByPlaceholderText('Type a title…'), 'Quick task{Enter}');

    await waitFor(async () => {
      const created = await db.tasks.filter((t) => t.title === 'Quick task').first();
      expect(created?.containerId).toBe(container.id);
    });
    expect((await db.containers.get(container.id))?.kanban?.status).toBe('Doing');
  });

  it('does not render a quick-add in the empty Inbox container as a Kanban card by default', async () => {
    render(<KanbanView />);
    expect(screen.queryByText('+ Quick add')).not.toBeInTheDocument();
  });
});

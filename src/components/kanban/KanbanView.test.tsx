import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../db/db', async () => {
  const { PlanableDB } = await vi.importActual<typeof import('../../db/db')>('../../db/db');
  return { db: new PlanableDB(`test-kanbanview-${Math.random()}`) };
});

import { KanbanView } from './KanbanView';
import { createTask } from '../../db/repositories/tasks';
import { addToKanban, setKanbanStatus } from '../../db/repositories/taskMembership';
import { INBOX_PROJECT_ID, INBOX_CONTAINER_ID } from '../../db/inbox';

describe('KanbanView', () => {
  it('shows a task in the correct status column', async () => {
    const task = await createTask({ title: 'Ship it', projectId: INBOX_PROJECT_ID, containerId: INBOX_CONTAINER_ID });
    await addToKanban(task.id);
    await setKanbanStatus(task.id, 'Doing');

    render(<KanbanView />);

    expect(await screen.findByText('Ship it')).toBeInTheDocument();
    expect(screen.getByText('Doing').closest('section')).toContainElement(screen.getByText('Ship it'));
  });
});

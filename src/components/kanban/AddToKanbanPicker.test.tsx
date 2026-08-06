import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../db/db', async () => {
  const { PlanableDB } = await vi.importActual<typeof import('../../db/db')>('../../db/db');
  return { db: new PlanableDB(`test-addtokanban-${Math.random()}`) };
});

import { AddToKanbanPicker } from './AddToKanbanPicker';
import { createTask } from '../../db/repositories/tasks';
import { INBOX_PROJECT_ID, INBOX_CONTAINER_ID } from '../../db/inbox';
import { db } from '../../db/db';

describe('AddToKanbanPicker', () => {
  it('finds a task by search and adds it to Kanban as Todo on click', async () => {
    await createTask({ title: 'Board me', projectId: INBOX_PROJECT_ID, containerId: INBOX_CONTAINER_ID });
    const onClose = vi.fn();
    render(<AddToKanbanPicker onClose={onClose} />);

    await userEvent.type(screen.getByPlaceholderText('Search tasks'), 'Board');
    await userEvent.click(await screen.findByText('Board me'));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const task = await db.tasks.filter((t) => t.title === 'Board me').first();
    await waitFor(() => expect(task?.kanban).toEqual({ status: 'Todo' }));
  });
});

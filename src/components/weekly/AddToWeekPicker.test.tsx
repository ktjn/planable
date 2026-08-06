import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../db/db', async () => {
  const { PlanableDB } = await vi.importActual<typeof import('../../db/db')>('../../db/db');
  return { db: new PlanableDB(`test-addtoweek-${Math.random()}`) };
});

import { AddToWeekPicker } from './AddToWeekPicker';
import { createTask } from '../../db/repositories/tasks';
import { INBOX_PROJECT_ID, INBOX_CONTAINER_ID } from '../../db/inbox';
import { db } from '../../db/db';
import { getCurrentWeekId } from '../../lib/week';

describe('AddToWeekPicker', () => {
  it('finds a task by search and adds it to the current week on click', async () => {
    await createTask({ title: 'Findable task', projectId: INBOX_PROJECT_ID, containerId: INBOX_CONTAINER_ID });
    const onClose = vi.fn();
    render(<AddToWeekPicker onClose={onClose} />);

    await userEvent.type(screen.getByPlaceholderText('Search tasks'), 'Findable');
    await userEvent.click(await screen.findByText('Findable task'));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const task = await db.tasks.filter((t) => t.title === 'Findable task').first();
    expect(task?.weekly?.weekId).toBe(getCurrentWeekId());
    expect(task?.weekly?.day).toBe('Unplanned');
  });
});

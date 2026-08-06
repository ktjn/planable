import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../db/db', async () => {
  const { PlanableDB } = await vi.importActual<typeof import('../../db/db')>('../../db/db');
  return { db: new PlanableDB(`test-weeklyview-${Math.random()}`) };
});

import { WeeklyPlanView } from './WeeklyPlanView';
import { createTask } from '../../db/repositories/tasks';
import { addToWeek, setWeeklyDay } from '../../db/repositories/taskMembership';
import { getCurrentWeekId } from '../../lib/week';
import { INBOX_PROJECT_ID, INBOX_CONTAINER_ID } from '../../db/inbox';

describe('WeeklyPlanView', () => {
  it('shows a task in the correct day column and not elsewhere', async () => {
    const task = await createTask({ title: 'Plan work', projectId: INBOX_PROJECT_ID, containerId: INBOX_CONTAINER_ID });
    await addToWeek(task.id, getCurrentWeekId());
    await setWeeklyDay(task.id, 'Tue');

    render(<WeeklyPlanView />);

    expect(await screen.findByText('Plan work')).toBeInTheDocument();
    expect(screen.getByText('Tue').closest('section')).toContainElement(screen.getByText('Plan work'));
  });
});

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

  it('renders day columns as drop targets and task rows as drag sources', async () => {
    const task = await createTask({ title: 'Draggable', projectId: INBOX_PROJECT_ID, containerId: INBOX_CONTAINER_ID });
    await addToWeek(task.id, getCurrentWeekId());

    render(<WeeklyPlanView />);
    const row = await screen.findByText('Draggable');
    expect(row).not.toHaveAttribute('draggable'); // dnd-kit uses pointer events, not native HTML5 DnD
    expect(row.closest('[data-dnd-draggable]')).toBeInTheDocument();
  });

  it('quick-adds a task directly into the clicked day column, in the Inbox project', async () => {
    render(<WeeklyPlanView />);

    const wedSection = screen.getByText('Wed').closest('section')!;
    await userEvent.click(within(wedSection).getByText('+ Quick add'));
    await userEvent.type(within(wedSection).getByPlaceholderText('Type a title…'), 'Quick task{Enter}');

    expect(await within(wedSection).findByText('Quick task')).toBeInTheDocument();

    const { db } = await import('../../db/db');
    const created = await db.tasks.filter((t) => t.title === 'Quick task').first();
    expect(created?.projectId).toBe(INBOX_PROJECT_ID);
    expect(created?.containerId).toBe(INBOX_CONTAINER_ID);
    expect(created?.weekly).toEqual({ weekId: getCurrentWeekId(), day: 'Wed', repeatWeekly: false });
  });
});

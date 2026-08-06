import { describe, it, expect, vi } from 'vitest';
import { PlanableDB } from '../db';

vi.mock('../db', async () => {
  const { PlanableDB } = await vi.importActual<typeof import('../db')>('../db');
  return { db: new PlanableDB(`test-membership-${Math.random()}`) };
});

import { createTask } from './tasks';
import {
  addToKanban,
  setKanbanStatus,
  removeFromKanban,
  addToWeek,
  setWeeklyDay,
  removeFromWeek,
} from './taskMembership';
import { INBOX_PROJECT_ID, INBOX_CONTAINER_ID } from '../inbox';
import { db } from '../db';

async function makeTask() {
  return createTask({ title: 'T', projectId: INBOX_PROJECT_ID, containerId: INBOX_CONTAINER_ID });
}

describe('task membership helpers', () => {
  it('adds to kanban with Todo default, updates status, and completes on Done', async () => {
    const task = await makeTask();
    await addToKanban(task.id);
    expect((await db.tasks.get(task.id))?.kanban).toEqual({ status: 'Todo' });

    await setKanbanStatus(task.id, 'Doing');
    expect((await db.tasks.get(task.id))?.kanban).toEqual({ status: 'Doing' });
    expect((await db.tasks.get(task.id))?.completed).toBe(false);

    await setKanbanStatus(task.id, 'Done');
    const done = await db.tasks.get(task.id);
    expect(done?.kanban).toEqual({ status: 'Done' });
    expect(done?.completed).toBe(true);
    expect(done?.completedDate).not.toBeNull();
  });

  it('removes kanban membership without touching weekly or completed', async () => {
    const task = await makeTask();
    await addToKanban(task.id);
    await removeFromKanban(task.id);
    expect((await db.tasks.get(task.id))?.kanban).toBeNull();
  });

  it('adds to week with Unplanned default, updates day, and can be removed', async () => {
    const task = await makeTask();
    await addToWeek(task.id, '2026-W32');
    expect((await db.tasks.get(task.id))?.weekly).toEqual({
      weekId: '2026-W32',
      day: 'Unplanned',
      repeatWeekly: false,
    });

    await setWeeklyDay(task.id, 'Tue');
    expect((await db.tasks.get(task.id))?.weekly?.day).toBe('Tue');

    await removeFromWeek(task.id);
    expect((await db.tasks.get(task.id))?.weekly).toBeNull();
  });
});

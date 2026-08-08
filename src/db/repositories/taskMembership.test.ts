import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../db', async () => {
  const { PlanableDB } = await vi.importActual<typeof import('../db')>('../db');
  return { db: new PlanableDB(`test-membership-${Math.random()}`) };
});

import type { PlanableDB } from '../db';
import { createTask } from './tasks';
import { addToWeek, setWeeklyDay, reorderWeeklyTasks } from './taskMembership';
import { INBOX_PROJECT_ID, INBOX_CONTAINER_ID } from '../inbox';
import { getCurrentWeekId } from '../../lib/week';

describe('taskMembership weekly ordering', () => {
  let db: PlanableDB;

  beforeEach(async () => {
    const { db: mockDb } = await import('../db');
    db = mockDb;
    await db.delete();
    await db.open();
  });

  it('assigns order=0 when adding the first task to a week', async () => {
    const task = await createTask({ title: 'A', projectId: INBOX_PROJECT_ID, containerId: INBOX_CONTAINER_ID });
    await addToWeek(task.id, getCurrentWeekId());
    const updated = await db.tasks.get(task.id);
    expect(updated?.weekly?.order).toBe(0);
  });

  it('appends the next task at the end of Unplanned', async () => {
    const a = await createTask({ title: 'A', projectId: INBOX_PROJECT_ID, containerId: INBOX_CONTAINER_ID });
    const b = await createTask({ title: 'B', projectId: INBOX_PROJECT_ID, containerId: INBOX_CONTAINER_ID });
    await addToWeek(a.id, getCurrentWeekId());
    await addToWeek(b.id, getCurrentWeekId());
    const updated = await db.tasks.get(b.id);
    expect(updated?.weekly?.order).toBe(1);
  });

  it('assigns order at the end of the target day when moving days', async () => {
    const task = await createTask({ title: 'A', projectId: INBOX_PROJECT_ID, containerId: INBOX_CONTAINER_ID });
    await addToWeek(task.id, getCurrentWeekId());
    await setWeeklyDay(task.id, 'Mon');
    const first = await db.tasks.get(task.id);
    expect(first?.weekly?.day).toBe('Mon');
    expect(first?.weekly?.order).toBe(0);

    const other = await createTask({ title: 'B', projectId: INBOX_PROJECT_ID, containerId: INBOX_CONTAINER_ID });
    await addToWeek(other.id, getCurrentWeekId());
    await setWeeklyDay(other.id, 'Mon');
    const second = await db.tasks.get(other.id);
    expect(second?.weekly?.order).toBe(1);
  });

  it('reorders tasks within a day', async () => {
    const a = await createTask({ title: 'A', projectId: INBOX_PROJECT_ID, containerId: INBOX_CONTAINER_ID });
    const b = await createTask({ title: 'B', projectId: INBOX_PROJECT_ID, containerId: INBOX_CONTAINER_ID });
    const week = getCurrentWeekId();
    await addToWeek(a.id, week);
    await addToWeek(b.id, week);
    await reorderWeeklyTasks(week, 'Unplanned', [b.id, a.id]);
    const tasks = await db.tasks.where('weekly.weekId').equals(week).toArray();
    const byId = new Map(tasks.map((t) => [t.id, t]));
    expect(byId.get(b.id)?.weekly?.order).toBe(0);
    expect(byId.get(a.id)?.weekly?.order).toBe(1);
  });
});

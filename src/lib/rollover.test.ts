import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlanableDB } from '../db/db';

vi.mock('../db/db', async () => {
  const { PlanableDB } = await vi.importActual<typeof import('../db/db')>('../db/db');
  return { db: new PlanableDB(`test-rollover-${Math.random()}`) };
});

import { db } from '../db/db';
import { INBOX_PROJECT_ID, INBOX_CONTAINER_ID } from '../db/inbox';
import { createTask, setTaskCompleted } from '../db/repositories/tasks';
import { addToWeek, setTaskRepeatWeekly, setWeeklyDay } from '../db/repositories/taskMembership';
import { autoHandleClosingWeek, getUnresolvedTasks, resolveTask } from './rollover';
import type { Task } from '../db/schema';

async function makeWeeklyTask(title: string, weekId: string, day = 'Mon') {
  const task = await createTask({ title, projectId: INBOX_PROJECT_ID, containerId: INBOX_CONTAINER_ID });
  await addToWeek(task.id, weekId);
  await setWeeklyDay(task.id, day as Parameters<typeof setWeeklyDay>[1]);
  return task;
}

describe('rollover', () => {
  beforeEach(async () => {
    await db.tasks.clear();
    await db.weekTemplates.clear();
    await db.settings.clear();
  });

  it('lists unfinished non-repeat tasks as unresolved', async () => {
    const unfinished = await makeWeeklyTask('Unfinished', '2026-W32');

    const repeat = await createTask({
      title: 'Repeat task',
      projectId: INBOX_PROJECT_ID,
      containerId: INBOX_CONTAINER_ID,
    });
    await addToWeek(repeat.id, '2026-W32');
    await setTaskRepeatWeekly(repeat.id, true);

    const done = await makeWeeklyTask('Done task', '2026-W32');
    await setTaskCompleted(done.id, true);

    const unresolved = await getUnresolvedTasks('2026-W32');
    expect(unresolved.map((t) => t.title).sort()).toEqual(['Unfinished']);
    expect(unfinished.id).toBeTruthy();
  });

  it('spawns fresh instances for repeat tasks and clears weekly on auto-advance', async () => {
    const template = await createTask({
      title: 'Weekly sync',
      projectId: INBOX_PROJECT_ID,
      containerId: INBOX_CONTAINER_ID,
    });
    await addToWeek(template.id, '2026-W32');
    await setTaskRepeatWeekly(template.id, true);

    await autoHandleClosingWeek('2026-W32');

    const original = await db.tasks.get(template.id);
    expect(original?.weekly).toBeNull();

    const spawned = (await db.tasks
      .filter((t) => t.weekly?.weekId === '2026-W33' && t.weekly.repeatWeekly)
      .toArray()) as Task[];
    expect(spawned).toHaveLength(1);
    expect(spawned[0].title).toBe('Weekly sync');
    expect(spawned[0].weekly?.day).toBe('Unplanned');
  });

  it('resolves an unfinished task by moving it to the next week', async () => {
    const task = await makeWeeklyTask('Move me', '2026-W32');
    await resolveTask(task.id, 'move');
    const updated = (await db.tasks.get(task.id))!;
    expect(updated.weekly?.weekId).toBe('2026-W33');
    expect(updated.weekly?.day).toBe('Unplanned');
    expect(updated.completed).toBe(false);
  });

  it('resolves an unfinished task by returning it to the project', async () => {
    const task = await makeWeeklyTask('Return me', '2026-W32');
    await resolveTask(task.id, 'return');
    const updated = (await db.tasks.get(task.id))!;
    expect(updated.weekly).toBeNull();
  });

  it('resolves an unfinished task by completing it', async () => {
    const task = await makeWeeklyTask('Complete me', '2026-W32');
    await resolveTask(task.id, 'complete');
    const updated = (await db.tasks.get(task.id))!;
    expect(updated.completed).toBe(true);
    expect(updated.completedDate).not.toBeNull();
    expect(updated.weekly).toBeNull();
  });

  it('resolves an unfinished task by deleting it', async () => {
    const task = await makeWeeklyTask('Delete me', '2026-W32');
    await resolveTask(task.id, 'delete');
    expect(await db.tasks.get(task.id)).toBeUndefined();
  });

  it('leaves other unfinished tasks untouched', async () => {
    const a = await makeWeeklyTask('A', '2026-W32');
    const b = await makeWeeklyTask('B', '2026-W32');
    await resolveTask(a.id, 'complete');
    const kept = (await db.tasks.get(b.id))!;
    expect(kept.weekly?.weekId).toBe('2026-W32');
  });
});

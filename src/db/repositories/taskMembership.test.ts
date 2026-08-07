import { describe, it, expect, vi } from 'vitest';
import { PlanableDB } from '../db';

vi.mock('../db', async () => {
  const { PlanableDB } = await vi.importActual<typeof import('../db')>('../db');
  return { db: new PlanableDB(`test-membership-${Math.random()}`) };
});

import { createTask } from './tasks';
import { addToWeek, setWeeklyDay, removeFromWeek, setTaskArchived } from './taskMembership';
import { upsertWeekTemplate } from './weekTemplates';
import { INBOX_PROJECT_ID, INBOX_CONTAINER_ID } from '../inbox';
import { db } from '../db';

async function makeTask(title = 'T') {
  return createTask({ title, projectId: INBOX_PROJECT_ID, containerId: INBOX_CONTAINER_ID });
}

describe('task membership helpers', () => {
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

  it('archives a repeating task, clearing weekly membership and removing its template', async () => {
    const task = await makeTask();
    await addToWeek(task.id, '2026-W32');
    await upsertWeekTemplate({
      taskId: task.id,
      title: task.title,
      projectId: task.projectId,
      containerId: task.containerId,
    });

    await setTaskArchived(task.id, true);
    const archived = await db.tasks.get(task.id);
    expect(archived?.archived).toBe(true);
    expect(archived?.weekly).toBeNull();
    expect(await db.weekTemplates.where('taskId').equals(task.id).count()).toBe(0);

    // Unarchive restores nothing.
    await setTaskArchived(task.id, false);
    const restored = await db.tasks.get(task.id);
    expect(restored?.archived).toBe(false);
    expect(restored?.weekly).toBeNull();
  });
});

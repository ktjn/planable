import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PlanableDB } from '../db';

vi.mock('../db', async () => {
  const { PlanableDB } = await vi.importActual<typeof import('../db')>('../db');
  return { db: new PlanableDB(`test-tasks-${Math.random()}`) };
});

import { createTask, listTasksByContainer, updateTask, setTaskCompleted, deleteTask, reorderTasks } from './tasks';
import { INBOX_PROJECT_ID, INBOX_CONTAINER_ID } from '../inbox';

describe('task repository', () => {
  let db: PlanableDB;

  beforeEach(async () => {
    const { db: mockDb } = await import('../db');
    db = mockDb;
    await db.delete();
    await db.open();
  });
  it('creates a task with defaults', async () => {
    const task = await createTask({
      title: 'Write plan',
      projectId: INBOX_PROJECT_ID,
      containerId: INBOX_CONTAINER_ID,
    });
    expect(task.completed).toBe(false);
    expect(task.completedDate).toBeNull();
    expect(task.archived).toBe(false);
    expect(task.weekly).toBeNull();
    expect(task.labels).toEqual([]);
    expect(task.order).toBe(0);
  });

  it('lists tasks by container', async () => {
    const task = await createTask({
      title: 'Task in inbox',
      projectId: INBOX_PROJECT_ID,
      containerId: INBOX_CONTAINER_ID,
    });
    const tasks = await listTasksByContainer(INBOX_CONTAINER_ID);
    expect(tasks.map((t) => t.id)).toContain(task.id);
  });

  it('updates a task', async () => {
    const task = await createTask({
      title: 'Original',
      projectId: INBOX_PROJECT_ID,
      containerId: INBOX_CONTAINER_ID,
    });
    await updateTask(task.id, { title: 'Renamed' });
    const [updated] = await listTasksByContainer(INBOX_CONTAINER_ID);
    expect(updated.title).toBe('Renamed');
  });

  it('sets completed with a completedDate, and clears it when uncompleted', async () => {
    const task = await createTask({
      title: 'Finish me',
      projectId: INBOX_PROJECT_ID,
      containerId: INBOX_CONTAINER_ID,
    });
    await setTaskCompleted(task.id, true);
    let [t] = await listTasksByContainer(INBOX_CONTAINER_ID).then((ts) => ts.filter((x) => x.id === task.id));
    expect(t.completed).toBe(true);
    expect(t.completedDate).not.toBeNull();

    await setTaskCompleted(task.id, false);
    [t] = await listTasksByContainer(INBOX_CONTAINER_ID).then((ts) => ts.filter((x) => x.id === task.id));
    expect(t.completed).toBe(false);
    expect(t.completedDate).toBeNull();
  });

  it('deletes a task', async () => {
    const task = await createTask({
      title: 'Delete me',
      projectId: INBOX_PROJECT_ID,
      containerId: INBOX_CONTAINER_ID,
    });
    await deleteTask(task.id);
    const tasks = await listTasksByContainer(INBOX_CONTAINER_ID);
    expect(tasks.find((t) => t.id === task.id)).toBeUndefined();
  });

  it('assigns increasing order within a container and reorders tasks', async () => {
    const a = await createTask({ title: 'A', projectId: INBOX_PROJECT_ID, containerId: INBOX_CONTAINER_ID });
    const b = await createTask({ title: 'B', projectId: INBOX_PROJECT_ID, containerId: INBOX_CONTAINER_ID });
    expect((await db.tasks.get(a.id))?.order).toBe(0);
    expect((await db.tasks.get(b.id))?.order).toBe(1);

    await reorderTasks(INBOX_CONTAINER_ID, [b.id, a.id]);

    const ordered = await listTasksByContainer(INBOX_CONTAINER_ID);
    expect(ordered.map((t) => t.id)).toEqual([b.id, a.id]);
    expect(ordered[0].order).toBe(0);
    expect(ordered[1].order).toBe(1);
  });
});

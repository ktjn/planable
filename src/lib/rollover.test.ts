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
import { createProject } from '../db/repositories/projects';
import { createContainer, addContainerToWeek, setContainerWeeklyDay, setContainerArchived } from '../db/repositories/containers';
import {
  autoHandleClosingWeek,
  getUnresolvedTasks,
  getUnresolvedContainers,
  resolveTask,
  resolveContainer,
} from './rollover';
import type { Task } from '../db/schema';

async function makeWeeklyTask(title: string, weekId: string, day = 'Mon') {
  const task = await createTask({ title, projectId: INBOX_PROJECT_ID, containerId: INBOX_CONTAINER_ID });
  await addToWeek(task.id, weekId);
  await setWeeklyDay(task.id, day as Parameters<typeof setWeeklyDay>[1]);
  return task;
}

async function makeWeeklyContainer(projectId: string, name: string, weekId: string, day = 'Tue') {
  const container = await createContainer(projectId, name);
  await addContainerToWeek(container.id, weekId);
  await setContainerWeeklyDay(container.id, day as Parameters<typeof setContainerWeeklyDay>[1]);
  return container;
}

describe('rollover', () => {
  beforeEach(async () => {
    await db.containers.clear();
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

  it('lists every container scheduled in the closing week as unresolved', async () => {
    const project = await createProject('Eng');
    const scheduled = await makeWeeklyContainer(project.id, 'Architecture', '2026-W32');
    const idle = await createContainer(project.id, 'Backlog');

    const unresolved = await getUnresolvedContainers('2026-W32');
    expect(unresolved.map((c) => c.id)).toEqual([scheduled.id]);
    expect(await db.containers.get(idle.id)).toBeDefined();
  });

  it('moves a container to the next week without touching its child tasks', async () => {
    const project = await createProject('Eng');
    const container = await makeWeeklyContainer(project.id, 'Architecture', '2026-W32', 'Thu');
    const task = await createTask({ title: 'Child', projectId: project.id, containerId: container.id });
    const taskBefore = await db.tasks.get(task.id);

    await resolveContainer(container.id, 'move');

    const moved = (await db.containers.get(container.id))!;
    expect(moved.weekly?.weekId).toBe('2026-W33');
    expect(moved.weekly?.day).toBe('Unplanned');
    expect(await db.tasks.get(task.id)).toEqual(taskBefore);
  });

  it('returns a container to its project, clearing only its weekly membership', async () => {
    const project = await createProject('Eng');
    const container = await makeWeeklyContainer(project.id, 'Architecture', '2026-W32');
    const task = await createTask({ title: 'Child', projectId: project.id, containerId: container.id });

    await resolveContainer(container.id, 'return');

    const updated = (await db.containers.get(container.id))!;
    expect(updated.weekly).toBeNull();
    expect(updated.projectId).toBe(project.id);
    expect((await db.tasks.get(task.id))!).toBeDefined();
    expect(await db.containers.get(container.id)).toBeDefined();
  });

  it('archived containers are never offered in rollover because archiving clears weekly', async () => {
    const project = await createProject('Eng');
    const container = await makeWeeklyContainer(project.id, 'Archived', '2026-W32');
    await setContainerArchived(container.id, true);

    const unresolved = await getUnresolvedContainers('2026-W32');
    expect(unresolved.map((c) => c.id)).not.toContain(container.id);
  });

  it('container resolution never imposes recurrence or spawns a new container', async () => {
    const project = await createProject('Eng');
    const container = await makeWeeklyContainer(project.id, 'Recur', '2026-W32');
    const countBefore = await db.containers.count();

    // No template is ever created for a Container, and moving it to the next
    // week only edits the one record's membership.
    await resolveContainer(container.id, 'move');
    expect(await db.weekTemplates.count()).toBe(0);

    const moved = (await db.containers.get(container.id))!;
    expect(moved.weekly?.weekId).toBe('2026-W33');
    expect(await db.containers.count()).toBe(countBefore);
  });
});

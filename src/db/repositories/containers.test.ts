import { describe, it, expect, vi } from 'vitest';
import { PlanableDB } from '../db';

vi.mock('../db', async () => {
  const { PlanableDB } = await vi.importActual<typeof import('../db')>('../db');
  return { db: new PlanableDB(`test-containers-${Math.random()}`) };
});

import {
  createContainer,
  listContainersByProject,
  listContainersByWeek,
  renameContainer,
  reorderContainers,
  deleteContainer,
  addContainerToWeek,
  setContainerWeeklyDay,
  removeContainerFromWeek,
  addContainerToKanban,
  setContainerKanbanStatus,
  removeContainerFromKanban,
  setContainerArchived,
  updateContainer,
} from './containers';
import { createProject } from './projects';
import { createTask } from './tasks';
import { INBOX_PROJECT_ID, INBOX_CONTAINER_ID } from '../inbox';
import { db } from '../db';

describe('container repository', () => {
  it('creates, lists, renames, and reorders containers', async () => {
    const project = await createProject('Demo');
    const c1 = await createContainer(project.id, 'Backlog');
    const c2 = await createContainer(project.id, 'Doing');
    expect((await listContainersByProject(project.id)).map((c) => c.name)).toEqual(['Backlog', 'Doing']);

    await renameContainer(c1.id, 'Ideas');
    expect((await listContainersByProject(project.id))[0].name).toBe('Ideas');

    await reorderContainers(project.id, [c2.id, c1.id]);
    expect((await listContainersByProject(project.id)).map((c) => c.id)).toEqual([c2.id, c1.id]);
  });

  it('reassigns tasks to Inbox when deleting a container', async () => {
    const project = await createProject('Demo2');
    const container = await createContainer(project.id, 'Backlog');
    const task = await createTask({ title: 'T', projectId: project.id, containerId: container.id });

    await deleteContainer(container.id);

    const moved = await db.tasks.get(task.id);
    expect(moved?.containerId).toBe(INBOX_CONTAINER_ID);
    expect(moved?.projectId).toBe(INBOX_PROJECT_ID);
    expect(await db.containers.get(container.id)).toBeUndefined();
  });

  it('refuses to delete the Inbox container', async () => {
    await expect(deleteContainer(INBOX_CONTAINER_ID)).rejects.toThrow();
  });

  it('adds a container to a week, moves its day, and removes it without touching child tasks', async () => {
    const project = await createProject('Demo3');
    const container = await createContainer(project.id, 'Architecture');
    const task = await createTask({ title: 'Child', projectId: project.id, containerId: container.id });
    const taskBefore = await db.tasks.get(task.id);

    await addContainerToWeek(container.id, '2026-W32');
    expect((await db.containers.get(container.id))?.weekly).toEqual({
      weekId: '2026-W32',
      day: 'Unplanned',
    });

    await setContainerWeeklyDay(container.id, 'Tue');
    expect((await db.containers.get(container.id))?.weekly?.day).toBe('Tue');

    expect(await db.tasks.get(task.id)).toEqual(taskBefore);

    await removeContainerFromWeek(container.id);
    expect((await db.containers.get(container.id))?.weekly).toBeNull();
    expect(await db.tasks.get(task.id)).toEqual(taskBefore);
  });

  it('lists only containers scheduled in the given week', async () => {
    const project = await createProject('Demo4');
    const scheduled = await createContainer(project.id, 'Scheduled');
    const other = await createContainer(project.id, 'Other');
    await addContainerToWeek(scheduled.id, '2026-W32');

    const ids = (await listContainersByWeek('2026-W32')).map((c) => c.id);
    expect(ids).toContain(scheduled.id);
    expect(ids).not.toContain(other.id);
  });

  it('does not change the day when a container has no weekly membership', async () => {
    const project = await createProject('Demo5');
    const container = await createContainer(project.id, 'Unscheduled');
    await setContainerWeeklyDay(container.id, 'Wed');
    expect((await db.containers.get(container.id))?.weekly).toBeNull();
  });

  it('adds a container to Kanban as Todo, updates status, and removes it', async () => {
    const project = await createProject('K1');
    const container = await createContainer(project.id, 'Stream');
    await addContainerToKanban(container.id);
    expect((await db.containers.get(container.id))?.kanban).toEqual({ status: 'Todo' });

    await setContainerKanbanStatus(container.id, 'Done');
    expect((await db.containers.get(container.id))?.kanban).toEqual({ status: 'Done' });

    await removeContainerFromKanban(container.id);
    expect((await db.containers.get(container.id))?.kanban).toBeNull();
  });

  it('Kanban Done does not touch child Task completion state', async () => {
    const project = await createProject('K2');
    const container = await createContainer(project.id, 'Stream2');
    const child = await createTask({ title: 'Child', projectId: project.id, containerId: container.id });
    await addContainerToKanban(container.id);
    await setContainerKanbanStatus(container.id, 'Done');
    const after = await db.tasks.get(child.id);
    expect(after?.completed).toBe(false);
    expect(after?.completedDate).toBeNull();
  });

  it('archiving a container clears weekly and kanban but leaves child tasks alone', async () => {
    const project = await createProject('A1');
    const container = await createContainer(project.id, 'ToArchive');
    const child = await createTask({ title: 'Child', projectId: project.id, containerId: container.id });
    await addContainerToWeek(container.id, '2026-W32');
    await addContainerToKanban(container.id);

    await setContainerArchived(container.id, true);
    const archived = (await db.containers.get(container.id))!;
    expect(archived.archived).toBe(true);
    expect(archived.weekly).toBeNull();
    expect(archived.kanban).toBeNull();

    const afterChild = await db.tasks.get(child.id);
    expect(afterChild?.archived).toBe(false);
    expect(afterChild?.containerId).toBe(container.id);

    await setContainerArchived(container.id, false);
    expect((await db.containers.get(container.id))?.archived).toBe(false);
  });

  it('refuses to archive the Inbox container', async () => {
    await expect(setContainerArchived(INBOX_CONTAINER_ID, true)).rejects.toThrow();
  });

  it('updates a container name and labels', async () => {
    const project = await createProject('L1');
    const container = await createContainer(project.id, 'Original');
    await updateContainer(container.id, { name: 'Renamed', labels: ['a', 'b'] });
    const updated = (await db.containers.get(container.id))!;
    expect(updated.name).toBe('Renamed');
    expect(updated.labels).toEqual(['a', 'b']);
  });
});

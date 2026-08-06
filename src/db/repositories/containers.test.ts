import { describe, it, expect, vi } from 'vitest';
import { PlanableDB } from '../db';

vi.mock('../db', async () => {
  const { PlanableDB } = await vi.importActual<typeof import('../db')>('../db');
  return { db: new PlanableDB(`test-containers-${Math.random()}`) };
});

import {
  createContainer,
  listContainersByProject,
  renameContainer,
  reorderContainers,
  deleteContainer,
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
});

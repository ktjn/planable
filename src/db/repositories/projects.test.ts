import { describe, it, expect, vi } from 'vitest';
import { PlanableDB } from '../db';

vi.mock('../db', async () => {
  const { PlanableDB } = await vi.importActual<typeof import('../db')>('../db');
  return { db: new PlanableDB(`test-projects-${Math.random()}`) };
});

import { createProject, listProjects, renameProject, reorderProjects, deleteProject } from './projects';
import { createContainer, listContainersByProject } from './containers';
import { createTask } from './tasks';
import { INBOX_PROJECT_ID, INBOX_CONTAINER_ID } from '../inbox';
import { db } from '../db';

describe('project repository', () => {
  it('creates, lists, renames, and reorders projects', async () => {
    const p1 = await createProject('Alpha');
    const p2 = await createProject('Beta');
    const names = (await listProjects()).map((p) => p.name);
    expect(names).toEqual(expect.arrayContaining(['Inbox', 'Alpha', 'Beta']));

    await renameProject(p1.id, 'Alpha Renamed');
    expect((await listProjects()).find((p) => p.id === p1.id)?.name).toBe('Alpha Renamed');

    await reorderProjects([p2.id, p1.id]);
    const ordered = await listProjects();
    expect(ordered.findIndex((p) => p.id === p2.id)).toBeLessThan(
      ordered.findIndex((p) => p.id === p1.id),
    );
  });

  it('deletes a project, cascading containers and reassigning tasks to Inbox', async () => {
    const project = await createProject('Gamma');
    const container = await createContainer(project.id, 'Backlog');
    const task = await createTask({ title: 'T', projectId: project.id, containerId: container.id });

    await deleteProject(project.id);

    expect(await db.projects.get(project.id)).toBeUndefined();
    expect(await listContainersByProject(project.id)).toEqual([]);
    const moved = await db.tasks.get(task.id);
    expect(moved?.projectId).toBe(INBOX_PROJECT_ID);
    expect(moved?.containerId).toBe(INBOX_CONTAINER_ID);
  });

  it('refuses to delete the Inbox project', async () => {
    await expect(deleteProject(INBOX_PROJECT_ID)).rejects.toThrow();
  });
});

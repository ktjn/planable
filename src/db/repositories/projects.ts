import { db } from '../db';
import type { Project } from '../schema';
import { INBOX_PROJECT_ID } from '../inbox';
import { listContainersByProject, deleteContainer } from './containers';

export async function listProjects(): Promise<Project[]> {
  return db.projects.orderBy('order').toArray();
}

export async function createProject(name: string): Promise<Project> {
  const count = await db.projects.count();
  const project: Project = { id: crypto.randomUUID(), name, order: count };
  await db.projects.add(project);
  return project;
}

export async function renameProject(id: string, name: string): Promise<void> {
  await db.projects.update(id, { name });
}

export async function reorderProjects(orderedIds: string[]): Promise<void> {
  await db.transaction('rw', db.projects, async () => {
    await Promise.all(orderedIds.map((id, index) => db.projects.update(id, { order: index })));
  });
}

export async function deleteProject(id: string): Promise<void> {
  if (id === INBOX_PROJECT_ID) {
    throw new Error('Cannot delete the Inbox project');
  }
  const containers = await listContainersByProject(id);
  for (const container of containers) {
    await deleteContainer(container.id);
  }
  await db.projects.delete(id);
}

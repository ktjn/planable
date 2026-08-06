import { db } from '../db';
import type { Container } from '../schema';
import { INBOX_CONTAINER_ID, INBOX_PROJECT_ID } from '../inbox';

export async function listContainersByProject(projectId: string): Promise<Container[]> {
  return db.containers.where('projectId').equals(projectId).sortBy('order');
}

export async function createContainer(projectId: string, name: string): Promise<Container> {
  const count = await db.containers.where('projectId').equals(projectId).count();
  const container: Container = { id: crypto.randomUUID(), projectId, name, order: count };
  await db.containers.add(container);
  return container;
}

export async function renameContainer(id: string, name: string): Promise<void> {
  await db.containers.update(id, { name });
}

export async function reorderContainers(projectId: string, orderedIds: string[]): Promise<void> {
  await db.transaction('rw', db.containers, async () => {
    await Promise.all(orderedIds.map((id, index) => db.containers.update(id, { order: index })));
  });
}

export async function deleteContainer(id: string): Promise<void> {
  if (id === INBOX_CONTAINER_ID) {
    throw new Error('Cannot delete the Inbox container');
  }
  await db.transaction('rw', db.containers, db.tasks, async () => {
    const tasks = await db.tasks.where('containerId').equals(id).toArray();
    await Promise.all(
      tasks.map((t) =>
        db.tasks.update(t.id, { containerId: INBOX_CONTAINER_ID, projectId: INBOX_PROJECT_ID }),
      ),
    );
    await db.containers.delete(id);
  });
}

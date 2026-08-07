import { db } from '../db';
import type { Container, KanbanStatus, WeekDay } from '../schema';
import { INBOX_CONTAINER_ID, INBOX_PROJECT_ID } from '../inbox';

export async function listContainersByProject(projectId: string): Promise<Container[]> {
  return db.containers.where('projectId').equals(projectId).sortBy('order');
}

export async function listContainersByWeek(weekId: string): Promise<Container[]> {
  return db.containers.where('weekly.weekId').equals(weekId).toArray();
}

export async function addContainerToWeek(containerId: string, weekId: string): Promise<void> {
  await db.containers.update(containerId, { weekly: { weekId, day: 'Unplanned' } });
}

export async function setContainerWeeklyDay(containerId: string, day: WeekDay): Promise<void> {
  const container = await db.containers.get(containerId);
  if (!container?.weekly) return;
  await db.containers.update(containerId, { weekly: { ...container.weekly, day } });
}

export async function removeContainerFromWeek(containerId: string): Promise<void> {
  await db.containers.update(containerId, { weekly: null });
}

export async function createContainer(projectId: string, name: string): Promise<Container> {
  const count = await db.containers.where('projectId').equals(projectId).count();
  const container: Container = {
    id: crypto.randomUUID(),
    projectId,
    name,
    order: count,
    labels: [],
    archived: false,
    weekly: null,
    kanban: null,
  };
  await db.containers.add(container);
  return container;
}

export async function updateContainer(
  id: string,
  changes: Partial<Pick<Container, 'name' | 'labels'>>,
): Promise<void> {
  await db.containers.update(id, changes);
}

export async function renameContainer(id: string, name: string): Promise<void> {
  await updateContainer(id, { name });
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

export async function addContainerToKanban(containerId: string): Promise<void> {
  await db.containers.update(containerId, { kanban: { status: 'Todo' } });
}

export async function setContainerKanbanStatus(
  containerId: string,
  status: KanbanStatus,
): Promise<void> {
  await db.containers.update(containerId, { kanban: { status } });
}

export async function removeContainerFromKanban(containerId: string): Promise<void> {
  await db.containers.update(containerId, { kanban: null });
}

export async function setContainerArchived(containerId: string, archived: boolean): Promise<void> {
  if (containerId === INBOX_CONTAINER_ID) {
    throw new Error('Cannot archive the Inbox container');
  }
  await db.transaction('rw', db.containers, async () => {
    const container = await db.containers.get(containerId);
    if (!container) return;
    const changes: Partial<Container> = { archived };
    if (archived) {
      changes.weekly = null;
      changes.kanban = null;
    }
    await db.containers.update(containerId, changes);
  });
}

import { db } from '../db';
import type { Task } from '../schema';
import { INBOX_PROJECT_ID, INBOX_CONTAINER_ID } from '../inbox';

export async function listTasksByContainer(containerId: string): Promise<Task[]> {
  return db.tasks.where('containerId').equals(containerId).toArray();
}

export async function createTask(input: {
  title: string;
  description?: string;
  labels?: string[];
  projectId: string;
  containerId: string;
}): Promise<Task> {
  const task: Task = {
    id: crypto.randomUUID(),
    title: input.title,
    description: input.description ?? '',
    labels: input.labels ?? [],
    projectId: input.projectId,
    containerId: input.containerId,
    completed: false,
    completedDate: null,
    kanban: null,
    weekly: null,
  };
  await db.tasks.add(task);
  return task;
}

export async function createInboxTask(title: string): Promise<Task> {
  return createTask({ title, projectId: INBOX_PROJECT_ID, containerId: INBOX_CONTAINER_ID });
}

export async function updateTask(
  id: string,
  changes: Partial<Pick<Task, 'title' | 'description' | 'labels' | 'projectId' | 'containerId'>>,
): Promise<void> {
  await db.tasks.update(id, changes);
}

export async function setTaskCompleted(id: string, completed: boolean): Promise<void> {
  await db.tasks.update(id, {
    completed,
    completedDate: completed ? Date.now() : null,
  });
}

export async function deleteTask(id: string): Promise<void> {
  await db.tasks.delete(id);
}

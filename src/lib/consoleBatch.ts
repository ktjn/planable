import type { Container, KanbanStatus, Task } from '../db/schema';
import type { ConsoleItemResult } from './consoleSearch';
import { setTaskCompleted, setTaskArchived, updateTask } from '../db/repositories/tasks';
import { setContainerArchived, setContainerKanbanStatus, updateContainer } from '../db/repositories/containers';

export type BatchOperation =
  | { type: 'complete'; value: boolean }
  | { type: 'archive'; value: boolean }
  | { type: 'kanbanStatus'; status: KanbanStatus }
  | { type: 'addLabel'; labelId: string }
  | { type: 'removeLabel'; labelId: string };

export interface BatchContext {
  tasks: Task[];
  containers: Container[];
}

function withLabel(labels: string[], labelId: string): string[] {
  return labels.includes(labelId) ? labels : [...labels, labelId];
}

function withoutLabel(labels: string[], labelId: string): string[] {
  return labels.filter((id) => id !== labelId);
}

/**
 * Applies one bulk operation to every selected console result that supports
 * it, silently skipping results of the wrong kind (e.g. `complete` ignores
 * containers) rather than failing the whole batch.
 */
export async function applyBatchOperation(
  selected: ConsoleItemResult[],
  operation: BatchOperation,
  ctx: BatchContext,
): Promise<void> {
  const taskById = new Map(ctx.tasks.map((t) => [t.id, t]));
  const containerById = new Map(ctx.containers.map((c) => [c.id, c]));

  const jobs: Promise<unknown>[] = [];

  for (const result of selected) {
    const id = result.id;

    switch (operation.type) {
      case 'complete': {
        if (result.kind === 'task') jobs.push(setTaskCompleted(id, operation.value));
        break;
      }
      case 'archive': {
        if (result.kind === 'task') jobs.push(setTaskArchived(id, operation.value));
        else if (result.kind === 'container') jobs.push(setContainerArchived(id, operation.value).catch(() => {}));
        break;
      }
      case 'kanbanStatus': {
        if (result.kind === 'container') jobs.push(setContainerKanbanStatus(id, operation.status));
        break;
      }
      case 'addLabel': {
        if (result.kind === 'task') {
          const task = taskById.get(id);
          if (task) jobs.push(updateTask(id, { labels: withLabel(task.labels, operation.labelId) }));
        } else if (result.kind === 'container') {
          const container = containerById.get(id);
          if (container) jobs.push(updateContainer(id, { labels: withLabel(container.labels, operation.labelId) }));
        }
        break;
      }
      case 'removeLabel': {
        if (result.kind === 'task') {
          const task = taskById.get(id);
          if (task) jobs.push(updateTask(id, { labels: withoutLabel(task.labels, operation.labelId) }));
        } else if (result.kind === 'container') {
          const container = containerById.get(id);
          if (container) jobs.push(updateContainer(id, { labels: withoutLabel(container.labels, operation.labelId) }));
        }
        break;
      }
    }
  }

  await Promise.all(jobs);
}

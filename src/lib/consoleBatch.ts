import type { Container, KanbanStatus, Task } from '../db/schema';
import type { ConsoleEntityKind } from './consoleQuery';
import { deleteTask, setTaskCompleted, setTaskArchived, updateTask } from '../db/repositories/tasks';
import { deleteContainer, setContainerArchived, setContainerKanbanStatus, updateContainer } from '../db/repositories/containers';
import { deleteProject } from '../db/repositories/projects';
import { deleteLabel } from '../db/repositories/labels';

export type BatchOperation =
  | { type: 'complete'; value: boolean }
  | { type: 'archive'; value: boolean }
  | { type: 'kanbanStatus'; status: KanbanStatus }
  | { type: 'addLabel'; labelId: string }
  | { type: 'removeLabel'; labelId: string }
  | { type: 'delete' };

export interface BatchContext {
  tasks: Task[];
  containers: Container[];
}

/** Anything with an entity id and a console kind can be batch-targeted — a full ConsoleItemResult isn't required. */
export interface BatchTarget {
  id: string;
  kind: ConsoleEntityKind;
}

export function withLabel(labels: string[], labelId: string): string[] {
  return labels.includes(labelId) ? labels : [...labels, labelId];
}

export function withoutLabel(labels: string[], labelId: string): string[] {
  return labels.filter((id) => id !== labelId);
}

/**
 * Computes the field patch a BatchOperation would write to a given task or
 * container, without writing it — used to preview a staged (sandboxed) SQL
 * UPDATE against live data before it's committed. Returns null for
 * operations that don't apply to the entity's kind.
 */
export function computeBatchPatch(
  entity: Task | Container,
  kind: ConsoleEntityKind,
  operation: BatchOperation,
): Partial<Task & Container> | null {
  switch (operation.type) {
    case 'complete':
      return kind === 'task' ? { completed: operation.value, completedDate: operation.value ? Date.now() : null } : null;
    case 'archive':
      return kind === 'task' || kind === 'container' ? { archived: operation.value } : null;
    case 'kanbanStatus':
      return kind === 'container' ? { kanban: { status: operation.status } } : null;
    case 'addLabel':
      return kind === 'task' || kind === 'container'
        ? { labels: withLabel((entity as Task | Container).labels, operation.labelId) }
        : null;
    case 'removeLabel':
      return kind === 'task' || kind === 'container'
        ? { labels: withoutLabel((entity as Task | Container).labels, operation.labelId) }
        : null;
    case 'delete':
      // Deletion removes the row rather than patching a field; callers branch on
      // operation.type === 'delete' before reaching computeBatchPatch.
      return null;
  }
}

/**
 * Applies one bulk operation to every selected target that supports it,
 * silently skipping targets of the wrong kind (e.g. `complete` ignores
 * containers) rather than failing the whole batch.
 */
export async function applyBatchOperation(
  selected: BatchTarget[],
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
      case 'delete': {
        // Protected entities (e.g. the Inbox project/container) throw; skip rather than aborting the batch.
        if (result.kind === 'task') jobs.push(deleteTask(id).catch(() => {}));
        else if (result.kind === 'container') jobs.push(deleteContainer(id).catch(() => {}));
        else if (result.kind === 'project') jobs.push(deleteProject(id).catch(() => {}));
        else if (result.kind === 'label') jobs.push(deleteLabel(id).catch(() => {}));
        break;
      }
    }
  }

  await Promise.all(jobs);
}

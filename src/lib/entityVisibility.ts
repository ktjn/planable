import type { Container, Task } from '../db/schema';

/**
 * Shared archive-visibility rules used by every default view.
 *
 * A Container is visible unless it is archived. A Task is visible unless it is
 * archived OR its parent Container is archived (effective archive). If the
 * parent Container is missing, we fall back to the Task's own archive flag.
 */
export function isContainerVisible(container: Container): boolean {
  return !container.archived;
}

export function isTaskVisible(task: Task, containerById: Map<string, Container>): boolean {
  return !isTaskEffectivelyArchived(task, containerById);
}

export function isTaskEffectivelyArchived(
  task: Task,
  containerById: Map<string, Container>,
): boolean {
  if (task.archived) return true;
  const container = containerById.get(task.containerId);
  if (!container) return false;
  return container.archived;
}

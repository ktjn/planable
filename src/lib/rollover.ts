import { db } from '../db/db';
import type { Container, Task, WeekDay } from '../db/schema';
import { listWeekTemplates } from '../db/repositories/weekTemplates';
import { getNextWeekId } from './week';

export function isClosingWeekUnresolved(task: Task): boolean {
  return !task.completed && !task.weekly?.repeatWeekly;
}

export async function listWeekTasks(weekId: string): Promise<Task[]> {
  return db.tasks.where('weekly.weekId').equals(weekId).toArray();
}

/**
 * Returns the tasks in the closing week that still need a manual resolution:
 * every unfinished, non-repeat task. Never moves anything itself.
 */
export async function getUnresolvedTasks(weekId: string): Promise<Task[]> {
  const tasks = await listWeekTasks(weekId);
  return tasks.filter(isClosingWeekUnresolved);
}

/**
 * Auto-step: for every repeat-every-week task in the closing week, spawn a
 * fresh instance into the new week from its template and clear the old
 * instance's weekly membership. Completed tasks simply have their weekly
 * membership cleared — they're done and need no manual resolution.
 */
export async function autoHandleClosingWeek(weekId: string): Promise<void> {
  const nextWeekId = getNextWeekId(weekId);
  const tasks = await listWeekTasks(weekId);
  const templates = await listWeekTemplates();
  const templatesByTask = new Map(templates.map((t) => [t.taskId, t]));

  await db.transaction('rw', db.tasks, db.weekTemplates, async () => {
    for (const task of tasks) {
      if (task.weekly?.repeatWeekly) {
        const template = templatesByTask.get(task.id);
        if (template) {
          await db.tasks.add({
            id: crypto.randomUUID(),
            title: template.title,
            description: template.description,
            labels: template.labels,
            projectId: template.projectId,
            containerId: template.containerId,
            completed: false,
            completedDate: null,
            archived: false,
            weekly: { weekId: nextWeekId, day: 'Unplanned' as WeekDay, repeatWeekly: true },
          });
        }
      }
      await db.tasks.update(task.id, { weekly: null });
    }
  });
}

export type ContainerResolutionAction = 'move' | 'return';

export async function listWeekContainers(weekId: string): Promise<Container[]> {
  return db.containers.where('weekly.weekId').equals(weekId).toArray();
}

/**
 * Returns every Container scheduled in the closing week. Containers have no
 * completion or repeat concept, so every scheduled Container needs a manual
 * choice: move to next week, or return to its project. Never moves anything.
 */
export async function getUnresolvedContainers(weekId: string): Promise<Container[]> {
  return listWeekContainers(weekId);
}

/**
 * Resolve a single Container from the closing week. Only ever touches the one
 * Container's weekly membership; child Tasks are left byte-for-byte unchanged.
 */
export async function resolveContainer(
  containerId: string,
  action: ContainerResolutionAction,
): Promise<void> {
  const container = await db.containers.get(containerId);
  if (!container?.weekly) return;
  switch (action) {
    case 'move': {
      const nextWeekId = getNextWeekId(container.weekly.weekId);
      await db.containers.update(containerId, {
        weekly: { weekId: nextWeekId, day: 'Unplanned' as WeekDay },
      });
      break;
    }
    case 'return':
      await db.containers.update(containerId, { weekly: null });
      break;
  }
}

export type ResolutionAction = 'move' | 'return' | 'complete' | 'delete';

/**
 * Resolve a single unfinished task from the closing week. Only ever touches
 * the one task.
 */
export async function resolveTask(taskId: string, action: ResolutionAction): Promise<void> {
  const task = await db.tasks.get(taskId);
  if (!task) return;
  switch (action) {
    case 'move': {
      const nextWeekId = getNextWeekId(task.weekly!.weekId);
      await db.tasks.update(taskId, {
        weekly: { weekId: nextWeekId, day: 'Unplanned' as WeekDay, repeatWeekly: false },
      });
      break;
    }
    case 'return':
      await db.tasks.update(taskId, { weekly: null });
      break;
    case 'complete':
      await db.tasks.update(taskId, { completed: true, completedDate: Date.now(), weekly: null });
      break;
    case 'delete':
      await db.tasks.delete(taskId);
      break;
  }
}

import { db } from '../db/db';
import type { Task, WeekDay } from '../db/schema';
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
          const count = await db.tasks.where('containerId').equals(template.containerId).count();
          const globalCount = await db.tasks.count();
          await db.tasks.add({
            id: crypto.randomUUID(),
            title: template.title,
            description: template.description,
            labels: template.labels,
            projectId: template.projectId,
            containerId: template.containerId,
            order: count,
            globalOrder: globalCount,
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

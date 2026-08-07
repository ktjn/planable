import { db } from '../db';
import type { WeekDay } from '../schema';
import { getActiveWeekId } from '../../lib/activeWeek';
import { deleteWeekTemplate, upsertWeekTemplate } from './weekTemplates';

/**
 * Archives a Task, clearing its Weekly membership and removing any repeating
 * template so it cannot recur while archived. Unarchiving restores nothing.
 */
export async function setTaskArchived(taskId: string, archived: boolean): Promise<void> {
  await db.transaction('rw', db.tasks, db.weekTemplates, async () => {
    const task = await db.tasks.get(taskId);
    if (!task) return;
    const changes: { archived: boolean; weekly?: null } = { archived };
    if (archived) {
      changes.weekly = null;
      await deleteWeekTemplate(taskId);
    }
    await db.tasks.update(taskId, changes);
  });
}

export async function addToWeek(taskId: string, weekId?: string): Promise<void> {
  const targetWeek = weekId ?? (await getActiveWeekId());
  await db.tasks.update(taskId, {
    weekly: { weekId: targetWeek, day: 'Unplanned', repeatWeekly: false },
  });
}

export async function setWeeklyDay(taskId: string, day: WeekDay): Promise<void> {
  const task = await db.tasks.get(taskId);
  if (!task?.weekly) return;
  await db.tasks.update(taskId, { weekly: { ...task.weekly, day } });
}

export async function removeFromWeek(taskId: string): Promise<void> {
  await db.tasks.update(taskId, { weekly: null });
}

/**
 * Marks a task as repeating every week. When enabled, the task's definition is
 * stored as a WeeklyTemplate so a fresh instance is spawned on every rollover.
 * When disabled, the template linkage is removed.
 */
export async function setTaskRepeatWeekly(taskId: string, repeat: boolean): Promise<void> {
  const task = await db.tasks.get(taskId);
  if (!task) return;

  if (repeat) {
    const weekId = task.weekly?.weekId ?? (await getActiveWeekId());
    await upsertWeekTemplate({
      taskId: task.id,
      title: task.title,
      description: task.description,
      labels: task.labels,
      projectId: task.projectId,
      containerId: task.containerId,
    });
    await db.tasks.update(taskId, {
      weekly: {
        weekId,
        day: task.weekly?.day ?? 'Unplanned',
        repeatWeekly: true,
      },
    });
  } else {
    await deleteWeekTemplate(taskId);
    const weekId = task.weekly?.weekId ?? (await getActiveWeekId());
    await db.tasks.update(taskId, {
      weekly: {
        weekId,
        day: task.weekly?.day ?? 'Unplanned',
        repeatWeekly: false,
      },
    });
  }
}

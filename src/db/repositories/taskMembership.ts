import { db } from '../db';
import type { WeekDay } from '../schema';
import { getActiveWeekId } from '../../lib/activeWeek';
import { deleteWeekTemplate, upsertWeekTemplate } from './weekTemplates';

async function nextWeeklyOrder(weekId: string, day: WeekDay): Promise<number> {
  const tasks = await db.tasks
    .where('weekly.weekId')
    .equals(weekId)
    .and((t) => t.weekly?.day === day)
    .toArray();
  const max = tasks.reduce((m, t) => Math.max(m, t.weekly?.order ?? -1), -1);
  return max + 1;
}

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
  const order = await nextWeeklyOrder(targetWeek, 'Unplanned');
  await db.tasks.update(taskId, {
    weekly: { weekId: targetWeek, day: 'Unplanned', repeatWeekly: false, order },
  });
}

export async function setWeeklyDay(taskId: string, day: WeekDay): Promise<void> {
  const task = await db.tasks.get(taskId);
  if (!task?.weekly) return;
  if (task.weekly.day === day) return;
  const order = await nextWeeklyOrder(task.weekly.weekId, day);
  await db.tasks.update(taskId, { weekly: { ...task.weekly, day, order } });
}

export async function reorderWeeklyTasks(
  weekId: string,
  day: WeekDay,
  orderedIds: string[],
): Promise<void> {
  await db.transaction('rw', db.tasks, async () => {
    await Promise.all(
      orderedIds.map(async (id, index) => {
        const task = await db.tasks.get(id);
        if (!task?.weekly || task.weekly.weekId !== weekId || task.weekly.day !== day) return;
        await db.tasks.update(id, { weekly: { ...task.weekly, order: index } });
      }),
    );
  });
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

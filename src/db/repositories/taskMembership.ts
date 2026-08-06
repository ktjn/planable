import { db } from '../db';
import type { KanbanStatus, WeekDay } from '../schema';
import { setTaskCompleted } from './tasks';
import { getActiveWeekId } from '../../lib/activeWeek';
import { deleteWeekTemplate, upsertWeekTemplate } from './weekTemplates';

export async function addToKanban(taskId: string): Promise<void> {
  await db.tasks.update(taskId, { kanban: { status: 'Todo' } });
}

export async function setKanbanStatus(taskId: string, status: KanbanStatus): Promise<void> {
  await db.tasks.update(taskId, { kanban: { status } });
  if (status === 'Done') {
    await setTaskCompleted(taskId, true);
  }
}

export async function removeFromKanban(taskId: string): Promise<void> {
  await db.tasks.update(taskId, { kanban: null });
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

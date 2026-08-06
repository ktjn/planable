import { db } from '../db';
import type { KanbanStatus, WeekDay } from '../schema';
import { setTaskCompleted } from './tasks';

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

export async function addToWeek(taskId: string, weekId: string): Promise<void> {
  await db.tasks.update(taskId, {
    weekly: { weekId, day: 'Unplanned', repeatWeekly: false },
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

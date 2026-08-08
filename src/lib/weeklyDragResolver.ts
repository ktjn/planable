import { arrayMove } from '@dnd-kit/sortable';
import type { Task, WeekDay } from '../db/schema';
import { sortWeeklyTasks } from './weeklyOrder';

export type WeeklyDragData = 
  | { type: 'weekly-task'; taskId: string; day: WeekDay }
  | { type: 'weekly-day'; day: WeekDay };

export interface WeeklyDragResolution {
  type: 'move-to-day' | 'reorder-in-day' | 'none';
  taskId: string;
  targetDay: WeekDay;
  newOrder?: string[];
}

export function resolveWeeklyDrag(
  activeId: string,
  overId: string,
  activeData: WeeklyDragData | undefined,
  overData: WeeklyDragData | undefined,
  tasks: Task[],
  weekId: string
): WeeklyDragResolution {
  if (!activeData || activeData.type !== 'weekly-task') return { type: 'none', taskId: activeId, targetDay: 'Unplanned' };

  const taskId = activeData.taskId;
  const currentDay = activeData.day;

  // Dropped on a day column
  if (overData?.type === 'weekly-day') {
    const targetDay = overData.day;
    if (targetDay === currentDay) return { type: 'none', taskId, targetDay };
    return { type: 'move-to-day', taskId, targetDay };
  }

  // Dropped on another task
  if (overData?.type === 'weekly-task') {
    const targetDay = overData.day;
    const overTaskId = overData.taskId;

    if (targetDay !== currentDay) {
      return { type: 'move-to-day', taskId, targetDay };
    }

    // Same day reorder
    const dayTasks = sortWeeklyTasks(tasks.filter((t) => t.weekly?.day === currentDay && t.weekly?.weekId === weekId));
    const oldIndex = dayTasks.findIndex((t) => t.id === taskId);
    const newIndex = dayTasks.findIndex((t) => t.id === overTaskId);

    if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return { type: 'none', taskId, targetDay };

    const newOrder = arrayMove(dayTasks, oldIndex, newIndex).map((t) => t.id);
    return { type: 'reorder-in-day', taskId, targetDay, newOrder };
  }

  return { type: 'none', taskId, targetDay: currentDay };
}

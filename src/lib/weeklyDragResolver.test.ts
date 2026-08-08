import { describe, it, expect } from 'vitest';
import { resolveWeeklyDrag } from './weeklyDragResolver';
import type { Task } from '../db/schema';

describe('resolveWeeklyDrag', () => {
  const weekId = '2026-W32';
  const tasks: Task[] = [
    { id: '1', title: 'Task 1', weekly: { weekId, day: 'Mon', order: 0, repeatWeekly: false }, projectId: 'p1', containerId: 'c1', completed: false, labels: [] } as any as Task,
    { id: '2', title: 'Task 2', weekly: { weekId, day: 'Mon', order: 1, repeatWeekly: false }, projectId: 'p1', containerId: 'c1', completed: false, labels: [] } as any as Task,
    { id: '3', title: 'Task 3', weekly: { weekId, day: 'Tue', order: 0, repeatWeekly: false }, projectId: 'p1', containerId: 'c1', completed: false, labels: [] } as any as Task,
  ];

  it('resolves move to a different day column', () => {
    const res = resolveWeeklyDrag(
      'task:1',
      'day:Tue',
      { type: 'weekly-task', taskId: '1', day: 'Mon' },
      { type: 'weekly-day', day: 'Tue' },
      tasks,
      weekId
    );
    expect(res).toEqual({
      type: 'move-to-day',
      taskId: '1',
      targetDay: 'Tue',
    });
  });

  it('resolves move to a task in a different day', () => {
    const res = resolveWeeklyDrag(
      'task:1',
      'task:3',
      { type: 'weekly-task', taskId: '1', day: 'Mon' },
      { type: 'weekly-task', taskId: '3', day: 'Tue' },
      tasks,
      weekId
    );
    expect(res).toEqual({
      type: 'move-to-day',
      taskId: '1',
      targetDay: 'Tue',
    });
  });

  it('resolves reorder in the same day', () => {
    const res = resolveWeeklyDrag(
      'task:1',
      'task:2',
      { type: 'weekly-task', taskId: '1', day: 'Mon' },
      { type: 'weekly-task', taskId: '2', day: 'Mon' },
      tasks,
      weekId
    );
    expect(res.type).toBe('reorder-in-day');
    expect(res.taskId).toBe('1');
    expect(res.targetDay).toBe('Mon');
    expect(res.newOrder).toEqual(['2', '1']);
  });

  it('resolves to none when dropping on self', () => {
    const res = resolveWeeklyDrag(
      'task:1',
      'task:1',
      { type: 'weekly-task', taskId: '1', day: 'Mon' },
      { type: 'weekly-task', taskId: '1', day: 'Mon' },
      tasks,
      weekId
    );
    expect(res.type).toBe('none');
  });

  it('resolves to none when dropping on same day column', () => {
    const res = resolveWeeklyDrag(
      'task:1',
      'day:Mon',
      { type: 'weekly-task', taskId: '1', day: 'Mon' },
      { type: 'weekly-day', day: 'Mon' },
      tasks,
      weekId
    );
    expect(res.type).toBe('none');
  });
});

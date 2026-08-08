import { describe, it, expect } from 'vitest';
import { sortWeeklyTasks } from './weeklyOrder';
import type { Task } from '../db/schema';

function task(id: string, overrides: Partial<Task> = {}): Task {
  return {
    id,
    title: id,
    description: '',
    labels: [],
    projectId: 'p',
    containerId: 'c',
    order: 0,
    completed: false,
    completedDate: null,
    archived: false,
    weekly: { weekId: '2026-W32', day: 'Mon', repeatWeekly: false, order: 0 },
    ...overrides,
  };
}

describe('sortWeeklyTasks', () => {
  it('places open tasks before completed tasks', () => {
    const completed = task('done', { completed: true, completedDate: 1, weekly: { weekId: 'w', day: 'Mon', repeatWeekly: false, order: 0 } });
    const open = task('open', { completed: false, weekly: { weekId: 'w', day: 'Mon', repeatWeekly: false, order: 5 } });
    expect(sortWeeklyTasks([completed, open]).map((t) => t.id)).toEqual(['open', 'done']);
  });

  it('sorts open tasks by weekly.order', () => {
    const a = task('a', { weekly: { weekId: 'w', day: 'Mon', repeatWeekly: false, order: 2 } });
    const b = task('b', { weekly: { weekId: 'w', day: 'Mon', repeatWeekly: false, order: 1 } });
    expect(sortWeeklyTasks([a, b]).map((t) => t.id)).toEqual(['b', 'a']);
  });

  it('sorts completed tasks by completedDate descending', () => {
    const old = task('old', { completed: true, completedDate: 100, weekly: { weekId: 'w', day: 'Mon', repeatWeekly: false, order: 0 } });
    const recent = task('recent', { completed: true, completedDate: 500, weekly: { weekId: 'w', day: 'Mon', repeatWeekly: false, order: 0 } });
    expect(sortWeeklyTasks([old, recent]).map((t) => t.id)).toEqual(['recent', 'old']);
  });
});

import type { Task } from '../db/schema';

export function sortWeeklyTasks(tasks: Task[]): Task[] {
  const open: Task[] = [];
  const completed: Task[] = [];
  for (const t of tasks) {
    if (t.completed) completed.push(t);
    else open.push(t);
  }
  open.sort((a, b) => {
    const ao = a.weekly?.order ?? Number.MAX_SAFE_INTEGER;
    const bo = b.weekly?.order ?? Number.MAX_SAFE_INTEGER;
    if (ao !== bo) return ao - bo;
    return a.id.localeCompare(b.id);
  });
  completed.sort((a, b) => {
    const ad = a.completedDate ?? 0;
    const bd = b.completedDate ?? 0;
    if (bd !== ad) return bd - ad;
    return a.id.localeCompare(b.id);
  });
  return [...open, ...completed];
}

// src/components/tasks/AllTasksView.tsx
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { ListChecks } from 'lucide-react';
import { db } from '../../db/db';
import { setTaskCompleted } from '../../db/repositories/tasks';
import { fireAndForget } from '../../lib/fireAndForget';
import type { Task } from '../../db/schema';
import { Checkbox } from '../ui/checkbox';
import { Badge } from '../ui/badge';
import { TaskDialog } from '../projects/TaskDialog';

export function AllTasksView() {
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const tasks = useLiveQuery(
    () => db.tasks.toArray().then((arr) => arr.sort((a, b) => a.title.localeCompare(b.title))),
    [],
    [],
  );
  const projects = useLiveQuery(() => db.projects.toArray(), [], []);
  const projectById = new Map((projects ?? []).map((p) => [p.id, p]));

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center gap-3">
        <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <ListChecks className="size-4" />
        </div>
        <div>
          <h2 className="text-lg font-semibold tracking-tight">All Tasks</h2>
          <p className="text-sm text-muted-foreground">Every task across every project</p>
        </div>
      </div>
      <ul className="flex flex-col gap-1.5">
        {tasks.map((task) => (
          <li
            key={task.id}
            className="flex items-center gap-2 rounded-xl border border-border/70 bg-card px-3 py-2.5 shadow-sm"
          >
            <Checkbox
              checked={task.completed}
              aria-label={`Toggle completed for ${task.title}`}
              onCheckedChange={(checked) => fireAndForget(setTaskCompleted(task.id, checked))}
            />
            <button
              className={`min-w-0 flex-1 truncate text-left text-sm ${
                task.completed ? 'text-muted-foreground line-through' : 'text-foreground'
              }`}
              onClick={() => setEditingTask(task)}
            >
              {task.title}
            </button>
            {projectById.get(task.projectId) && (
              <span className="shrink-0 text-xs text-muted-foreground">
                {projectById.get(task.projectId)!.name}
              </span>
            )}
            {task.kanban && (
              <Badge variant="secondary" className="shrink-0">
                Kanban: {task.kanban.status}
              </Badge>
            )}
            {task.weekly && (
              <Badge variant="secondary" className="shrink-0">
                {task.weekly.repeatWeekly ? 'Repeats weekly' : `Week: ${task.weekly.day}`}
              </Badge>
            )}
          </li>
        ))}
        {tasks.length === 0 && (
          <li className="py-10 text-center text-sm text-muted-foreground">No tasks yet.</li>
        )}
      </ul>
      {editingTask && (
        <TaskDialog
          mode="edit"
          projectId={editingTask.projectId}
          containerId={editingTask.containerId}
          task={editingTask}
          onClose={() => setEditingTask(null)}
        />
      )}
    </div>
  );
}

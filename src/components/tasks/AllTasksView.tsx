// src/components/tasks/AllTasksView.tsx
import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { ListChecks } from 'lucide-react';
import { db } from '../../db/db';
import { listLabels } from '../../db/repositories/labels';
import { isTaskVisible } from '../../lib/entityVisibility';
import type { Task } from '../../db/schema';
import { TaskDialog } from '../projects/TaskDialog';
import { TaskCard } from '../projects/TaskCard';

export function AllTasksView() {
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const tasks = useLiveQuery(
    () => db.tasks.toArray().then((arr) => arr.sort((a, b) => a.title.localeCompare(b.title))),
    [],
    [],
  );
  const projects = useLiveQuery(() => db.projects.toArray(), [], []);
  const containers = useLiveQuery(() => db.containers.toArray(), [], []);
  const labels = useLiveQuery(listLabels, [], []);
  const projectById = useMemo(() => new Map((projects ?? []).map((p) => [p.id, p])), [projects]);
  const containerById = useMemo(
    () => new Map((containers ?? []).map((c) => [c.id, c])),
    [containers],
  );
  const labelsById = useMemo(() => new Map((labels ?? []).map((l) => [l.id, l])), [labels]);
  const visibleTasks = (tasks ?? []).filter((t) => isTaskVisible(t, containerById));

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
        {visibleTasks.map((task) => (
          <li key={task.id}>
            <TaskCard
              task={task}
              labelsById={labelsById}
              projectById={projectById}
              containerById={containerById}
              sortableId={null}
              showAddToWeek={false}
              onEdit={setEditingTask}
              extra={
                projectById.get(task.projectId) && (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {projectById.get(task.projectId)!.name}
                  </span>
                )
              }
            />
          </li>
        ))}
        {visibleTasks.length === 0 && (
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

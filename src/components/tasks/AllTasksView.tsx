// src/components/tasks/AllTasksView.tsx
import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { ListChecks } from 'lucide-react';
import { db } from '../../db/db';
import { listLabels } from '../../db/repositories/labels';
import { isTaskVisible } from '../../lib/entityVisibility';
import { useScrollHighlight, type HighlightRequest } from '../../lib/useScrollHighlight';
import type { Task } from '../../db/schema';
import { TaskDialog } from '../projects/TaskDialog';
import { TaskCard } from '../projects/TaskCard';
import { Checkbox } from '../ui/checkbox';
import { Badge } from '../ui/badge';

export function AllTasksView({ highlight }: { highlight?: HighlightRequest | null }) {
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const highlighted = useScrollHighlight(highlight);
  const allTasks = useLiveQuery(() => db.tasks.toArray(), [], []);
  const projects = useLiveQuery(() => db.projects.toArray(), [], []);
  const containers = useLiveQuery(() => db.containers.toArray(), [], []);
  const labels = useLiveQuery(listLabels, [], []);
  const projectById = useMemo(() => new Map((projects ?? []).map((p) => [p.id, p])), [projects]);
  const containerById = useMemo(
    () => new Map((containers ?? []).map((c) => [c.id, c])),
    [containers],
  );
  const labelsById = useMemo(() => new Map((labels ?? []).map((l) => [l.id, l])), [labels]);

  const filteredTasks = useMemo(() => {
    return (allTasks ?? []).filter((t) => {
      if (showArchived) return true;
      return isTaskVisible(t, containerById);
    });
  }, [allTasks, showArchived, containerById]);

  const sortedTasks = useMemo(() => {
    const open = filteredTasks.filter((t) => !t.completed);
    const done = filteredTasks.filter((t) => t.completed);
    open.sort((a, b) => a.title.localeCompare(b.title));
    done.sort(
      (a, b) => (b.completedDate ?? 0) - (a.completedDate ?? 0) || a.title.localeCompare(b.title),
    );
    return [...open, ...done];
  }, [filteredTasks]);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <ListChecks className="size-4" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">All Tasks</h2>
            <p className="text-sm text-muted-foreground">Every task across every project</p>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
          <Checkbox
            checked={showArchived}
            onCheckedChange={(checked) => setShowArchived(Boolean(checked))}
            aria-label="Show archived tasks"
          />
          <span>Show archived</span>
        </label>
      </div>
      <ul className="flex flex-col gap-1.5">
        {sortedTasks.map((task) => (
          <li key={task.id}>
            <TaskCard
              task={task}
              labelsById={labelsById}
              projectById={projectById}
              containerById={containerById}
              sortableId={null}
              showAddToWeek={false}
              onEdit={setEditingTask}
              highlighted={highlighted === `task-${task.id}`}
              extra={
                <div className="flex items-center gap-1.5">
                  {projectById.get(task.projectId) && (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {projectById.get(task.projectId)!.name}
                    </span>
                  )}
                  {task.archived && (
                    <Badge variant="outline" className="text-xs text-muted-foreground">
                      Archived
                    </Badge>
                  )}
                </div>
              }
            />
          </li>
        ))}
        {sortedTasks.length === 0 && (
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

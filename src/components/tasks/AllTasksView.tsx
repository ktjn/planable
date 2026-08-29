// src/components/tasks/AllTasksView.tsx
import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { ListChecks } from 'lucide-react';
import { db } from '../../db/db';
import { listLabels } from '../../db/repositories/labels';
import { reorderTasksGlobally } from '../../db/repositories/tasks';
import { isTaskVisible } from '../../lib/entityVisibility';
import { fireAndForget } from '../../lib/fireAndForget';
import { useScrollHighlight, type HighlightRequest } from '../../lib/useScrollHighlight';
import type { Task } from '../../db/schema';
import { TaskDialog } from '../projects/TaskDialog';
import { TaskCard } from '../projects/TaskCard';
import { Checkbox } from '../ui/checkbox';
import { Badge } from '../ui/badge';

export function AllTasksView({ highlight }: { highlight?: HighlightRequest | null }) {
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [order, setOrder] = useState<string[]>([]);
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
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const filteredTasks = useMemo(() => {
    return (allTasks ?? []).filter((t) => {
      if (showArchived) return !isTaskVisible(t, containerById);
      return isTaskVisible(t, containerById);
    });
  }, [allTasks, showArchived, containerById]);

  const open = useMemo(
    () =>
      filteredTasks
        .filter((t) => !t.completed)
        .sort((a, b) => (a.globalOrder ?? 0) - (b.globalOrder ?? 0) || a.title.localeCompare(b.title)),
    [filteredTasks],
  );
  const done = useMemo(
    () =>
      filteredTasks
        .filter((t) => t.completed)
        .sort((a, b) => (b.completedDate ?? 0) - (a.completedDate ?? 0) || a.title.localeCompare(b.title)),
    [filteredTasks],
  );

  const openIds = open.map((t) => t.id);
  const orderedOpenIds = order.length === openIds.length ? order : openIds;
  const openSorted = orderedOpenIds
    .map((id) => open.find((t) => t.id === id))
    .filter((t): t is Task => Boolean(t));
  const sortedTasks = [...openSorted, ...done];

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const base = order.length === openIds.length ? order : openIds;
    const oldIndex = base.indexOf(String(active.id));
    const newIndex = base.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(base, oldIndex, newIndex);
    setOrder(next);
    fireAndForget(reorderTasksGlobally(next));
  }

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
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <SortableContext items={orderedOpenIds} strategy={verticalListSortingStrategy}>
          <ul className="flex flex-col gap-1.5">
            {sortedTasks.map((task) => (
              <li key={task.id}>
                <TaskCard
                  task={task}
                  labelsById={labelsById}
                  projectById={projectById}
                  containerById={containerById}
                  sortableId={task.completed ? null : task.id}
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
        </SortableContext>
      </DndContext>
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

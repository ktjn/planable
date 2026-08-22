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
import { useLiveQuery } from 'dexie-react-hooks';
import { listTasksByContainer, reorderTasks } from '../../db/repositories/tasks';
import { fireAndForget } from '../../lib/fireAndForget';
import type { Label, Container, Project } from '../../db/schema';
import { TaskCard } from '../projects/TaskCard';

function byOrder(a: { id: string; order: number }, b: { id: string; order: number }) {
  if (a.order !== b.order) return a.order - b.order;
  return a.id.localeCompare(b.id);
}

/**
 * Renders a Container's Tasks as a drag-and-drop sortable list so Tasks can be
 * reordered inside their Container. Ordering is persisted via `reorderTasks`.
 * Completed tasks sink to the bottom of the list.
 */
export function SortedTaskList({
  containerId,
  labelsById,
  containerById,
  projectById,
}: {
  containerId: string;
  labelsById: Map<string, Label>;
  containerById?: Map<string, Container>;
  projectById?: Map<string, Project>;
}) {
  const tasks = useLiveQuery(() => listTasksByContainer(containerId), [containerId], []);
  const [order, setOrder] = useState<string[]>([]);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const open = useMemo(
    () => (tasks ?? []).filter((t) => !t.archived && !t.completed).sort(byOrder),
    [tasks],
  );
  const done = useMemo(
    () =>
      (tasks ?? [])
        .filter((t) => !t.archived && t.completed)
        .sort((a, b) => (b.completedDate ?? 0) - (a.completedDate ?? 0)),
    [tasks],
  );

  // Sorting key for dnd among open tasks only; completed tasks stay pinned to the bottom.
  const openIds = open.map((t) => t.id);
  const sortedOpenIds = order.length === openIds.length ? order : openIds;

  const openSorted = useMemo(
    () =>
      sortedOpenIds
        .map((id) => open.find((t) => t.id === id))
        .filter((t): t is NonNullable<typeof t> => Boolean(t)),
    [sortedOpenIds, open],
  );

  const sorted = [...openSorted, ...done];

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setOrder((prev) => {
      const base = prev.length === openIds.length ? prev : openIds;
      const oldIndex = base.indexOf(String(active.id));
      const newIndex = base.indexOf(String(over.id));
      if (oldIndex < 0 || newIndex < 0) return prev;
      const nextOpen = arrayMove(base, oldIndex, newIndex);
      // Persist the full container order: open tasks first, then completed.
      fireAndForget(
        reorderTasks(containerId, [...nextOpen, ...done.map((t) => t.id)]),
      );
      return nextOpen;
    });
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <SortableContext items={sortedOpenIds} strategy={verticalListSortingStrategy}>
        <ul className="flex flex-col gap-1 p-1.5">
          {sorted.map((task) => (
            <li key={task.id}>
              <TaskCard
                task={task}
                labelsById={labelsById}
                containerById={containerById}
                projectById={projectById}
                sortableId={task.completed ? null : task.id}
              />
            </li>
          ))}
          {sorted.length === 0 && (
            <li className="px-2 py-4 text-center text-xs text-muted-foreground">No tasks yet.</li>
          )}
        </ul>
      </SortableContext>
    </DndContext>
  );
}

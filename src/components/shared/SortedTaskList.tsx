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

/**
 * Renders a Container's Tasks as a drag-and-drop sortable list so Tasks can be
 * reordered inside their Container. Ordering is persisted via `reorderTasks`.
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

  const ids = tasks.map((t) => t.id);
  const sortedIds = order.length === tasks.length ? order : ids;
  const sorted = useMemo(
    () =>
      sortedIds
        .map((id) => tasks.find((t) => t.id === id))
        .filter((t): t is NonNullable<typeof t> => Boolean(t)),
    [sortedIds, tasks],
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setOrder((prev) => {
      const base = prev.length === tasks.length ? prev : tasks.map((t) => t.id);
      const oldIndex = base.indexOf(String(active.id));
      const newIndex = base.indexOf(String(over.id));
      if (oldIndex < 0 || newIndex < 0) return prev;
      const next = arrayMove(base, oldIndex, newIndex);
      fireAndForget(reorderTasks(containerId, next));
      return next;
    });
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <SortableContext items={sortedIds} strategy={verticalListSortingStrategy}>
        <ul className="flex flex-col gap-1 p-1.5">
          {sorted.map((task) => (
            <li key={task.id}>
              <TaskCard
                task={task}
                labelsById={labelsById}
                containerById={containerById}
                projectById={projectById}
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

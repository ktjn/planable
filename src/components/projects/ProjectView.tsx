import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy } from '@dnd-kit/sortable';
import { listContainersByProject, createContainer, reorderContainers } from '../../db/repositories/containers';
import { updateTask } from '../../db/repositories/tasks';
import { fireAndForget } from '../../lib/fireAndForget';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { ContainerColumn } from './ContainerColumn';

export function ProjectView({ projectId }: { projectId: string }) {
  const containers = useLiveQuery(() => listContainersByProject(projectId), [projectId], []);
  const [newName, setNewName] = useState('');
  const [order, setOrder] = useState<string[]>([]);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const ids = order.length === containers.length ? order : containers.map((c) => c.id);
  const sorted = ids
    .map((id) => containers.find((c) => c.id === id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c));

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const activeId = String(active.id);
    if (!containers.some((c) => c.id === activeId)) return;
    setOrder((prev) => {
      const base = prev.length === containers.length ? prev : containers.map((c) => c.id);
      const oldIndex = base.indexOf(activeId);
      const newIndex = base.indexOf(String(over.id));
      if (oldIndex < 0 || newIndex < 0) return prev;
      return arrayMove(base, oldIndex, newIndex);
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    if (containers.some((c) => c.id === activeId)) {
      const orderedIds = order.length === containers.length ? order : containers.map((c) => c.id);
      fireAndForget(reorderContainers(projectId, orderedIds));
      return;
    }
    fireAndForget(updateTask(activeId, { containerId: String(over.id), projectId }));
  }

  return (
    <div>
      <div className="mb-4 flex gap-2">
        <Input
          className="w-56"
          placeholder="New container name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && newName.trim()) {
              void createContainer(projectId, newName.trim()).then(() => setNewName(''));
            }
          }}
        />
        <Button
          onClick={async () => {
            if (!newName.trim()) return;
            await createContainer(projectId, newName.trim());
            setNewName('');
          }}
        >
          Add container
        </Button>
      </div>
      <DndContext sensors={sensors} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
        <SortableContext items={ids} strategy={rectSortingStrategy}>
          <div className="flex gap-4">
            {sorted.map((container) => (
              <ContainerColumn key={container.id} container={container} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

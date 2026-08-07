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
import { db } from '../../db/db';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Folder, Plus } from 'lucide-react';
import { ContainerColumn } from './ContainerColumn';

export function ProjectView({ projectId }: { projectId: string }) {
  const containers = useLiveQuery(() => listContainersByProject(projectId), [projectId], []);
  const project = useLiveQuery(() => db.projects.get(projectId), [projectId]);
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

  function handleAddContainer() {
    if (!newName.trim()) return;
    void createContainer(projectId, newName.trim()).then(() => setNewName(''));
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <Folder className="size-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold tracking-tight">{project?.name ?? 'Project'}</h2>
            <p className="text-sm text-muted-foreground">
              {containers.length} {containers.length === 1 ? 'container' : 'containers'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Input
            className="w-56"
            placeholder="New container name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddContainer();
            }}
          />
          <Button onClick={handleAddContainer}>
            <Plus />
            Add container
          </Button>
        </div>
      </div>
      {containers.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-muted/30 px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            No containers yet — create one above to start organizing tasks.
          </p>
        </div>
      )}
      <DndContext sensors={sensors} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
        <SortableContext items={ids} strategy={rectSortingStrategy}>
          <div className="flex items-start gap-4 overflow-x-auto pb-2">
            {sorted.map((container) => (
              <ContainerColumn key={container.id} container={container} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { listContainersByProject, createContainer } from '../../db/repositories/containers';
import { updateTask } from '../../db/repositories/tasks';
import { ContainerColumn } from './ContainerColumn';

export function ProjectView({ projectId }: { projectId: string }) {
  const containers = useLiveQuery(() => listContainersByProject(projectId), [projectId], []);
  const [newName, setNewName] = useState('');
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    await updateTask(String(active.id), { containerId: String(over.id), projectId });
  }

  return (
    <div>
      <div className="mb-4 flex gap-2">
        <input
          className="border border-gray-300 px-2 py-1"
          placeholder="New container name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button
          onClick={async () => {
            if (!newName.trim()) return;
            await createContainer(projectId, newName.trim());
            setNewName('');
          }}
        >
          Add container
        </button>
      </div>
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="flex gap-4">
          {containers.map((container) => (
            <ContainerColumn key={container.id} container={container} />
          ))}
        </div>
      </DndContext>
    </div>
  );
}

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useDroppable } from '@dnd-kit/core';
import { listTasksByContainer } from '../../db/repositories/tasks';
import { renameContainer, deleteContainer } from '../../db/repositories/containers';
import type { Container } from '../../db/schema';
import { TaskCard } from './TaskCard';
import { TaskDialog } from './TaskDialog';

export function ContainerColumn({ container }: { container: Container }) {
  const tasks = useLiveQuery(() => listTasksByContainer(container.id), [container.id], []);
  const { setNodeRef } = useDroppable({ id: container.id });

  return (
    <div ref={setNodeRef} data-dnd-droppable className="w-64 shrink-0 rounded border border-gray-200 p-2">
      <div className="mb-2 flex items-center justify-between">
        <input
          className="font-medium"
          defaultValue={container.name}
          onBlur={(e) => {
            if (e.target.value.trim() && e.target.value !== container.name) {
              void renameContainer(container.id, e.target.value.trim());
            }
          }}
        />
        <button
          aria-label={`Delete ${container.name}`}
          onClick={() => void deleteContainer(container.id)}
        >
          ×
        </button>
      </div>
      <ul>
        {tasks.map((task) => (
          <li key={task.id}>
            <TaskCard task={task} />
          </li>
        ))}
      </ul>
      <AddTaskButton projectId={container.projectId} containerId={container.id} />
    </div>
  );
}

function AddTaskButton({ projectId, containerId }: { projectId: string; containerId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>+ Add task</button>
      {open && (
        <TaskDialog mode="create" projectId={projectId} containerId={containerId} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

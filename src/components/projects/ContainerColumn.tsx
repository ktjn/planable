import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useSortable } from '@dnd-kit/sortable';
import { GripVertical } from 'lucide-react';
import { listTasksByContainer } from '../../db/repositories/tasks';
import { renameContainer, deleteContainer } from '../../db/repositories/containers';
import { fireAndForget } from '../../lib/fireAndForget';
import type { Container } from '../../db/schema';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { TaskCard } from './TaskCard';
import { TaskDialog } from './TaskDialog';

export function ContainerColumn({ container }: { container: Container }) {
  const tasks = useLiveQuery(() => listTasksByContainer(container.id), [container.id], []);
  const { setNodeRef, setActivatorNodeRef, listeners, attributes, transform, isDragging } = useSortable({
    id: container.id,
  });

  return (
    <div
      ref={setNodeRef}
      data-dnd-droppable
      data-dnd-draggable
      style={{ transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined }}
      className={`w-64 shrink-0 rounded-xl border bg-card p-2 shadow-sm ${isDragging ? 'opacity-50' : ''}`}
    >
      <div className="mb-2 flex items-center justify-between gap-1">
        <div className="flex min-w-0 flex-1 items-center gap-1">
          <button
            ref={setActivatorNodeRef}
            aria-label={`Reorder ${container.name}`}
            className="shrink-0 cursor-grab touch-none text-muted-foreground"
            {...listeners}
            {...attributes}
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <Input
            className="h-7 border-transparent font-medium focus-visible:border-ring"
            defaultValue={container.name}
            aria-label={`Rename ${container.name}`}
            onBlur={(e) => {
              if (e.target.value.trim() && e.target.value !== container.name) {
                fireAndForget(renameContainer(container.id, e.target.value.trim()));
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
            }}
          />
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Delete ${container.name}`}
          onClick={() => fireAndForget(deleteContainer(container.id))}
        >
          ×
        </Button>
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
      <Button
        variant="ghost"
        className="mt-1 w-full justify-start text-muted-foreground"
        size="sm"
        onClick={() => setOpen(true)}
      >
        + Add task
      </Button>
      {open && (
        <TaskDialog mode="create" projectId={projectId} containerId={containerId} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

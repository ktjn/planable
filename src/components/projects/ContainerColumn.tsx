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
      className={`flex w-64 shrink-0 flex-col rounded-xl border border-border bg-card shadow-sm transition-shadow ${
        isDragging ? 'opacity-50' : 'hover:shadow-md'
      }`}
    >
      <div className="flex items-center justify-between gap-1 border-b border-border/60 px-2 py-2">
        <div className="flex min-w-0 flex-1 items-center gap-1">
          <button
            ref={setActivatorNodeRef}
            aria-label={`Reorder ${container.name}`}
            className="shrink-0 cursor-grab touch-none text-muted-foreground/60 hover:text-muted-foreground"
            {...listeners}
            {...attributes}
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <Input
            className="h-7 border-transparent bg-transparent font-semibold focus-visible:border-ring"
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
        <span className="ml-1 flex items-center gap-1">
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground tabular-nums">
            {tasks.length}
          </span>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={`Delete ${container.name}`}
            className="text-muted-foreground/60 hover:text-destructive"
            onClick={() => fireAndForget(deleteContainer(container.id))}
          >
            ×
          </Button>
        </span>
      </div>
      <ul className="flex flex-col gap-1 p-1.5">
        {tasks.map((task) => (
          <li key={task.id}>
            <TaskCard task={task} />
          </li>
        ))}
      </ul>
      <div className="p-1.5 pt-0">
        <AddTaskButton projectId={container.projectId} containerId={container.id} />
      </div>
    </div>
  );
}

function AddTaskButton({ projectId, containerId }: { projectId: string; containerId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="ghost"
        className="w-full justify-start rounded-md border border-dashed border-border/70 text-muted-foreground hover:border-primary/40 hover:text-foreground"
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

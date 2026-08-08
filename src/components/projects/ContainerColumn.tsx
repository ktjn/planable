import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { useLiveQuery } from 'dexie-react-hooks';
import { GripVertical } from 'lucide-react';
import type { Container, Label, Project } from '../../db/schema';
import { ContainerDialog } from './ContainerDialog';
import { QuickAddRow } from '../shared/QuickAddRow';
import { EntityLabels } from '../shared/EntityLabels';
import { SortedTaskList } from '../shared/SortedTaskList';
import { EntityHoverCard, ContainerHoverCardContent } from '../shared/EntityHoverCard';
import { createTask } from '../../db/repositories/tasks';
import { db } from '../../db/db';

export function ContainerColumn({
  container,
  labelsById,
  projectById,
  containerById,
}: {
  container: Container;
  labelsById: Map<string, Label>;
  projectById?: Map<string, Project>;
  containerById?: Map<string, Container>;
}) {
  const taskCount = useLiveQuery(
    () => db.tasks.where('containerId').equals(container.id).count(),
    [container.id],
    0,
  );
  const { setNodeRef, setActivatorNodeRef, listeners, attributes, transform, isDragging } = useSortable({
    id: container.id,
  });
  const [editing, setEditing] = useState(false);

  return (
    <div
      ref={setNodeRef}
      data-dnd-droppable
      data-dnd-draggable
      style={{
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        transition: isDragging ? 'none' : undefined,
      }}
      className={`flex w-64 shrink-0 flex-col rounded-xl border border-border bg-card shadow-sm ${
        isDragging ? 'opacity-50' : 'hover:shadow-md'
      }`}
    >
      <EntityHoverCard
        disabled={isDragging}
        content={
          <ContainerHoverCardContent
            container={container}
            projectById={projectById ?? new Map()}
            labelsById={labelsById}
            taskCount={taskCount}
          />
        }
      >
        <div
          onDoubleClick={() => setEditing(true)}
          className="flex items-center justify-between gap-1 border-b border-border/60 px-2 py-2"
        >
          <div className="flex min-w-0 flex-1 items-center gap-1">
            <button
              ref={setActivatorNodeRef}
              aria-label={`Reorder ${container.name}`}
              className="shrink-0 cursor-grab touch-none text-muted-foreground/60 hover:text-muted-foreground"
              {...listeners}
              {...attributes}
              onClick={(e) => e.stopPropagation()}
              onDoubleClick={(e) => e.stopPropagation()}
            >
              <GripVertical className="h-4 w-4" />
            </button>
            <div className="min-w-0 flex-1">
              <h3 className="truncate text-sm font-semibold">{container.name}</h3>
              <EntityLabels labelIds={container.labels} labelsById={labelsById} className="mt-0.5" />
            </div>
          </div>
          <span className="ml-1 shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground tabular-nums">
            {taskCount}
          </span>
        </div>
      </EntityHoverCard>
      <SortedTaskList
        containerId={container.id}
        labelsById={labelsById}
        containerById={containerById}
        projectById={projectById}
      />
      <div className="p-1.5 pt-0">
        <QuickAddRow
          onAdd={async (title) => {
            await createTask({ title, projectId: container.projectId, containerId: container.id });
          }}
        />
      </div>
      {editing && <ContainerDialog container={container} onClose={() => setEditing(false)} />}
    </div>
  );
}

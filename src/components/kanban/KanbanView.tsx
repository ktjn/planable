import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { db } from '../../db/db';
import { setContainerKanbanStatus, createContainer } from '../../db/repositories/containers';
import { createTask } from '../../db/repositories/tasks';
import { listLabels } from '../../db/repositories/labels';
import { fireAndForget } from '../../lib/fireAndForget';
import { INBOX_PROJECT_ID } from '../../db/inbox';
import type { Container, KanbanStatus, Label } from '../../db/schema';
import { GripVertical, KanbanSquare, Plus } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { AddToKanbanPicker } from './AddToKanbanPicker';
import { QuickAddRow } from '../shared/QuickAddRow';
import { SortedTaskList } from '../shared/SortedTaskList';
import { EntityLabels } from '../shared/EntityLabels';
import { ContainerDialog } from '../projects/ContainerDialog';

const COLUMNS: KanbanStatus[] = ['Todo', 'Doing', 'Blocked', 'Done'];

const STATUS_ACCENT: Record<KanbanStatus, string> = {
  Todo: 'bg-slate-500/15 text-slate-700 dark:text-slate-400',
  Doing: 'bg-sky-500/15 text-sky-700 dark:text-sky-400',
  Blocked: 'bg-rose-500/15 text-rose-700 dark:text-rose-400',
  Done: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
};

function KanbanCard({
  container,
  projectName,
  labelsById,
}: {
  container: Container;
  projectName: string;
  labelsById: Map<string, Label>;
}) {
  const [editing, setEditing] = useState(false);
  const { setNodeRef, setActivatorNodeRef, listeners, attributes, transform, isDragging } = useDraggable({
    id: container.id,
  });

  return (
    <>
      <li
        ref={setNodeRef}
        data-dnd-draggable
        onDoubleClick={() => setEditing(true)}
        style={{ transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined }}
        className={`flex flex-col rounded-lg border border-border/80 bg-background text-sm text-foreground shadow-sm hover:border-primary/30 hover:shadow-md ${
          isDragging ? 'opacity-50' : ''
        }`}
      >
        <div className="flex items-start justify-between gap-2 px-3 pt-2">
          <div className="min-w-0 flex-1">
            <span className="block truncate font-medium">{container.name}</span>
            <span className="block truncate text-xs text-muted-foreground">{projectName}</span>
          </div>
          <button
            ref={setActivatorNodeRef}
            aria-label={`Drag ${container.name}`}
            className="shrink-0 cursor-grab touch-none text-muted-foreground/60 hover:text-muted-foreground active:cursor-grabbing"
            {...listeners}
            {...attributes}
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        </div>
        <div className="px-3">
          <EntityLabels labelIds={container.labels} labelsById={labelsById} />
        </div>
        <SortedTaskList containerId={container.id} labelsById={labelsById} />
        <div className="p-2 pt-0">
          <QuickAddRow
            onAdd={async (title) => {
              await createTask({ title, projectId: container.projectId, containerId: container.id });
            }}
          />
        </div>
      </li>
      {editing && <ContainerDialog container={container} onClose={() => setEditing(false)} />}
    </>
  );
}

function ContainerList({
  status,
  projectById,
}: {
  status: KanbanStatus;
  projectById: Map<string, { id: string; name: string }>;
}) {
  const containers = useLiveQuery(
    () => db.containers.filter((c) => !c.archived && c.kanban?.status === status).sortBy('order'),
    [status],
    [],
  );
  const labels = useLiveQuery(listLabels, [], []);
  const labelsById = useMemo(() => new Map(labels.map((l) => [l.id, l])), [labels]);

  return (
    <ul className="flex flex-col gap-1.5 p-2">
      {containers.map((container) => (
        <KanbanCard
          key={container.id}
          container={container}
          projectName={projectById.get(container.projectId)?.name ?? ''}
          labelsById={labelsById}
        />
      ))}
    </ul>
  );
}

function StatusColumn({ status }: { status: KanbanStatus }) {
  const { setNodeRef } = useDroppable({ id: status });
  const projects = useLiveQuery(() => db.projects.toArray(), [], []);
  const projectById = useMemo(() => new Map((projects ?? []).map((p) => [p.id, p])), [projects]);

  async function handleAddContainer(title: string) {
    const container = await createContainer(INBOX_PROJECT_ID, title);
    await setContainerKanbanStatus(container.id, status);
  }

  return (
    <section
      ref={setNodeRef}
      data-dnd-droppable
      className="flex w-60 shrink-0 flex-col rounded-xl border border-border bg-card shadow-sm"
    >
      <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          <span className={STATUS_ACCENT[status]}>
            <span className="block size-2 shrink-0 rounded-full bg-current" />
          </span>
          <h3 className="text-sm font-semibold">{status}</h3>
        </div>
      </div>
      <ContainerList status={status} projectById={projectById} />
      <div className="p-2 pt-0">
        <QuickAddRow
          label="+ Add container"
          placeholder="Container name…"
          onAdd={handleAddContainer}
        />
      </div>
    </section>
  );
}

export function KanbanView() {
  const [pickerOpen, setPickerOpen] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    fireAndForget(setContainerKanbanStatus(String(active.id), over.id as KanbanStatus));
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <KanbanSquare className="size-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Kanban</h2>
            <p className="text-sm text-muted-foreground">Drag containers between columns to track work streams</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
          <Plus />
          Add existing container
        </Button>
      </div>
      {pickerOpen && <AddToKanbanPicker onClose={() => setPickerOpen(false)} />}
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-2">
          {COLUMNS.map((status) => (
            <StatusColumn key={status} status={status} />
          ))}
        </div>
      </DndContext>
    </div>
  );
}

import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { Layers, ChevronRight, ChevronDown, GripVertical } from 'lucide-react';
import { db } from '../../db/db';
import { listLabels } from '../../db/repositories/labels';
import { createTask } from '../../db/repositories/tasks';
import { reorderContainers } from '../../db/repositories/containers';
import { isContainerVisible } from '../../lib/entityVisibility';
import { useScrollHighlight, type HighlightRequest } from '../../lib/useScrollHighlight';
import { fireAndForget } from '../../lib/fireAndForget';
import type { Container, Label, Project } from '../../db/schema';
import { Badge } from '../ui/badge';
import { Checkbox } from '../ui/checkbox';
import { EntityLabels } from '../shared/EntityLabels';
import { QuickAddRow } from '../shared/QuickAddRow';
import { SortedTaskList } from '../shared/SortedTaskList';
import { ContainerDialog } from '../projects/ContainerDialog';
import { EntityHoverCard, ContainerHoverCardContent } from '../shared/EntityHoverCard';

export function AllContainersView({ highlight }: { highlight?: HighlightRequest | null }) {
  const [showArchived, setShowArchived] = useState(false);
  const highlighted = useScrollHighlight(highlight);
  const allContainers = useLiveQuery(() => db.containers.toArray(), [], []);
  const projects = useLiveQuery(() => db.projects.toArray(), [], []);
  const labels = useLiveQuery(listLabels, [], []);
  const allTasks = useLiveQuery(() => db.tasks.toArray(), [], []);
  const labelsById = useMemo(() => new Map((labels ?? []).map((l) => [l.id, l])), [labels]);
  const projectById = useMemo(
    () => new Map((projects ?? []).map((p) => [p.id, p])),
    [projects],
  );
  const countByContainer = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of allTasks ?? []) map.set(t.containerId, (map.get(t.containerId) ?? 0) + 1);
    return map;
  }, [allTasks]);
  const containerById = useMemo(
    () => new Map((allContainers ?? []).map((c) => [c.id, c])),
    [allContainers],
  );

  const filteredContainers = useMemo(() => {
    return (allContainers ?? []).filter((c) => {
      if (showArchived) return !isContainerVisible(c);
      return isContainerVisible(c);
    });
  }, [allContainers, showArchived]);

  const sorted = useMemo(
    () =>
      [...filteredContainers].sort((a, b) => {
        const pa = projectById.get(a.projectId)?.order ?? Number.MAX_SAFE_INTEGER;
        const pb = projectById.get(b.projectId)?.order ?? Number.MAX_SAFE_INTEGER;
        if (pa !== pb) return pa - pb;
        const na = projectById.get(a.projectId)?.name ?? '';
        const nb = projectById.get(b.projectId)?.name ?? '';
        if (na !== nb) return na.localeCompare(nb);
        if (a.order !== b.order) return a.order - b.order;
        return a.name.localeCompare(b.name);
      }),
    [filteredContainers, projectById],
  );

  const [order, setOrder] = useState<string[]>([]);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );
  const orderedIds = order.length === sorted.length ? order : sorted.map((c) => c.id);
  const display = orderedIds
    .map((id) => sorted.find((c) => c.id === id))
    .filter((c): c is Container => Boolean(c));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const activeContainer = containerById.get(String(active.id));
    const overContainer = containerById.get(String(over.id));
    // Container order is scoped per project, so only allow reordering within the same project group.
    if (!activeContainer || !overContainer || activeContainer.projectId !== overContainer.projectId) return;
    const base = order.length === sorted.length ? order : sorted.map((c) => c.id);
    const oldIndex = base.indexOf(String(active.id));
    const newIndex = base.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(base, oldIndex, newIndex);
    setOrder(next);
    const projectContainerIds = next.filter(
      (id) => containerById.get(id)?.projectId === activeContainer.projectId,
    );
    fireAndForget(reorderContainers(activeContainer.projectId, projectContainerIds));
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <Layers className="size-4" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">All Containers</h2>
            <p className="text-sm text-muted-foreground">Every container across every project</p>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
          <Checkbox
            checked={showArchived}
            onCheckedChange={(checked) => setShowArchived(Boolean(checked))}
            aria-label="Show archived containers"
          />
          <span>Show archived</span>
        </label>
      </div>
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <SortableContext items={orderedIds} strategy={verticalListSortingStrategy}>
          <ul className="flex flex-col gap-1.5">
            {display.map((container) => (
              <ContainerRow
                key={container.id}
                container={container}
                labelsById={labelsById}
                projectById={projectById}
                containerById={containerById}
                taskCount={countByContainer.get(container.id) ?? 0}
                highlighted={highlighted === `container-${container.id}`}
              >
                {projectById.get(container.projectId)?.name && (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {projectById.get(container.projectId)!.name}
                  </span>
                )}
              </ContainerRow>
            ))}
            {sorted.length === 0 && (
              <li className="py-10 text-center text-sm text-muted-foreground">No containers yet.</li>
            )}
          </ul>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function ContainerRow({
  container,
  labelsById,
  taskCount,
  projectById,
  containerById,
  children,
  highlighted = false,
}: {
  container: Container;
  labelsById: Map<string, Label>;
  taskCount: number;
  projectById?: Map<string, Project>;
  containerById?: Map<string, Container>;
  children: React.ReactNode;
  highlighted?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const { setNodeRef, setActivatorNodeRef, listeners, attributes, transform, isDragging } = useSortable({
    id: container.id,
  });

  return (
    <>
      <li
        ref={setNodeRef}
        id={`container-${container.id}`}
        data-dnd-draggable
        onDoubleClick={() => setEditing(true)}
        style={{
          transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
          transition: isDragging ? 'none' : undefined,
        }}
        className={`group flex flex-col gap-2 rounded-xl border border-border/70 bg-card px-3 py-2.5 shadow-sm ${
          isDragging ? 'opacity-50' : ''
        } ${highlighted ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''}`}
      >
        <div className="flex items-center gap-2">
          <button
            ref={setActivatorNodeRef}
            aria-label={`Drag ${container.name}`}
            className="shrink-0 cursor-grab touch-none text-muted-foreground/60 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 hover:text-muted-foreground active:cursor-grabbing"
            {...listeners}
            {...attributes}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <button
            aria-label={expanded ? `Collapse ${container.name}` : `Expand ${container.name}`}
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
            className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
          <EntityHoverCard
            content={
              <ContainerHoverCardContent
                container={container}
                projectById={projectById ?? new Map()}
                labelsById={labelsById}
                taskCount={taskCount}
              />
            }
          >
            <div className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-foreground">{container.name}</span>
              <span className="mt-0.5 flex items-center gap-2">
                {children}
                {container.archived && (
                  <Badge variant="outline">Archived</Badge>
                )}
                {container.kanban && (
                  <Badge variant="secondary">Kanban: {container.kanban.status}</Badge>
                )}
                <span className="shrink-0 text-xs text-muted-foreground">
                  {taskCount} {taskCount === 1 ? 'task' : 'tasks'}
                </span>
              </span>
            </div>
          </EntityHoverCard>
          <EntityLabels labelIds={container.labels} labelsById={labelsById} />
        </div>
        {expanded && (
          <SortedTaskList
            containerId={container.id}
            labelsById={labelsById}
            containerById={containerById}
            projectById={projectById}
          />
        )}
        <QuickAddRow
          onAdd={async (title) => {
            await createTask({ title, projectId: container.projectId, containerId: container.id });
          }}
        />
      </li>
      {editing && <ContainerDialog container={container} onClose={() => setEditing(false)} />}
    </>
  );
}

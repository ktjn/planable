// src/components/weekly/WeeklyPlanView.tsx
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
import { GripVertical } from 'lucide-react';
import { db } from '../../db/db';
import { advanceActiveWeek } from '../../lib/activeWeek';
import { getCurrentWeekId, getNextWeekId, getWeekLabel } from '../../lib/week';
import { SETTING_ACTIVE_WEEK } from '../../db/repositories/settings';
import { addToWeek, setWeeklyDay } from '../../db/repositories/taskMembership';
import { setContainerWeeklyDay } from '../../db/repositories/containers';
import { listLabels } from '../../db/repositories/labels';
import { autoHandleClosingWeek } from '../../lib/rollover';
import { fireAndForget } from '../../lib/fireAndForget';
import { isContainerVisible, isTaskVisible } from '../../lib/entityVisibility';
import type { Container as ContainerEntity, Task, WeekDay, Label } from '../../db/schema';
import { CalendarDays, CalendarPlus, Plus } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { AddToWeekPicker } from './AddToWeekPicker';
import { WeekRolloverDialog } from './WeekRolloverDialog';
import { createInboxTask } from '../../db/repositories/tasks';
import { QuickAddRow } from '../shared/QuickAddRow';
import { EntityLabels } from '../shared/EntityLabels';
import { TaskDialog } from '../projects/TaskDialog';
import { ContainerDialog } from '../projects/ContainerDialog';

const COLUMNS: WeekDay[] = ['Unplanned', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

const DAY_ACCENT: Record<WeekDay, string> = {
  Unplanned: 'bg-muted text-muted-foreground',
  Mon: 'bg-sky-500/15 text-sky-700 dark:text-sky-400',
  Tue: 'bg-violet-500/15 text-violet-700 dark:text-violet-400',
  Wed: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  Thu: 'bg-amber-500/20 text-amber-700 dark:text-amber-400',
  Fri: 'bg-rose-500/15 text-rose-700 dark:text-rose-400',
};

type WeekEntry = {
  id: string;
  label: string;
  subtitle?: string;
  labels?: string[];
  kind: 'container' | 'task';
  entity: ContainerEntity | Task;
};

function DraggableRow({
  dragId,
  label,
  subtitle,
  labels,
  labelsById,
  onDoubleClick,
}: {
  dragId: string;
  label: string;
  subtitle?: string;
  labels?: string[];
  labelsById: Map<string, Label>;
  onDoubleClick: () => void;
}) {
  const { setNodeRef, setActivatorNodeRef, listeners, attributes, transform, isDragging } = useDraggable({
    id: dragId,
  });
  return (
    <li
      ref={setNodeRef}
      data-dnd-draggable
      onDoubleClick={onDoubleClick}
      style={{ transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined }}
      className={`flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground shadow-sm hover:border-primary/30 hover:shadow-md ${
        isDragging ? 'opacity-50' : ''
      }`}
    >
      <button
        ref={setActivatorNodeRef}
        aria-label={`Drag ${label}`}
        className="shrink-0 cursor-grab touch-none text-muted-foreground/60 hover:text-muted-foreground active:cursor-grabbing"
        {...listeners}
        {...attributes}
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <div className="min-w-0 flex-1">
        <span className="block truncate font-medium">{label}</span>
        {subtitle && <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>}
      </div>
      {labels && labels.length > 0 && <EntityLabels labelIds={labels} labelsById={labelsById} className="hidden md:inline-flex" />}
    </li>
  );
}

function WeeklyDayColumn({
  prefix,
  day,
  entries,
  labelsById,
  onQuickAdd,
  onEdit,
}: {
  prefix: 'c' | 't';
  day: WeekDay;
  entries: WeekEntry[];
  labelsById: Map<string, Label>;
  onQuickAdd: ((title: string) => Promise<void>) | undefined;
  onEdit: (entry: WeekEntry) => void;
}) {
  const { setNodeRef } = useDroppable({ id: `${prefix}:${day}` });

  return (
    <section
      ref={setNodeRef}
      data-dnd-droppable
      className="flex w-52 shrink-0 flex-col rounded-xl border border-border bg-card shadow-sm"
    >
      <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          <span className={DAY_ACCENT[day]}>
            <span className="block size-2 shrink-0 rounded-full bg-current" />
          </span>
          <h3 className="text-sm font-semibold">{day}</h3>
        </div>
        <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground tabular-nums">
          {entries.length}
        </span>
      </div>
      <ul className="flex flex-col gap-1.5 p-2">
        {entries.map((entry) => (
          <DraggableRow
            key={entry.id}
            dragId={`${prefix}:${entry.id}`}
            label={entry.label}
            subtitle={entry.subtitle}
            labels={entry.labels}
            labelsById={labelsById}
            onDoubleClick={() => onEdit(entry)}
          />
        ))}
      </ul>
      {onQuickAdd && (
        <div className="p-2 pt-0">
          <QuickAddRow onAdd={onQuickAdd} />
        </div>
      )}
    </section>
  );
}

function WeeklyBoard({
  prefix,
  title,
  entriesByDay,
  labelsById,
  onQuickAdd,
  onEdit,
}: {
  prefix: 'c' | 't';
  title: string;
  entriesByDay: (day: WeekDay) => WeekEntry[];
  labelsById: Map<string, Label>;
  onQuickAdd?: (day: WeekDay, title: string) => Promise<void>;
  onEdit: (entry: WeekEntry) => void;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {COLUMNS.map((day) => (
          <WeeklyDayColumn
            key={day}
            prefix={prefix}
            day={day}
            entries={entriesByDay(day)}
            labelsById={labelsById}
            onQuickAdd={onQuickAdd ? (t) => onQuickAdd(day, t) : undefined}
            onEdit={onEdit}
          />
        ))}
      </div>
    </section>
  );
}

export function WeeklyPlanView() {
  const activeWeekSetting = useLiveQuery(() => db.settings.get(SETTING_ACTIVE_WEEK), [], undefined);
  const weekId =
    (typeof activeWeekSetting?.value === 'string' && activeWeekSetting.value) || getCurrentWeekId();
  const tasks = useLiveQuery(
    () => db.tasks.where('weekly.weekId').equals(weekId).toArray(),
    [weekId],
    [],
  );
  const containers = useLiveQuery(
    () => db.containers.where('weekly.weekId').equals(weekId).toArray(),
    [weekId],
    [],
  );
  const projects = useLiveQuery(() => db.projects.toArray(), [], []);
  const containersAll = useLiveQuery(() => db.containers.toArray(), [], []);
  const labels = useLiveQuery(listLabels, [], []);
  const projectById = useMemo(
    () => new Map((projects ?? []).map((p) => [p.id, p])),
    [projects],
  );
  const containerById = useMemo(
    () => new Map((containersAll ?? []).map((c) => [c.id, c])),
    [containersAll],
  );
  const labelsById = useMemo(() => new Map((labels ?? []).map((l) => [l.id, l])), [labels]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [rolloverOpen, setRolloverOpen] = useState(false);
  const [editing, setEditing] = useState<{ kind: 'container' | 'task'; entity: ContainerEntity | Task } | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const visibleContainers = useMemo(
    () => (containers ?? []).filter(isContainerVisible),
    [containers],
  );
  const visibleTasks = useMemo(
    () => (tasks ?? []).filter((t) => isTaskVisible(t, containerById)),
    [tasks, containerById],
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId.startsWith('c:') && overId.startsWith('c:')) {
      fireAndForget(setContainerWeeklyDay(activeId.slice(2), overId.slice(2) as WeekDay));
      return;
    }
    if (activeId.startsWith('t:') && overId.startsWith('t:')) {
      fireAndForget(setWeeklyDay(activeId.slice(2), overId.slice(2) as WeekDay));
    }
  }

  async function handleQuickAdd(day: WeekDay, title: string) {
    const task = await createInboxTask(title);
    await addToWeek(task.id, weekId);
    await setWeeklyDay(task.id, day);
  }

  function handleRollover() {
    fireAndForget(autoHandleClosingWeek(weekId));
    setRolloverOpen(true);
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <CalendarDays className="size-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Weekly Plan</h2>
            <p className="text-sm text-muted-foreground">{getWeekLabel(weekId)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
            <Plus />
            Add existing
          </Button>
          <Button variant="secondary" size="sm" onClick={handleRollover}>
            <CalendarPlus />
            Start new week
          </Button>
        </div>
      </div>
      {pickerOpen && <AddToWeekPicker onClose={() => setPickerOpen(false)} />}
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="grid gap-6">
          <WeeklyBoard
            prefix="c"
            title="Containers"
            labelsById={labelsById}
            entriesByDay={(day) =>
              visibleContainers
                .filter((c) => c.weekly?.day === day)
                .map((c) => ({
                  id: c.id,
                  kind: 'container' as const,
                  entity: c,
                  label: c.name,
                  subtitle: projectById.get(c.projectId)?.name,
                  labels: c.labels,
                }))
            }
            onEdit={(entry) => setEditing({ kind: 'container', entity: entry.entity as ContainerEntity })}
          />
          <WeeklyBoard
            prefix="t"
            title="Tasks"
            labelsById={labelsById}
            entriesByDay={(day) =>
              visibleTasks.filter((t) => t.weekly?.day === day).map((t) => ({
                id: t.id,
                kind: 'task' as const,
                entity: t,
                label: t.title,
                labels: t.labels,
              }))
            }
            onQuickAdd={handleQuickAdd}
            onEdit={(entry) => setEditing({ kind: 'task', entity: entry.entity as Task })}
          />
        </div>
      </DndContext>
      {editing?.kind === 'task' && (
        <TaskDialog
          mode="edit"
          projectId={(editing.entity as Task).projectId}
          containerId={(editing.entity as Task).containerId}
          task={editing.entity as Task}
          onClose={() => setEditing(null)}
        />
      )}
      {editing?.kind === 'container' && (
        <ContainerDialog container={editing.entity as ContainerEntity} onClose={() => setEditing(null)} />
      )}
      {rolloverOpen && (
        <WeekRolloverDialog
          weekId={weekId}
          nextWeekId={getNextWeekId(weekId)}
          onClose={() => setRolloverOpen(false)}
          onAdvanced={() => {
            fireAndForget(advanceActiveWeek());
          }}
        />
      )}
    </div>
  );
}

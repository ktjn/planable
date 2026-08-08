// src/components/weekly/WeeklyPlanView.tsx
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { db } from '../../db/db';
import { advanceActiveWeek } from '../../lib/activeWeek';
import { getCurrentWeekId, getNextWeekId, getWeekLabel } from '../../lib/week';
import { SETTING_ACTIVE_WEEK } from '../../db/repositories/settings';
import { addToWeek, setWeeklyDay, reorderWeeklyTasks } from '../../db/repositories/taskMembership';
import { listLabels } from '../../db/repositories/labels';
import { autoHandleClosingWeek } from '../../lib/rollover';
import { fireAndForget } from '../../lib/fireAndForget';
import { isTaskVisible } from '../../lib/entityVisibility';
import { sortWeeklyTasks } from '../../lib/weeklyOrder';
import type { Task, WeekDay, Label, Container, Project } from '../../db/schema';
import { CalendarDays, CalendarPlus, Plus } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { AddToWeekPicker } from './AddToWeekPicker';
import { WeekRolloverDialog } from './WeekRolloverDialog';
import { createInboxTask } from '../../db/repositories/tasks';
import { QuickAddRow } from '../shared/QuickAddRow';
import { TaskCard } from '../projects/TaskCard';
import { TaskDialog } from '../projects/TaskDialog';

const COLUMNS: WeekDay[] = ['Unplanned', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

const DAY_ACCENT: Record<WeekDay, string> = {
  Unplanned: 'bg-muted text-muted-foreground',
  Mon: 'bg-sky-500/15 text-sky-700 dark:text-sky-400',
  Tue: 'bg-violet-500/15 text-violet-700 dark:text-violet-400',
  Wed: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  Thu: 'bg-amber-500/20 text-amber-700 dark:text-amber-400',
  Fri: 'bg-rose-500/15 text-rose-700 dark:text-rose-400',
};

function WeeklyDayColumn({
  day,
  entries,
  labelsById,
  containerById,
  projectById,
  onQuickAdd,
  onEdit,
}: {
  day: WeekDay;
  entries: Task[];
  labelsById: Map<string, Label>;
  containerById: Map<string, Container>;
  projectById: Map<string, Project>;
  onQuickAdd: (title: string) => Promise<void>;
  onEdit: (task: Task) => void;
}) {
  const { setNodeRef } = useDroppable({ id: `t:${day}` });
  const sorted = sortWeeklyTasks(entries);
  const ids = sorted.map((t) => t.id);

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
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ul className="flex flex-col gap-1.5 p-2">
          {sorted.map((task) => (
            <li key={task.id}>
              <TaskCard
                task={task}
                labelsById={labelsById}
                containerById={containerById}
                projectById={projectById}
                sortableId={task.id}
                showWeeklyBadge={false}
                showAddToWeek={false}
                onEdit={onEdit}
                className={task.completed ? 'opacity-70' : ''}
              />
            </li>
          ))}
        </ul>
      </SortableContext>
      <div className="p-2 pt-0">
        <QuickAddRow onAdd={onQuickAdd} />
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
  const containersAll = useLiveQuery(() => db.containers.toArray(), [], []);
  const projects = useLiveQuery(() => db.projects.toArray(), [], []);
  const labels = useLiveQuery(listLabels, [], []);
  const containerById = useMemo(
    () => new Map((containersAll ?? []).map((c) => [c.id, c])),
    [containersAll],
  );
  const projectById = useMemo(
    () => new Map((projects ?? []).map((p) => [p.id, p])),
    [projects],
  );
  const labelsById = useMemo(() => new Map((labels ?? []).map((l) => [l.id, l])), [labels]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [rolloverOpen, setRolloverOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const visibleTasks = useMemo(
    () => (tasks ?? []).filter((t) => isTaskVisible(t, containerById)),
    [tasks, containerById],
  );

  function handleDragStart(event: DragStartEvent) {
    const id = String(event.active.id);
    setActiveTask((tasks ?? []).find((t) => t.id === id) ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);

    // Dropped on a day column itself → move to that day.
    if (overId.startsWith('t:')) {
      fireAndForget(setWeeklyDay(activeId, overId.slice(2) as WeekDay));
      return;
    }

    const task = tasks?.find((t) => t.id === activeId);
    if (!task?.weekly) return;

    // Dropped on a task in a different day → move to that day.
    const overTask = tasks?.find((t) => t.id === overId);
    if (overTask?.weekly && overTask.weekly.weekId === task.weekly.weekId && overTask.weekly.day !== task.weekly.day) {
      fireAndForget(setWeeklyDay(activeId, overTask.weekly.day));
      return;
    }

    // Otherwise: reorder within the current day.
    const day = task.weekly.day;
    const dayTasks = sortWeeklyTasks((tasks ?? []).filter((t) => t.weekly?.day === day));
    const oldIndex = dayTasks.findIndex((t) => t.id === activeId);
    const newIndex = dayTasks.findIndex((t) => t.id === overId);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(dayTasks, oldIndex, newIndex).map((t) => t.id);
    fireAndForget(reorderWeeklyTasks(weekId, day, next));
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
            Add existing task
          </Button>
          <Button variant="secondary" size="sm" onClick={handleRollover}>
            <CalendarPlus />
            Start new week
          </Button>
        </div>
      </div>
      {pickerOpen && <AddToWeekPicker onClose={() => setPickerOpen(false)} />}
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveTask(null)}
      >
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Tasks</h3>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {COLUMNS.map((day) => (
              <WeeklyDayColumn
                key={day}
                day={day}
                entries={visibleTasks.filter((t) => t.weekly?.day === day)}
                labelsById={labelsById}
                containerById={containerById}
                projectById={projectById}
                onQuickAdd={(title) => handleQuickAdd(day, title)}
                onEdit={setEditing}
              />
            ))}
          </div>
        </section>
        <DragOverlay>
          {activeTask && (
            <TaskCard
              task={activeTask}
              labelsById={labelsById}
              containerById={containerById}
              projectById={projectById}
              showWeeklyBadge={false}
              showAddToWeek={false}
              sortableId={null}
              onEdit={() => {}}
              className="rotate-3 cursor-grabbing opacity-95 shadow-lg"
            />
          )}
        </DragOverlay>
      </DndContext>
      {editing && (
        <TaskDialog
          mode="edit"
          projectId={editing.projectId}
          containerId={editing.containerId}
          task={editing}
          onClose={() => setEditing(null)}
        />
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

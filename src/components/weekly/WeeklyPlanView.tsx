// src/components/weekly/WeeklyPlanView.tsx
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  pointerWithin,
  closestCenter,
  type DragEndEvent,
  type DragStartEvent,
  type CollisionDetection,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
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
import { resolveWeeklyDrag, type WeeklyDragData } from '../../lib/weeklyDragResolver';
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
  const { setNodeRef } = useDroppable({
    id: `day:${day}`,
    data: { type: 'weekly-day', day } as WeeklyDragData,
  });
  const sorted = sortWeeklyTasks(entries);
  const ids = sorted.map((t) => `task:${t.id}`);

  return (
    <section
      ref={setNodeRef}
      data-dnd-droppable
      className="group/column flex min-w-44 flex-1 shrink-0 flex-col rounded-xl border border-border bg-card shadow-sm transition-[border-color,box-shadow,transform] duration-200 ease-out hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md motion-reduce:transform-none motion-reduce:transition-none"
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
        <ul className="flex min-h-14 flex-col gap-1.5 p-2 transition-[min-height] duration-200 motion-reduce:transition-none">
          {sorted.map((task) => (
            <li key={task.id}>
              <TaskCard
                task={task}
                labelsById={labelsById}
                containerById={containerById}
                projectById={projectById}
                sortableId={`task:${task.id}`}
                extraData={{ type: 'weekly-task', taskId: task.id, day: task.weekly?.day } as WeeklyDragData}
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

  const weeklyCollisionDetection: CollisionDetection = (args) => {
    // First, check if pointer is within a column
    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length > 0) {
      const dayCollision = pointerCollisions.find((c) => String(c.id).startsWith('day:'));
      if (dayCollision) {
        // If we're over a column, prefer tasks within that column using closestCenter
        const taskCollisions = closestCenter({
          ...args,
          droppableContainers: args.droppableContainers.filter((container) => {
            const data = container.data.current as WeeklyDragData | undefined;
            return data?.type === 'weekly-task' && data.day === (dayCollision.data as any)?.day;
          }),
        });
        if (taskCollisions.length > 0) return taskCollisions;
        return [dayCollision];
      }
    }
    return closestCenter(args);
  };

  function handleDragStart(event: DragStartEvent) {
    const data = event.active.data.current as WeeklyDragData | undefined;
    if (data?.type === 'weekly-task') {
      setActiveTask((tasks ?? []).find((t) => t.id === data.taskId) ?? null);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const activeData = active.data.current as WeeklyDragData | undefined;
    const overData = over.data.current as WeeklyDragData | undefined;

    const resolution = resolveWeeklyDrag(
      String(active.id),
      String(over.id),
      activeData,
      overData,
      tasks ?? [],
      weekId
    );

    if (resolution.type === 'move-to-day') {
      fireAndForget(setWeeklyDay(resolution.taskId, resolution.targetDay));
    } else if (resolution.type === 'reorder-in-day' && resolution.newOrder) {
      fireAndForget(reorderWeeklyTasks(weekId, resolution.targetDay, resolution.newOrder));
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
        collisionDetection={weeklyCollisionDetection}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveTask(null)}
      >
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Tasks</h3>
          <div className="flex gap-3 overflow-x-auto pb-2">
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
        <DragOverlay adjustScale={false} dropAnimation={null}>
          {activeTask ? (
            <div className="w-56 pointer-events-none">
              <TaskCard
                task={activeTask}
                labelsById={labelsById}
                containerById={containerById}
                projectById={projectById}
                sortableId={null}
                showWeeklyBadge={false}
                showAddToWeek={false}
                className="shadow-xl ring-2 ring-primary/20"
              />
            </div>
          ) : null}
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

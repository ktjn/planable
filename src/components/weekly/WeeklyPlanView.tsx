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
import { useState } from 'react';
import { db } from '../../db/db';
import { advanceActiveWeek } from '../../lib/activeWeek';
import { getCurrentWeekId, getNextWeekId, getWeekLabel } from '../../lib/week';
import { SETTING_ACTIVE_WEEK } from '../../db/repositories/settings';
import { addToWeek, setWeeklyDay } from '../../db/repositories/taskMembership';
import { setContainerWeeklyDay } from '../../db/repositories/containers';
import { autoHandleClosingWeek } from '../../lib/rollover';
import { fireAndForget } from '../../lib/fireAndForget';
import type { WeekDay } from '../../db/schema';
import { CalendarDays, CalendarPlus, Plus } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { AddToWeekPicker } from './AddToWeekPicker';
import { WeekRolloverDialog } from './WeekRolloverDialog';
import { createInboxTask } from '../../db/repositories/tasks';
import { QuickAddRow } from '../shared/QuickAddRow';

const COLUMNS: WeekDay[] = ['Unplanned', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

const DAY_ACCENT: Record<WeekDay, string> = {
  Unplanned: 'bg-muted text-muted-foreground',
  Mon: 'bg-sky-500/15 text-sky-700 dark:text-sky-400',
  Tue: 'bg-violet-500/15 text-violet-700 dark:text-violet-400',
  Wed: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  Thu: 'bg-amber-500/20 text-amber-700 dark:text-amber-400',
  Fri: 'bg-rose-500/15 text-rose-700 dark:text-rose-400',
};

interface WeekEntry {
  id: string;
  label: string;
  subtitle?: string;
}

function DraggableRow({ dragId, label, subtitle }: { dragId: string; label: string; subtitle?: string }) {
  const { setNodeRef, listeners, attributes, transform } = useDraggable({ id: dragId });
  return (
    <li
      ref={setNodeRef}
      data-dnd-draggable
      {...listeners}
      {...attributes}
      style={{ transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined }}
      className="cursor-grab rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground shadow-sm transition-all hover:border-primary/30 hover:shadow-md active:cursor-grabbing"
    >
      <span className="block truncate font-medium">{label}</span>
      {subtitle && <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>}
    </li>
  );
}

function WeeklyDayColumn({
  prefix,
  day,
  entries,
  onQuickAdd,
}: {
  prefix: 'c' | 't';
  day: WeekDay;
  entries: WeekEntry[];
  onQuickAdd: ((title: string) => Promise<void>) | undefined;
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
  onQuickAdd,
}: {
  prefix: 'c' | 't';
  title: string;
  entriesByDay: (day: WeekDay) => WeekEntry[];
  onQuickAdd?: (day: WeekDay, title: string) => Promise<void>;
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
            onQuickAdd={onQuickAdd ? (title) => onQuickAdd(day, title) : undefined}
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
  const projectById = new Map((projects ?? []).map((p) => [p.id, p]));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [rolloverOpen, setRolloverOpen] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
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
            entriesByDay={(day) =>
              containers
                .filter((c) => c.weekly?.day === day)
                .map((c) => ({
                  id: c.id,
                  label: c.name,
                  subtitle: projectById.get(c.projectId)?.name,
                }))
            }
          />
          <WeeklyBoard
            prefix="t"
            title="Tasks"
            entriesByDay={(day) =>
              tasks.filter((t) => t.weekly?.day === day).map((t) => ({ id: t.id, label: t.title }))
            }
            onQuickAdd={handleQuickAdd}
          />
        </div>
      </DndContext>
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

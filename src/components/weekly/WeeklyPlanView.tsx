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
import { setWeeklyDay } from '../../db/repositories/taskMembership';
import { autoHandleClosingWeek } from '../../lib/rollover';
import { fireAndForget } from '../../lib/fireAndForget';
import type { WeekDay } from '../../db/schema';
import { CalendarPlus, Plus } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Separator } from '../../components/ui/separator';
import { AddToWeekPicker } from './AddToWeekPicker';
import { WeekRolloverDialog } from './WeekRolloverDialog';

const COLUMNS: WeekDay[] = ['Unplanned', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

function DraggableTaskRow({ id, title }: { id: string; title: string }) {
  const { setNodeRef, listeners, attributes, transform } = useDraggable({ id });
  return (
    <li
      ref={setNodeRef}
      data-dnd-draggable
      {...listeners}
      {...attributes}
      style={{ transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined }}
      className="cursor-grab py-1"
    >
      {title}
    </li>
  );
}

function DayColumn({ day, titles }: { day: WeekDay; titles: { id: string; title: string }[] }) {
  const { setNodeRef } = useDroppable({ id: day });
  return (
    <section ref={setNodeRef} className="w-48 shrink-0 rounded-xl border bg-card p-2 shadow-sm">
      <h3 className="mb-2 text-sm font-medium">{day}</h3>
      <ul>
        {titles.map((t) => (
          <DraggableTaskRow key={t.id} id={t.id} title={t.title} />
        ))}
      </ul>
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
  const [pickerOpen, setPickerOpen] = useState(false);
  const [rolloverOpen, setRolloverOpen] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    fireAndForget(setWeeklyDay(String(active.id), over.id as WeekDay));
  }

  function handleRollover() {
    fireAndForget(autoHandleClosingWeek(weekId));
    setRolloverOpen(true);
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-medium">Weekly Plan</h2>
          <p className="text-sm text-muted-foreground">{getWeekLabel(weekId)}</p>
        </div>
        <div className="flex gap-2">
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
      <Separator className="mb-4" />
      {pickerOpen && <AddToWeekPicker onClose={() => setPickerOpen(false)} />}
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="flex gap-4">
          {COLUMNS.map((day) => (
            <DayColumn
              key={day}
              day={day}
              titles={tasks.filter((t) => t.weekly?.day === day).map((t) => ({ id: t.id, title: t.title }))}
            />
          ))}
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

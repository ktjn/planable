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
import { getCurrentWeekId } from '../../lib/week';
import { setWeeklyDay } from '../../db/repositories/taskMembership';
import type { WeekDay } from '../../db/schema';
import { AddToWeekPicker } from './AddToWeekPicker';

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
    <section ref={setNodeRef} className="w-48 shrink-0 rounded border border-gray-200 p-2">
      <h3 className="mb-2 font-medium">{day}</h3>
      <ul>
        {titles.map((t) => (
          <DraggableTaskRow key={t.id} id={t.id} title={t.title} />
        ))}
      </ul>
    </section>
  );
}

export function WeeklyPlanView() {
  const weekId = getCurrentWeekId();
  const tasks = useLiveQuery(
    () => db.tasks.filter((t) => t.weekly?.weekId === weekId).toArray(),
    [weekId],
    [],
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    await setWeeklyDay(String(active.id), over.id as WeekDay);
  }

  return (
    <div>
      <button onClick={() => setPickerOpen(true)}>+ Add existing task</button>
      {pickerOpen && <AddToWeekPicker onClose={() => setPickerOpen(false)} />}
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="mt-4 flex gap-4">
          {COLUMNS.map((day) => (
            <DayColumn
              key={day}
              day={day}
              titles={tasks.filter((t) => t.weekly?.day === day).map((t) => ({ id: t.id, title: t.title }))}
            />
          ))}
        </div>
      </DndContext>
    </div>
  );
}

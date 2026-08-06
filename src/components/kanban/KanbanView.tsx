import {
  DndContext,
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
import { setKanbanStatus } from '../../db/repositories/taskMembership';
import type { KanbanStatus } from '../../db/schema';
import { AddToKanbanPicker } from './AddToKanbanPicker';

const COLUMNS: KanbanStatus[] = ['Todo', 'Doing', 'Blocked', 'Done'];

function DraggableCard({ id, title }: { id: string; title: string }) {
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

function StatusColumn({ status, titles }: { status: KanbanStatus; titles: { id: string; title: string }[] }) {
  const { setNodeRef } = useDroppable({ id: status });
  return (
    <section ref={setNodeRef} className="w-56 shrink-0 rounded border border-gray-200 p-2">
      <h3 className="mb-2 font-medium">{status}</h3>
      <ul>
        {titles.map((t) => (
          <DraggableCard key={t.id} id={t.id} title={t.title} />
        ))}
      </ul>
    </section>
  );
}

export function KanbanView() {
  const tasks = useLiveQuery(() => db.tasks.filter((t) => t.kanban !== null).toArray(), [], []);
  const [pickerOpen, setPickerOpen] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    await setKanbanStatus(String(active.id), over.id as KanbanStatus);
  }

  return (
    <div>
      <button onClick={() => setPickerOpen(true)}>+ Add existing task</button>
      {pickerOpen && <AddToKanbanPicker onClose={() => setPickerOpen(false)} />}
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="mt-4 flex gap-4">
          {COLUMNS.map((status) => (
            <StatusColumn
              key={status}
              status={status}
              titles={tasks.filter((t) => t.kanban?.status === status).map((t) => ({ id: t.id, title: t.title }))}
            />
          ))}
        </div>
      </DndContext>
    </div>
  );
}

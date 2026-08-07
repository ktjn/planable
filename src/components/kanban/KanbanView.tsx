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
import { setKanbanStatus } from '../../db/repositories/taskMembership';
import { fireAndForget } from '../../lib/fireAndForget';
import type { KanbanStatus } from '../../db/schema';
import { KanbanSquare, Plus } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { AddToKanbanPicker } from './AddToKanbanPicker';

const COLUMNS: KanbanStatus[] = ['Todo', 'Doing', 'Blocked', 'Done'];

const STATUS_ACCENT: Record<KanbanStatus, string> = {
  Todo: 'bg-slate-500/15 text-slate-700 dark:text-slate-400',
  Doing: 'bg-sky-500/15 text-sky-700 dark:text-sky-400',
  Blocked: 'bg-rose-500/15 text-rose-700 dark:text-rose-400',
  Done: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
};

function DraggableCard({ id, title }: { id: string; title: string }) {
  const { setNodeRef, listeners, attributes, transform } = useDraggable({ id });
  return (
    <li
      ref={setNodeRef}
      data-dnd-draggable
      {...listeners}
      {...attributes}
      style={{ transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined }}
      className="cursor-grab rounded-lg border border-border/80 bg-background px-3 py-2 text-sm text-foreground shadow-sm transition-all hover:border-primary/30 hover:shadow-md active:cursor-grabbing"
    >
      {title}
    </li>
  );
}

function StatusColumn({ status, titles }: { status: KanbanStatus; titles: { id: string; title: string }[] }) {
  const { setNodeRef } = useDroppable({ id: status });
  return (
    <section
      ref={setNodeRef}
      className="flex w-56 shrink-0 flex-col rounded-xl border border-border bg-card shadow-sm"
    >
      <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          <span className={STATUS_ACCENT[status]}>
            <span className="block size-2 shrink-0 rounded-full bg-current" />
          </span>
          <h3 className="text-sm font-semibold">{status}</h3>
        </div>
        <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground tabular-nums">
          {titles.length}
        </span>
      </div>
      <ul className="flex flex-col gap-1.5 p-2">
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
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    fireAndForget(setKanbanStatus(String(active.id), over.id as KanbanStatus));
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
            <p className="text-sm text-muted-foreground">Drag cards between columns to track progress</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
          <Plus />
          Add existing task
        </Button>
      </div>
      {pickerOpen && <AddToKanbanPicker onClose={() => setPickerOpen(false)} />}
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-2">
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

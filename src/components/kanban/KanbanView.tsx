import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import type { KanbanStatus } from '../../db/schema';
import { AddToKanbanPicker } from './AddToKanbanPicker';

const COLUMNS: KanbanStatus[] = ['Todo', 'Doing', 'Blocked', 'Done'];

export function KanbanView() {
  const [pickerOpen, setPickerOpen] = useState(false);
  const tasks = useLiveQuery(() => db.tasks.filter((t) => t.kanban !== null).toArray(), [], []);

  return (
    <div>
      <button onClick={() => setPickerOpen(true)}>+ Add existing task</button>
      {pickerOpen && <AddToKanbanPicker onClose={() => setPickerOpen(false)} />}
      <div className="flex gap-4">
      {COLUMNS.map((status) => (
        <section key={status} className="w-56 shrink-0 rounded border border-gray-200 p-2">
          <h3 className="mb-2 font-medium">{status}</h3>
          <ul>
            {tasks
              .filter((t) => t.kanban?.status === status)
              .map((t) => (
                <li key={t.id} className="py-1">
                  {t.title}
                </li>
              ))}
          </ul>
        </section>
      ))}
      </div>
    </div>
  );
}

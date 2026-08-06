import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { addToKanban } from '../../db/repositories/taskMembership';

export function AddToKanbanPicker({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('');
  const results = useLiveQuery(
    () =>
      db.tasks
        .filter(
          (t) => t.kanban === null && t.title.toLowerCase().includes(query.toLowerCase()) && query.trim().length > 0,
        )
        .toArray(),
    [query],
    [],
  );

  return (
    <div role="dialog" className="rounded border border-gray-300 bg-white p-2">
      <input
        className="mb-2 block w-full border"
        placeholder="Search tasks"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <ul>
        {results.map((task) => (
          <li key={task.id}>
            <button
              onClick={async () => {
                await addToKanban(task.id);
                onClose();
              }}
            >
              {task.title}
            </button>
          </li>
        ))}
      </ul>
      <button onClick={onClose}>Close</button>
    </div>
  );
}

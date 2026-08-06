import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { addToWeek } from '../../db/repositories/taskMembership';
import { getCurrentWeekId } from '../../lib/week';

export function AddToWeekPicker({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('');
  const weekId = getCurrentWeekId();
  const results = useLiveQuery(
    () =>
      db.tasks
        .filter(
          (t) =>
            t.weekly?.weekId !== weekId &&
            t.title.toLowerCase().includes(query.toLowerCase()) &&
            query.trim().length > 0,
        )
        .toArray(),
    [query, weekId],
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
                await addToWeek(task.id, weekId);
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

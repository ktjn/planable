import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { addToKanban } from '../../db/repositories/taskMembership';
import { fireAndForget } from '../../lib/fireAndForget';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';

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
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add task to Kanban</DialogTitle>
        </DialogHeader>
        <Input
          autoFocus
          placeholder="Search tasks"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto">
          {results.map((task) => (
            <li key={task.id}>
              <button
                className="w-full rounded-md px-2 py-1.5 text-left hover:bg-muted"
                onClick={() => {
                  fireAndForget(addToKanban(task.id).then(onClose));
                }}
              >
                {task.title}
              </button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { addToWeek } from '../../db/repositories/taskMembership';
import { getCurrentWeekId } from '../../lib/week';
import { SETTING_ACTIVE_WEEK } from '../../db/repositories/settings';
import { fireAndForget } from '../../lib/fireAndForget';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';

export function AddToWeekPicker({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('');
  const activeWeekSetting = useLiveQuery(() => db.settings.get(SETTING_ACTIVE_WEEK), [], undefined);
  const weekId =
    (typeof activeWeekSetting?.value === 'string' && activeWeekSetting.value) || getCurrentWeekId();
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
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add task to this week</DialogTitle>
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
                  fireAndForget(addToWeek(task.id, weekId).then(onClose));
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

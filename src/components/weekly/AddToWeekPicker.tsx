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
  const projects = useLiveQuery(() => db.projects.toArray(), [], []);
  const projectById = new Map((projects ?? []).map((p) => [p.id, p]));

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
        <ul className="flex max-h-72 flex-col gap-1.5 overflow-y-auto">
          {results.map((task) => (
            <li key={task.id}>
              <button
                className="flex w-full items-center justify-between gap-2 rounded-lg border border-border/60 bg-background px-3 py-2 text-left text-sm shadow-sm transition-colors hover:border-primary/30 hover:bg-muted/40"
                onClick={() => {
                  fireAndForget(addToWeek(task.id, weekId).then(onClose));
                }}
              >
                <span className="truncate">{task.title}</span>
                {projectById.get(task.projectId) && (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {projectById.get(task.projectId)!.name}
                  </span>
                )}
              </button>
            </li>
          ))}
          {query.trim() && results.length === 0 && (
            <li className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
              No tasks match “{query}”.
            </li>
          )}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { addContainerToKanban } from '../../db/repositories/containers';
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
      db.containers
        .filter(
          (c) =>
            !c.archived &&
            c.kanban === null &&
            c.id !== 'inbox-container' &&
            c.name.toLowerCase().includes(query.toLowerCase()) &&
            query.trim().length > 0,
        )
        .toArray(),
    [query],
    [],
  );
  const projects = useLiveQuery(() => db.projects.toArray(), [], []);
  const projectById = new Map((projects ?? []).map((p) => [p.id, p]));

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add container to Kanban</DialogTitle>
        </DialogHeader>
        <Input
          autoFocus
          placeholder="Search containers"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <ul className="flex max-h-72 flex-col gap-1.5 overflow-y-auto">
          {results.map((container) => (
            <li key={container.id}>
              <button
                className="flex w-full items-center justify-between gap-2 rounded-lg border border-border/60 bg-background px-3 py-2 text-left text-sm shadow-sm transition-colors hover:border-primary/30 hover:bg-muted/40"
                onClick={() => {
                  fireAndForget(addContainerToKanban(container.id).then(onClose));
                }}
              >
                <span className="truncate">{container.name}</span>
                {projectById.get(container.projectId) && (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {projectById.get(container.projectId)!.name}
                  </span>
                )}
              </button>
            </li>
          ))}
          {query.trim() && results.length === 0 && (
            <li className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
              No containers match “{query}”.
            </li>
          )}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

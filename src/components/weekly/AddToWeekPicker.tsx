import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { addToWeek } from '../../db/repositories/taskMembership';
import { addContainerToWeek } from '../../db/repositories/containers';
import { getCurrentWeekId } from '../../lib/week';
import { SETTING_ACTIVE_WEEK } from '../../db/repositories/settings';
import { fireAndForget } from '../../lib/fireAndForget';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../../components/ui/tabs';
import { Input } from '../../components/ui/input';

type Tab = 'tasks' | 'containers';

export function AddToWeekPicker({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<Tab>('tasks');
  const activeWeekSetting = useLiveQuery(() => db.settings.get(SETTING_ACTIVE_WEEK), [], undefined);
  const weekId =
    (typeof activeWeekSetting?.value === 'string' && activeWeekSetting.value) || getCurrentWeekId();
  const q = query.trim().toLowerCase();
  const containers = useLiveQuery(() => db.containers.toArray(), [], []);
  const containerById = new Map((containers ?? []).map((c) => [c.id, c]));

  const taskResults = useLiveQuery(
    () =>
      db.tasks
        .filter(
          (t) =>
            t.weekly?.weekId !== weekId &&
            !t.archived &&
            !containerById.get(t.containerId)?.archived &&
            t.title.toLowerCase().includes(q) &&
            q.length > 0,
        )
        .toArray(),
    [q, weekId, containers],
    [],
  );
  const containerResults = useLiveQuery(
    () =>
      db.containers
        .filter(
          (c) =>
            !c.archived && c.weekly?.weekId !== weekId && c.name.toLowerCase().includes(q) && q.length > 0,
        )
        .toArray(),
    [q, weekId],
    [],
  );
  const projects = useLiveQuery(() => db.projects.toArray(), [], []);
  const projectById = new Map((projects ?? []).map((p) => [p.id, p]));

  const isContainers = tab === 'containers';
  const results = isContainers ? containerResults : taskResults;
  const placeholder = isContainers ? 'Search containers' : 'Search tasks';
  const noMatch = isContainers ? 'No containers match' : 'No tasks match';

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add to this week</DialogTitle>
        </DialogHeader>
        <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)}>
          <TabsList className="mb-2 w-full">
            <TabsTrigger value="tasks" className="flex-1">
              Tasks
            </TabsTrigger>
            <TabsTrigger value="containers" className="flex-1">
              Containers
            </TabsTrigger>
          </TabsList>
          <Input
            autoFocus
            placeholder={placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <TabsContent value="tasks">
            <ul className="flex max-h-72 flex-col gap-1.5 overflow-y-auto">
              {taskResults.map((task) => (
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
              {q.length > 0 && taskResults.length === 0 && (
                <li className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
                  {noMatch} “{query}”.
                </li>
              )}
            </ul>
          </TabsContent>
          <TabsContent value="containers">
            <ul className="flex max-h-72 flex-col gap-1.5 overflow-y-auto">
              {containerResults.map((container) => (
                <li key={container.id}>
                  <button
                    className="flex w-full items-center justify-between gap-2 rounded-lg border border-border/60 bg-background px-3 py-2 text-left text-sm shadow-sm transition-colors hover:border-primary/30 hover:bg-muted/40"
                    onClick={() => {
                      fireAndForget(addContainerToWeek(container.id, weekId).then(onClose));
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
              {q.length > 0 && containerResults.length === 0 && (
                <li className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
                  {noMatch} “{query}”.
                </li>
              )}
            </ul>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

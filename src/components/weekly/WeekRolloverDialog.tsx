import { useEffect, useState } from 'react';
import { ArrowRight, Trash2, CheckCircle2, RotateCcw, FolderInput, Folder } from 'lucide-react';
import {
  getUnresolvedTasks,
  resolveTask,
  getUnresolvedContainers,
  resolveContainer,
} from '../../lib/rollover';
import { getWeekLabel } from '../../lib/week';
import { fireAndForget } from '../../lib/fireAndForget';
import type { Task, Container } from '../../db/schema';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { Button } from '../../components/ui/button';

export function WeekRolloverDialog({
  weekId,
  nextWeekId,
  onClose,
  onAdvanced,
}: {
  weekId: string;
  nextWeekId: string;
  onClose: () => void;
  onAdvanced: () => void;
}) {
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [containers, setContainers] = useState<Container[] | null>(null);
  const [resolvedTaskIds, setResolvedTaskIds] = useState<string[]>([]);
  const [resolvedContainerIds, setResolvedContainerIds] = useState<string[]>([]);

  useEffect(() => {
    void getUnresolvedTasks(weekId).then(setTasks);
    void getUnresolvedContainers(weekId).then(setContainers);
  }, [weekId]);

  const remainingTasks = tasks?.filter((t) => !resolvedTaskIds.includes(t.id)) ?? [];
  const remainingContainers = containers?.filter((c) => !resolvedContainerIds.includes(c.id)) ?? [];
  const allResolved = tasks !== null && containers !== null && remainingTasks.length === 0 && remainingContainers.length === 0;

  function resolveTaskNow(task: Task) {
    fireAndForget(resolveTask(task.id, 'move').then(() => setResolvedTaskIds((prev) => [...prev, task.id])));
  }

  function resolveContainerNow(container: Container) {
    fireAndForget(
      resolveContainer(container.id, 'move').then(() =>
        setResolvedContainerIds((prev) => [...prev, container.id]),
      ),
    );
  }

  return (
    <Dialog open>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Start a new week</DialogTitle>
          <DialogDescription>
            {getWeekLabel(weekId)} → {getWeekLabel(nextWeekId)}. Resolve every scheduled
            Container and unfinished task: nothing moves to the next week automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <section>
            <h3 className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold">
              <Folder className="size-4" />
              Containers ({remainingContainers.length})
            </h3>
            <ul className="flex max-h-48 flex-col gap-1.5 overflow-y-auto">
              {containers === null && <li className="text-sm text-muted-foreground">Checking scheduled containers…</li>}
              {containers !== null && remainingContainers.length === 0 && (
                <li className="rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                  No scheduled containers.
                </li>
              )}
              {remainingContainers.map((container) => (
                <li key={container.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
                  <span className="min-w-0 truncate text-sm">{container.name}</span>
                  <span className="flex shrink-0 gap-1">
                    <Button size="xs" variant="secondary" title="Move to next week" onClick={() => resolveContainerNow(container)}>
                      <ArrowRight />
                      Next week
                    </Button>
                    <Button
                      size="xs"
                      variant="ghost"
                      title="Return to project"
                      onClick={() =>
                        fireAndForget(
                          resolveContainer(container.id, 'return').then(() =>
                            setResolvedContainerIds((p) => [...p, container.id]),
                          ),
                        )
                      }
                    >
                      <FolderInput />
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="mb-1.5 text-sm font-semibold">Tasks ({remainingTasks.length})</h3>
            <ul className="flex max-h-48 flex-col gap-1.5 overflow-y-auto">
              {tasks === null && <li className="text-sm text-muted-foreground">Checking unfinished tasks…</li>}
              {tasks !== null && remainingTasks.length === 0 && (
                <li className="rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                  All tasks are resolved.
                </li>
              )}
              {remainingTasks.map((task) => (
                <li key={task.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
                  <span className="min-w-0 truncate text-sm">{task.title}</span>
                  <span className="flex shrink-0 gap-1">
                    <Button size="xs" variant="secondary" title="Move to next week" onClick={() => resolveTaskNow(task)}>
                      <ArrowRight />
                      Next week
                    </Button>
                    <Button
                      size="xs"
                      variant="ghost"
                      title="Return to project"
                      onClick={() => fireAndForget(resolveTask(task.id, 'return').then(() => setResolvedTaskIds((p) => [...p, task.id])))}
                    >
                      <FolderInput />
                    </Button>
                    <Button
                      size="xs"
                      variant="ghost"
                      title="Mark complete"
                      onClick={() => fireAndForget(resolveTask(task.id, 'complete').then(() => setResolvedTaskIds((p) => [...p, task.id])))}
                    >
                      <CheckCircle2 />
                    </Button>
                    <Button
                      size="xs"
                      variant="ghost"
                      className="text-destructive"
                      title="Delete task"
                      onClick={() => {
                        if (window.confirm(`Delete "${task.title}"? This cannot be undone.`)) {
                          fireAndForget(resolveTask(task.id, 'delete').then(() => setResolvedTaskIds((p) => [...p, task.id])));
                        }
                      }}
                    >
                      <Trash2 />
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!allResolved} onClick={() => {
            onAdvanced();
            onClose();
          }}>
            <RotateCcw />
            Start next week
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

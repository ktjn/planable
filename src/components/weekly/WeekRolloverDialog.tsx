import { useEffect, useState } from 'react';
import { ArrowRight, Trash2, CheckCircle2, RotateCcw, FolderInput } from 'lucide-react';
import { getUnresolvedTasks, resolveTask } from '../../lib/rollover';
import { getWeekLabel } from '../../lib/week';
import { fireAndForget } from '../../lib/fireAndForget';
import type { Task } from '../../db/schema';
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
  const [resolvedIds, setResolvedIds] = useState<string[]>([]);

  useEffect(() => {
    void getUnresolvedTasks(weekId).then(setTasks);
  }, [weekId]);

  const remaining = tasks?.filter((t) => !resolvedIds.includes(t.id)) ?? [];
  const allResolved = remaining.length === 0;

  function resolve(task: Task) {
    fireAndForget(resolveTask(task.id, 'move').then(() => setResolvedIds((prev) => [...prev, task.id])));
  }

  return (
    <Dialog open>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Start a new week</DialogTitle>
          <DialogDescription>
            {getWeekLabel(weekId)} → {getWeekLabel(nextWeekId)}. Resolve every unfinished task:
            nothing moves to the next week automatically.
          </DialogDescription>
        </DialogHeader>

        <ul className="flex max-h-72 flex-col gap-1.5 overflow-y-auto">
          {tasks === null && <li className="text-sm text-muted-foreground">Checking unfinished tasks…</li>}
          {tasks !== null && remaining.length === 0 && (
            <li className="rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
              All finished tasks are resolved — ready to advance.
            </li>
          )}
          {remaining.map((task) => (
            <li key={task.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
              <span className="min-w-0 truncate text-sm">{task.title}</span>
              <span className="flex shrink-0 gap-1">
                <Button size="xs" variant="secondary" title="Move to next week" onClick={() => resolve(task)}>
                  <ArrowRight />
                  Next week
                </Button>
                <Button
                  size="xs"
                  variant="ghost"
                  title="Return to project"
                  onClick={() => fireAndForget(resolveTask(task.id, 'return').then(() => setResolvedIds((p) => [...p, task.id])))}
                >
                  <FolderInput />
                </Button>
                <Button
                  size="xs"
                  variant="ghost"
                  title="Mark complete"
                  onClick={() => fireAndForget(resolveTask(task.id, 'complete').then(() => setResolvedIds((p) => [...p, task.id])))}
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
                      fireAndForget(resolveTask(task.id, 'delete').then(() => setResolvedIds((p) => [...p, task.id])));
                    }
                  }}
                >
                  <Trash2 />
                </Button>
              </span>
            </li>
          ))}
        </ul>

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

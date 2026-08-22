import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { createTask, updateTask, deleteTask, setTaskArchived } from '../../db/repositories/tasks';
import { listLabels } from '../../db/repositories/labels';
import { setTaskRepeatWeekly } from '../../db/repositories/taskMembership';
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
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';

export function TaskDialog({
  mode,
  projectId,
  containerId,
  task,
  onClose,
}: {
  mode: 'create' | 'edit';
  projectId: string;
  containerId: string;
  task?: Task;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [labels, setLabels] = useState<string[]>(task?.labels ?? []);
  const [repeatWeekly, setRepeatWeekly] = useState(task?.weekly?.repeatWeekly ?? false);
  const allLabels = useLiveQuery(listLabels, [], []);

  async function save() {
    if (!title.trim()) return;
    if (mode === 'create') {
      await createTask({ title: title.trim(), description, labels, projectId, containerId });
    } else if (task) {
      await updateTask(task.id, { title: title.trim(), description, labels });
      if (task.weekly?.repeatWeekly !== repeatWeekly) {
        await setTaskRepeatWeekly(task.id, repeatWeekly);
      } else if (repeatWeekly) {
        // Keep the template's definition in sync with the edited task.
        await setTaskRepeatWeekly(task.id, true);
      }
    }
    onClose();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === 'edit' ? 'Edit task' : 'New task'}</DialogTitle>
          <DialogDescription>
            {mode === 'edit' ? 'Update the task details.' : 'Describe a new task in this container.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="task-title">Title</Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="task-description">Description</Label>
            <Textarea
              id="task-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Markdown supported"
            />
          </div>

          <fieldset className="grid gap-2">
            <legend className="text-sm font-medium">Labels</legend>
            <div className="flex flex-wrap gap-2">
              {allLabels.map((label) => (
                <label key={label.id} className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    className="size-4 rounded border"
                    checked={labels.includes(label.id)}
                    onChange={(e) =>
                      setLabels((prev) =>
                        e.target.checked ? [...prev, label.id] : prev.filter((l) => l !== label.id),
                      )
                    }
                  />
                  {label.name}
                </label>
              ))}
            </div>
          </fieldset>

          <label className="flex items-center gap-2" htmlFor="task-repeat-weekly">
            <input
              id="task-repeat-weekly"
              type="checkbox"
              className="size-4 rounded border"
              checked={repeatWeekly}
              onChange={(e) => setRepeatWeekly(e.target.checked)}
            />
            <span className="text-sm">Repeat every week</span>
          </label>
        </div>

        <DialogFooter>
          <div className="mr-auto flex items-center gap-2">
            {mode === 'edit' && task && (
              <>
                {!task.archived ? (
                  <Button
                    variant="outline"
                    className="text-muted-foreground"
                    onClick={async () => {
                      await setTaskArchived(task.id, true);
                      onClose();
                    }}
                  >
                    Archive
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    className="text-muted-foreground"
                    onClick={async () => {
                      await setTaskArchived(task.id, false);
                      onClose();
                    }}
                  >
                    Unarchive
                  </Button>
                )}
                <Button
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={async () => {
                    await deleteTask(task.id);
                    onClose();
                  }}
                >
                  Delete
                </Button>
              </>
            )}
          </div>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

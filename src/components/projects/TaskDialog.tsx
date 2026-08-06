import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { createTask, updateTask, deleteTask } from '../../db/repositories/tasks';
import { listLabels } from '../../db/repositories/labels';
import type { Task } from '../../db/schema';

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
  const allLabels = useLiveQuery(listLabels, [], []);

  async function save() {
    if (!title.trim()) return;
    if (mode === 'create') {
      await createTask({ title: title.trim(), description, labels, projectId, containerId });
    } else if (task) {
      await updateTask(task.id, { title: title.trim(), description, labels });
    }
    onClose();
  }

  return (
    <div role="dialog" className="fixed inset-0 flex items-center justify-center bg-black/30">
      <div className="w-96 rounded bg-white p-4">
        <label htmlFor="task-title">Title</label>
        <input id="task-title" value={title} onChange={(e) => setTitle(e.target.value)} className="mb-2 block w-full border" />

        <label htmlFor="task-description">Description</label>
        <textarea
          id="task-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="mb-2 block w-full border"
        />

        <fieldset className="mb-2">
          <legend>Labels</legend>
          {allLabels.map((label) => (
            <label key={label.id} className="mr-2">
              <input
                type="checkbox"
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
        </fieldset>

        <div className="flex justify-between">
          {mode === 'edit' && task && (
            <button
              onClick={async () => {
                await deleteTask(task.id);
                onClose();
              }}
            >
              Delete
            </button>
          )}
          <div className="ml-auto flex gap-2">
            <button onClick={onClose}>Cancel</button>
            <button onClick={save}>Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useLiveQuery } from 'dexie-react-hooks';
import { listTasksByContainer } from '../../db/repositories/tasks';
import { renameContainer, deleteContainer } from '../../db/repositories/containers';
import type { Container } from '../../db/schema';

export function ContainerColumn({ container }: { container: Container }) {
  const tasks = useLiveQuery(() => listTasksByContainer(container.id), [container.id], []);

  return (
    <div className="w-64 shrink-0 rounded border border-gray-200 p-2">
      <div className="mb-2 flex items-center justify-between">
        <input
          className="font-medium"
          defaultValue={container.name}
          onBlur={(e) => {
            if (e.target.value.trim() && e.target.value !== container.name) {
              void renameContainer(container.id, e.target.value.trim());
            }
          }}
        />
        <button
          aria-label={`Delete ${container.name}`}
          onClick={() => void deleteContainer(container.id)}
        >
          ×
        </button>
      </div>
      <ul>
        {tasks.map((task) => (
          <li key={task.id} className="py-1">
            {task.title}
          </li>
        ))}
      </ul>
    </div>
  );
}

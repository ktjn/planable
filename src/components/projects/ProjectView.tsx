import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { listContainersByProject, createContainer } from '../../db/repositories/containers';
import { ContainerColumn } from './ContainerColumn';

export function ProjectView({ projectId }: { projectId: string }) {
  const containers = useLiveQuery(() => listContainersByProject(projectId), [projectId], []);
  const [newName, setNewName] = useState('');

  return (
    <div>
      <div className="mb-4 flex gap-2">
        <input
          className="border border-gray-300 px-2 py-1"
          placeholder="New container name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button
          onClick={async () => {
            if (!newName.trim()) return;
            await createContainer(projectId, newName.trim());
            setNewName('');
          }}
        >
          Add container
        </button>
      </div>
      <div className="flex gap-4">
        {containers.map((container) => (
          <ContainerColumn key={container.id} container={container} />
        ))}
      </div>
    </div>
  );
}

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { addContainerToKanban } from '../../db/repositories/containers';
import { fireAndForget } from '../../lib/fireAndForget';
import { EntityPicker } from '../shared/EntityPicker';

export function AddToKanbanPicker({ onClose }: { onClose: () => void }) {
  const containers = useLiveQuery(
    () =>
      db.containers
        .filter((c) => !c.archived && c.kanban === null && c.id !== 'inbox-container')
        .toArray(),
    [],
    [],
  );
  const projects = useLiveQuery(() => db.projects.toArray(), [], []);
  const projectById = new Map((projects ?? []).map((p) => [p.id, p]));

  const entities = (containers ?? []).map((c) => ({
    id: c.id,
    title: c.name,
    subtitle: projectById.get(c.projectId)?.name,
  }));

  return (
    <EntityPicker
      open
      onOpenChange={(open) => !open && onClose()}
      title="Add container to Kanban"
      placeholder="Search containers"
      entities={entities}
      onSelect={(id) => fireAndForget(addContainerToKanban(id).then(onClose))}
      emptyMessage="No containers match your search."
    />
  );
}

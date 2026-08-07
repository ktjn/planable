import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { Layers } from 'lucide-react';
import { db } from '../../db/db';
import { listLabels } from '../../db/repositories/labels';
import { listTasksByContainer, createTask } from '../../db/repositories/tasks';
import { isContainerVisible } from '../../lib/entityVisibility';
import type { Container, Label } from '../../db/schema';
import { Badge } from '../ui/badge';
import { EntityLabels } from '../shared/EntityLabels';
import { QuickAddRow } from '../shared/QuickAddRow';
import { ContainerDialog } from '../projects/ContainerDialog';

export function AllContainersView() {
  const containers = useLiveQuery(
    () => db.containers.toArray().then((arr) => arr.filter(isContainerVisible)),
    [],
    [],
  );
  const projects = useLiveQuery(() => db.projects.toArray(), [], []);
  const labels = useLiveQuery(listLabels, [], []);
  const allTasks = useLiveQuery(() => db.tasks.toArray(), [], []);
  const labelsById = useMemo(() => new Map((labels ?? []).map((l) => [l.id, l])), [labels]);
  const projectById = useMemo(
    () => new Map((projects ?? []).map((p) => [p.id, p])),
    [projects],
  );
  const countByContainer = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of allTasks ?? []) map.set(t.containerId, (map.get(t.containerId) ?? 0) + 1);
    return map;
  }, [allTasks]);

  const sorted = useMemo(
    () =>
      [...(containers ?? [])].sort((a, b) => {
        const pa = projectById.get(a.projectId)?.order ?? Number.MAX_SAFE_INTEGER;
        const pb = projectById.get(b.projectId)?.order ?? Number.MAX_SAFE_INTEGER;
        if (pa !== pb) return pa - pb;
        const na = projectById.get(a.projectId)?.name ?? '';
        const nb = projectById.get(b.projectId)?.name ?? '';
        if (na !== nb) return na.localeCompare(nb);
        if (a.order !== b.order) return a.order - b.order;
        return a.name.localeCompare(b.name);
      }),
    [containers, projectById],
  );

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center gap-3">
        <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <Layers className="size-4" />
        </div>
        <div>
          <h2 className="text-lg font-semibold tracking-tight">All Containers</h2>
          <p className="text-sm text-muted-foreground">Every container across every project</p>
        </div>
      </div>
      <ul className="flex flex-col gap-1.5">
        {sorted.map((container) => (
          <ContainerRow
            key={container.id}
            container={container}
            labelsById={labelsById}
            taskCount={countByContainer.get(container.id) ?? 0}
          >
            {projectById.get(container.projectId)?.name && (
              <span className="shrink-0 text-xs text-muted-foreground">
                {projectById.get(container.projectId)!.name}
              </span>
            )}
          </ContainerRow>
        ))}
        {sorted.length === 0 && (
          <li className="py-10 text-center text-sm text-muted-foreground">No containers yet.</li>
        )}
      </ul>
    </div>
  );
}

function ContainerRow({
  container,
  labelsById,
  taskCount,
  children,
}: {
  container: Container;
  labelsById: Map<string, Label>;
  taskCount: number;
  children: React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const tasks = useLiveQuery(() => listTasksByContainer(container.id), [container.id], []);

  return (
    <>
      <li
        onDoubleClick={() => setEditing(true)}
        className="flex flex-col gap-2 rounded-xl border border-border/70 bg-card px-3 py-2.5 shadow-sm"
      >
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-foreground">{container.name}</span>
            <span className="mt-0.5 flex items-center gap-2">
              {children}
              {container.weekly && (
                <Badge variant="secondary">Week: {container.weekly.day}</Badge>
              )}
              {container.kanban && (
                <Badge variant="secondary">Kanban: {container.kanban.status}</Badge>
              )}
              <span className="shrink-0 text-xs text-muted-foreground">
                {taskCount} {taskCount === 1 ? 'task' : 'tasks'}
              </span>
            </span>
          </div>
          <EntityLabels labelIds={container.labels} labelsById={labelsById} />
        </div>
        <QuickAddRow
          onAdd={async (title) => {
            await createTask({ title, projectId: container.projectId, containerId: container.id });
          }}
        />
      </li>
      {editing && <ContainerDialog container={container} onClose={() => setEditing(false)} />}
    </>
  );
}

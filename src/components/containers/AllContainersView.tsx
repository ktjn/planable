import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { Layers, ChevronRight, ChevronDown } from 'lucide-react';
import { db } from '../../db/db';
import { listLabels } from '../../db/repositories/labels';
import { createTask } from '../../db/repositories/tasks';
import { isContainerVisible } from '../../lib/entityVisibility';
import type { Container, Label, Project } from '../../db/schema';
import { Badge } from '../ui/badge';
import { EntityLabels } from '../shared/EntityLabels';
import { QuickAddRow } from '../shared/QuickAddRow';
import { SortedTaskList } from '../shared/SortedTaskList';
import { ContainerDialog } from '../projects/ContainerDialog';
import { EntityHoverCard, ContainerHoverCardContent } from '../shared/EntityHoverCard';

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
  const containerById = useMemo(
    () => new Map((containers ?? []).map((c) => [c.id, c])),
    [containers],
  );

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
            projectById={projectById}
            containerById={containerById}
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
  projectById,
  containerById,
  children,
}: {
  container: Container;
  labelsById: Map<string, Label>;
  taskCount: number;
  projectById?: Map<string, Project>;
  containerById?: Map<string, Container>;
  children: React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <li
        onDoubleClick={() => setEditing(true)}
        className="flex flex-col gap-2 rounded-xl border border-border/70 bg-card px-3 py-2.5 shadow-sm"
      >
        <div className="flex items-center gap-2">
          <button
            aria-label={expanded ? `Collapse ${container.name}` : `Expand ${container.name}`}
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
            className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
          <EntityHoverCard
            content={
              <ContainerHoverCardContent
                container={container}
                projectById={projectById ?? new Map()}
                labelsById={labelsById}
                taskCount={taskCount}
              />
            }
          >
            <div className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-foreground">{container.name}</span>
              <span className="mt-0.5 flex items-center gap-2">
                {children}
                {container.kanban && (
                  <Badge variant="secondary">Kanban: {container.kanban.status}</Badge>
                )}
                <span className="shrink-0 text-xs text-muted-foreground">
                  {taskCount} {taskCount === 1 ? 'task' : 'tasks'}
                </span>
              </span>
            </div>
          </EntityHoverCard>
          <EntityLabels labelIds={container.labels} labelsById={labelsById} />
        </div>
        {expanded && (
          <SortedTaskList
            containerId={container.id}
            labelsById={labelsById}
            containerById={containerById}
            projectById={projectById}
          />
        )}
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

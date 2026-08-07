import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Search } from 'lucide-react';
import { db } from '../../db/db';
import type { Task, Container as ContainerEntity, Label } from '../../db/schema';
import { listLabels } from '../../db/repositories/labels';
import { isTaskEffectivelyArchived } from '../../lib/entityVisibility';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { EntityLabels } from '../shared/EntityLabels';
import { TaskDialog } from '../projects/TaskDialog';
import { ContainerDialog } from '../projects/ContainerDialog';

interface SearchResult {
  entity: Task | ContainerEntity;
  kind: 'task' | 'container';
  matchName: string;
  archived: boolean;
  effectivelyArchived?: boolean;
}

function normalize(s: string): string {
  return s.toLowerCase().trim();
}

function score(query: string, name: string): number {
  const q = normalize(query);
  const n = normalize(name);
  if (n === q) return 0;
  if (n.includes(q)) return 1;
  return 2;
}

export function SearchView({ onOpenTask }: { onOpenTask?: (task: Task) => void }) {
  const [query, setQuery] = useState('');
  const q = query.trim();
  const tasks = useLiveQuery(
    () =>
      db.tasks
        .filter(
          (t) =>
            t.title.toLowerCase().includes(q.toLowerCase()) ||
            t.description.toLowerCase().includes(q.toLowerCase()),
        )
        .toArray(),
    [q],
    [],
  );
  const containers = useLiveQuery(
    () => db.containers.filter((c) => c.name.toLowerCase().includes(q.toLowerCase())).toArray(),
    [q],
    [],
  );
  const projects = useLiveQuery(() => db.projects.toArray(), [], []);
  const containersAll = useLiveQuery(() => db.containers.toArray(), [], []);
  const labels = useLiveQuery(listLabels, [], []);

  const projectById = useMemo(
    () => new Map((projects ?? []).map((p) => [p.id, p])),
    [projects],
  );
  const containerById = useMemo(
    () => new Map((containersAll ?? []).map((c) => [c.id, c])),
    [containersAll],
  );
  const labelsById = useMemo(() => new Map((labels ?? []).map((l) => [l.id, l])), [labels]);

  const [editing, setEditing] = useState<{ kind: 'task' | 'container'; entity: Task | ContainerEntity } | null>(null);

  const { active, archived } = useMemo(() => {
    const results: SearchResult[] = [];
    for (const c of containers ?? []) {
      results.push({
        entity: c,
        kind: 'container',
        matchName: c.name,
        archived: c.archived,
      });
    }
    for (const t of tasks ?? []) {
      const effectively = isTaskEffectivelyArchived(t, containerById);
      results.push({
        entity: t,
        kind: 'task',
        matchName: t.title,
        archived: effectively,
        effectivelyArchived: effectively && !t.archived,
      });
    }
    const placed = results
      .filter((r) => q.length > 0)
      .map((r) => ({ ...r, s: score(q, r.matchName) }))
      .sort(
        (a, b) =>
          a.s - b.s || a.matchName.localeCompare(b.matchName),
      );
    return {
      active: placed.filter((r) => !r.archived),
      archived: placed.filter((r) => r.archived),
    };
  }, [tasks, containers, q, containerById]);

  function handleSingleClick(r: SearchResult) {
    if (r.kind === 'task' && !r.archived) {
      onOpenTask?.(r.entity as Task);
      setQuery('');
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center gap-3">
        <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <Search className="size-4" />
        </div>
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Search</h2>
          <p className="text-sm text-muted-foreground">Find tasks and containers across all projects</p>
        </div>
      </div>
      <div className="relative">
        <Search className="absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          autoFocus
          placeholder="Search tasks, descriptions, and containers…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-10 rounded-xl pl-8"
        />
      </div>
      <ul className="mt-4 flex flex-col gap-1.5">
        {active.map((r) => (
          <ResultRow
            key={`a-${r.kind}-${r.entity.id}`}
            result={r}
            projectName={projectById.get(r.entity.projectId)?.name}
            labelsById={labelsById}
            onSingleClick={() => handleSingleClick(r)}
            onDoubleClick={() => setEditing({ kind: r.kind, entity: r.entity })}
          />
        ))}
        {archived.length > 0 && (
          <li className="mt-2 flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Archived
            </span>
            <span className="h-px flex-1 bg-border/70" />
          </li>
        )}
        {archived.map((r) => (
          <ResultRow
            key={`arc-${r.kind}-${r.entity.id}`}
            result={r}
            projectName={projectById.get(r.entity.projectId)?.name}
            labelsById={labelsById}
            onSingleClick={() => handleSingleClick(r)}
            onDoubleClick={() => setEditing({ kind: r.kind, entity: r.entity })}
          />
        ))}
        {q.length > 0 && active.length === 0 && archived.length === 0 && (
          <li className="rounded-xl border border-dashed border-border bg-muted/30 px-6 py-10 text-center text-sm text-muted-foreground">
            Nothing matches “{query}”.
          </li>
        )}
        {!q && (
          <li className="py-10 text-center text-sm text-muted-foreground">
            Type to search titles, descriptions, and container names.
          </li>
        )}
      </ul>
      {editing?.kind === 'task' && (
        <TaskDialog
          mode="edit"
          projectId={(editing.entity as Task).projectId}
          containerId={(editing.entity as Task).containerId}
          task={editing.entity as Task}
          onClose={() => setEditing(null)}
        />
      )}
      {editing?.kind === 'container' && (
        <ContainerDialog
          container={editing.entity as ContainerEntity}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function ResultRow({
  result,
  projectName,
  labelsById,
  onSingleClick,
  onDoubleClick,
}: {
  result: SearchResult;
  projectName?: string;
  labelsById: Map<string, Label>;
  onSingleClick: () => void;
  onDoubleClick: () => void;
}) {
  const { entity, kind } = result;
  return (
    <li
      onDoubleClick={onDoubleClick}
      className={`flex items-center gap-2 rounded-xl border border-border/70 bg-card px-3 py-2.5 shadow-sm transition-colors hover:border-input hover:bg-accent/30 ${
        result.archived ? 'opacity-70' : ''
      }`}
    >
      <button
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
        onClick={onSingleClick}
      >
        <span className={`truncate ${kind === 'container' ? 'font-medium' : ''}`}>
          {kind === 'container' ? (entity as ContainerEntity).name : (entity as Task).title}
        </span>
        {projectName && <span className="shrink-0 text-xs text-muted-foreground">{projectName}</span>}
        {(entity as Task).weekly && (
          <Badge variant="secondary" className="hidden sm:inline-flex">
            {(entity as Task).weekly!.repeatWeekly ? 'Repeats weekly' : `Week: ${(entity as Task).weekly!.day}`}
          </Badge>
        )}
      </button>
      <EntityLabels labelIds={(entity as Task).labels ?? (entity as ContainerEntity).labels} labelsById={labelsById} />
      {(entity as ContainerEntity).kanban && kind === 'container' && (
        <Badge variant="secondary">Kanban: {(entity as ContainerEntity).kanban!.status}</Badge>
      )}
      {result.effectivelyArchived ? (
        <Badge variant="outline">Archived container</Badge>
      ) : result.archived ? (
        <Badge variant="outline">Archived</Badge>
      ) : (entity as Task).completed ? (
        <Badge variant="outline">Done</Badge>
      ) : null}
    </li>
  );
}

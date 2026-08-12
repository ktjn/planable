import { db } from '../db/db';
import type { Container, Label, Project, Task } from '../db/schema';
import type { ConsoleEntityKind, ItemQuery, QueryFilter, QueryTerm } from './consoleQuery';
import { searchItems, parseBool, STATUS_ALIASES, type ConsoleItemResult, type ConsoleSearchContext } from './consoleSearch';
import { computeBatchPatch, withLabel, withoutLabel, type BatchOperation } from './consoleBatch';
import type { SqlAssignment, SqlWhere } from './sqlLanguage';
import { deleteTask, setTaskArchived, setTaskCompleted, updateTask } from '../db/repositories/tasks';
import { deleteContainer, setContainerArchived, setContainerKanbanStatus, updateContainer } from '../db/repositories/containers';
import { deleteProject } from '../db/repositories/projects';
import { deleteLabel } from '../db/repositories/labels';

export interface OverlayData {
  tasks: Task[];
  containers: Container[];
  projects: Project[];
  labels: Label[];
}

export interface PendingChange {
  changeId: string;
  table: ConsoleEntityKind;
  entityId: string;
  entityLabel: string;
  kind: 'update' | 'delete';
  operation?: BatchOperation;
  /** Field patch this change would apply, used to preview it against live data before commit. */
  patch?: Partial<Task & Container>;
}

const CATEGORICAL_FIELDS = new Set([
  'label',
  'status',
  'day',
  'project',
  'done',
  'completed',
  'archived',
  'repeat',
  'color',
  'kanban',
]);

/** Translates a parsed SQL WHERE clause into the same filter/term shape the plain query language uses. */
export function whereToItemQuery(table: ConsoleEntityKind, where: SqlWhere | null): ItemQuery {
  const filters: QueryFilter[] = [];
  const terms: QueryTerm[] = [];
  for (const cond of where?.conditions ?? []) {
    // WHERE 1=1 is the documented "match every row" escape hatch.
    if (cond.field === '1' && cond.value === '1' && cond.op === '=') continue;
    const negate = cond.op === '!=';
    if (CATEGORICAL_FIELDS.has(cond.field)) {
      filters.push({ field: cond.field, value: cond.value.toLowerCase(), negate });
    } else {
      const text = cond.value.toLowerCase().replace(/^%+|%+$/g, '');
      terms.push({ text, negate });
    }
  }
  return { kind: 'items', types: [table], filters, terms };
}

export function resolveMatches(table: ConsoleEntityKind, where: SqlWhere | null, ctx: ConsoleSearchContext): ConsoleItemResult[] {
  return searchItems(whereToItemQuery(table, where), ctx);
}

/** Applies staged sandbox changes to a live data snapshot, so SELECT/WHERE see the would-be result. */
export function applyPendingOverlay(base: OverlayData, changes: PendingChange[]): OverlayData {
  const taskMap = new Map(base.tasks.map((t) => [t.id, { ...t }]));
  const containerMap = new Map(base.containers.map((c) => [c.id, { ...c }]));
  const deletedProjects = new Set<string>();
  const deletedLabels = new Set<string>();

  for (const change of changes) {
    if (change.kind === 'delete') {
      if (change.table === 'task') taskMap.delete(change.entityId);
      else if (change.table === 'container') containerMap.delete(change.entityId);
      else if (change.table === 'project') deletedProjects.add(change.entityId);
      else if (change.table === 'label') deletedLabels.add(change.entityId);
      continue;
    }
    if (!change.patch) continue;
    if (change.table === 'task') {
      const task = taskMap.get(change.entityId);
      if (task) Object.assign(task, change.patch);
    } else if (change.table === 'container') {
      const container = containerMap.get(change.entityId);
      if (container) Object.assign(container, change.patch);
    }
  }

  return {
    tasks: [...taskMap.values()],
    containers: [...containerMap.values()],
    projects: base.projects.filter((p) => !deletedProjects.has(p.id)),
    labels: base.labels.filter((l) => !deletedLabels.has(l.id)),
  };
}

export type ResolveAssignmentsResult = { operations: BatchOperation[] } | { error: string };

/** Turns SQL SET assignments into the same BatchOperation values the checkbox action bar uses. */
export function resolveAssignments(assignments: SqlAssignment[], labels: Label[]): ResolveAssignmentsResult {
  const operations: BatchOperation[] = [];
  for (const assignment of assignments) {
    if (assignment.field === 'completed') {
      operations.push({ type: 'complete', value: parseBool(assignment.value) });
    } else if (assignment.field === 'archived') {
      operations.push({ type: 'archive', value: parseBool(assignment.value) });
    } else if (assignment.field === 'status') {
      const status = STATUS_ALIASES[assignment.value.toLowerCase()];
      if (!status) return { error: `Unknown status "${assignment.value}". Use todo, doing, blocked, or done.` };
      operations.push({ type: 'kanbanStatus', status });
    } else if (assignment.field === 'label') {
      const label = labels.find((l) => l.name.toLowerCase() === assignment.value.toLowerCase());
      if (!label) return { error: `Unknown label "${assignment.value}".` };
      operations.push(
        assignment.op === '+='
          ? { type: 'addLabel', labelId: label.id }
          : { type: 'removeLabel', labelId: label.id },
      );
    }
  }
  return { operations };
}

function entityLabelFor(result: ConsoleItemResult): string {
  return result.title;
}

let changeCounter = 0;
function nextChangeId(): string {
  changeCounter += 1;
  return `change-${changeCounter}-${Date.now()}`;
}

/**
 * Builds one PendingChange per (matched row × operation), computing each
 * one's preview patch. Each match's own `.kind` determines its table, so a
 * mixed task+container selection (e.g. from checkbox multi-select) works
 * the same as a single-table SQL statement's matches.
 */
export function buildUpdateChanges(
  matches: ConsoleItemResult[],
  operations: BatchOperation[],
  effective: OverlayData,
): PendingChange[] {
  const taskById = new Map(effective.tasks.map((t) => [t.id, t]));
  const containerById = new Map(effective.containers.map((c) => [c.id, c]));
  const changes: PendingChange[] = [];
  for (const match of matches) {
    const entity =
      match.kind === 'task' ? taskById.get(match.id) : match.kind === 'container' ? containerById.get(match.id) : undefined;
    if (!entity) continue;
    for (const operation of operations) {
      const patch = computeBatchPatch(entity, match.kind, operation);
      if (!patch) continue;
      Object.assign(entity, patch); // keep local view consistent across multiple assignments in one statement
      changes.push({
        changeId: nextChangeId(),
        table: match.kind,
        entityId: match.id,
        entityLabel: entityLabelFor(match),
        kind: 'update',
        operation,
        patch,
      });
    }
  }
  return changes;
}

export function buildDeleteChanges(matches: ConsoleItemResult[]): PendingChange[] {
  return matches.map((match) => ({
    changeId: nextChangeId(),
    table: match.kind,
    entityId: match.id,
    entityLabel: entityLabelFor(match),
    kind: 'delete' as const,
  }));
}

async function deleteEntityByTable(table: ConsoleEntityKind, id: string): Promise<void> {
  try {
    if (table === 'task') await deleteTask(id);
    else if (table === 'container') await deleteContainer(id);
    else if (table === 'project') await deleteProject(id);
    else if (table === 'label') await deleteLabel(id);
  } catch {
    // Protected entities (e.g. the Inbox project/container) throw; skip rather than aborting the batch.
  }
}

async function applyPendingChange(change: PendingChange): Promise<void> {
  if (change.kind === 'delete') {
    await deleteEntityByTable(change.table, change.entityId);
    return;
  }
  const operation = change.operation;
  if (!operation) return;
  switch (operation.type) {
    case 'complete':
      if (change.table === 'task') await setTaskCompleted(change.entityId, operation.value);
      break;
    case 'archive':
      if (change.table === 'task') await setTaskArchived(change.entityId, operation.value);
      else if (change.table === 'container') await setContainerArchived(change.entityId, operation.value).catch(() => {});
      break;
    case 'kanbanStatus':
      if (change.table === 'container') await setContainerKanbanStatus(change.entityId, operation.status);
      break;
    case 'addLabel':
    case 'removeLabel': {
      const apply = operation.type === 'addLabel' ? withLabel : withoutLabel;
      if (change.table === 'task') {
        const task = await db.tasks.get(change.entityId);
        if (task) await updateTask(change.entityId, { labels: apply(task.labels, operation.labelId) });
      } else if (change.table === 'container') {
        const container = await db.containers.get(change.entityId);
        if (container) await updateContainer(change.entityId, { labels: apply(container.labels, operation.labelId) });
      }
      break;
    }
  }
}

/** Replays staged changes against the real database in one atomic Dexie transaction. */
export async function commitPendingChanges(changes: PendingChange[]): Promise<void> {
  if (changes.length === 0) return;
  await db.transaction('rw', [db.tasks, db.containers, db.projects, db.labels, db.weekTemplates], async () => {
    for (const change of changes) {
      await applyPendingChange(change);
    }
  });
}

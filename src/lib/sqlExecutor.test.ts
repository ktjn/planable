import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PlanableDB } from '../db/db';

vi.mock('../db/db', async () => {
  const { PlanableDB } = await vi.importActual<typeof import('../db/db')>('../db/db');
  return { db: new PlanableDB(`test-sqlexecutor-${Math.random()}`) };
});

import { db } from '../db/db';
import { createProject } from '../db/repositories/projects';
import { createContainer, setContainerKanbanStatus } from '../db/repositories/containers';
import { createTask, setTaskArchived } from '../db/repositories/tasks';
import { createLabel } from '../db/repositories/labels';
import { INBOX_CONTAINER_ID, INBOX_PROJECT_ID } from '../db/inbox';
import {
  applyPendingOverlay,
  buildDeleteChanges,
  buildUpdateChanges,
  commitPendingChanges,
  conditionsToItemQuery,
  resolveAssignments,
  resolveMatches,
  type PendingChange,
} from './sqlExecutor';
import { parseSqlStatement, type SqlUpdate, type SqlWhereExpr } from './sqlLanguage';

/** Builds a `field op value (AND field op value)*` WHERE tree for tests that don't care about OR/parens. */
function and(...conditions: { field: string; op: '=' | '!=' | 'LIKE'; value: string }[]): { expr: SqlWhereExpr } {
  const nodes: SqlWhereExpr[] = conditions.map((condition) => ({ kind: 'condition', condition }));
  return { expr: nodes.length === 1 ? nodes[0] : { kind: 'and', terms: nodes } };
}

describe('conditionsToItemQuery', () => {
  it('translates conditions to filters for categorical fields and terms for text fields', () => {
    expect(
      conditionsToItemQuery('task', [
        { field: 'label', op: '=', value: 'bug' },
        { field: 'title', op: 'LIKE', value: '%nav%' },
      ]),
    ).toEqual({
      kind: 'items',
      types: ['task'],
      filters: [{ field: 'label', value: 'bug', negate: false }],
      terms: [{ text: 'nav', negate: false }],
    });
  });

  it('treats WHERE 1=1 as matching everything (no filters or terms)', () => {
    expect(conditionsToItemQuery('task', [{ field: '1', op: '=', value: '1' }])).toEqual({
      kind: 'items',
      types: ['task'],
      filters: [],
      terms: [],
    });
  });

  it('negates on !=', () => {
    expect(conditionsToItemQuery('task', [{ field: 'archived', op: '!=', value: 'true' }]).filters).toEqual([
      { field: 'archived', value: 'true', negate: true },
    ]);
  });
});

describe('sqlExecutor against a live database', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('resolveMatches finds rows via the shared search engine', async () => {
    const project = await createProject('Website');
    const container = await createContainer(project.id, 'Frontend');
    const bug = await createLabel('Bug', '#ef4444');
    await createTask({ title: 'Fix nav', projectId: project.id, containerId: container.id, labels: [bug.id] });
    await createTask({ title: 'Docs', projectId: project.id, containerId: container.id });

    const matches = resolveMatches(
      'task',
      and({ field: 'label', op: '=', value: 'bug' }),
      {
        tasks: await db.tasks.toArray(),
        containers: await db.containers.toArray(),
        projects: await db.projects.toArray(),
        labels: await db.labels.toArray(),
      },
    );
    expect(matches.map((m) => m.title)).toEqual(['Fix nav']);
  });

  it('resolveMatches unions OR branches, without duplicating a row matched by more than one branch', async () => {
    const project = await createProject('Website');
    const container = await createContainer(project.id, 'Frontend');
    const bug = await createLabel('Bug', '#ef4444');
    const docs = await createLabel('Docs', '#8b5cf6');
    await createTask({ title: 'Fix nav', projectId: project.id, containerId: container.id, labels: [bug.id] });
    await createTask({ title: 'Write docs', projectId: project.id, containerId: container.id, labels: [docs.id] });
    await createTask({
      title: 'Both labels',
      projectId: project.id,
      containerId: container.id,
      labels: [bug.id, docs.id],
    });
    await createTask({ title: 'Unrelated', projectId: project.id, containerId: container.id });

    const stmt = parseSqlStatement("SELECT * FROM tasks WHERE label = 'bug' OR label = 'docs'");
    if (!stmt || 'error' in stmt || stmt.type !== 'select') throw new Error('expected a select statement');

    const effective = {
      tasks: await db.tasks.toArray(),
      containers: await db.containers.toArray(),
      projects: await db.projects.toArray(),
      labels: await db.labels.toArray(),
    };
    const matches = resolveMatches(stmt.table, stmt.where, effective);
    expect(matches.map((m) => m.title).sort()).toEqual(['Both labels', 'Fix nav', 'Write docs']);
  });

  it('resolveMatches honors parens overriding AND/OR precedence', async () => {
    const project = await createProject('Website');
    const container = await createContainer(project.id, 'Frontend');
    const bug = await createLabel('Bug', '#ef4444');
    const docs = await createLabel('Docs', '#8b5cf6');
    const bugTask = await createTask({ title: 'Bug task', projectId: project.id, containerId: container.id, labels: [bug.id] });
    await createTask({ title: 'Docs task', projectId: project.id, containerId: container.id, labels: [docs.id] });
    await setTaskArchived(bugTask.id, true);

    // (label = bug OR label = docs) AND archived = false — the archived bug task should be excluded.
    const stmt = parseSqlStatement(
      "SELECT * FROM tasks WHERE (label = 'bug' OR label = 'docs') AND archived = false",
    );
    if (!stmt || 'error' in stmt || stmt.type !== 'select') throw new Error('expected a select statement');

    const effective = {
      tasks: await db.tasks.toArray(),
      containers: await db.containers.toArray(),
      projects: await db.projects.toArray(),
      labels: await db.labels.toArray(),
    };
    const matches = resolveMatches(stmt.table, stmt.where, effective);
    expect(matches.map((m) => m.title)).toEqual(['Docs task']);
  });

  it('resolveAssignments maps SET fields to BatchOperations, resolving label names to ids', async () => {
    const bug = await createLabel('Bug', '#ef4444');
    expect(resolveAssignments([{ field: 'completed', op: '=', value: 'true' }], [bug])).toEqual({
      operations: [{ type: 'complete', value: true }],
    });
    expect(resolveAssignments([{ field: 'status', op: '=', value: 'doing' }], [bug])).toEqual({
      operations: [{ type: 'kanbanStatus', status: 'Doing' }],
    });
    expect(resolveAssignments([{ field: 'label', op: '+=', value: 'bug' }], [bug])).toEqual({
      operations: [{ type: 'addLabel', labelId: bug.id }],
    });
    expect(resolveAssignments([{ field: 'label', op: '-=', value: 'bug' }], [bug])).toEqual({
      operations: [{ type: 'removeLabel', labelId: bug.id }],
    });
  });

  it('resolveAssignments errors on an unknown status or label', () => {
    expect(resolveAssignments([{ field: 'status', op: '=', value: 'nope' }], [])).toEqual({
      error: expect.stringContaining('Unknown status'),
    });
    expect(resolveAssignments([{ field: 'label', op: '+=', value: 'nope' }], [])).toEqual({
      error: expect.stringContaining('Unknown label'),
    });
  });

  it('buildUpdateChanges computes a preview patch per matched row without writing to the database', async () => {
    const project = await createProject('Website');
    const container = await createContainer(project.id, 'Frontend');
    const task = await createTask({ title: 'A', projectId: project.id, containerId: container.id });

    const effective = {
      tasks: await db.tasks.toArray(),
      containers: await db.containers.toArray(),
      projects: await db.projects.toArray(),
      labels: await db.labels.toArray(),
    };
    const matches = resolveMatches('task', null, effective);
    const changes = buildUpdateChanges(matches, [{ type: 'complete', value: true }], effective);

    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ table: 'task', entityId: task.id, kind: 'update', patch: { completed: true } });
    // Nothing written yet.
    expect((await db.tasks.get(task.id))?.completed).toBe(false);
  });

  it('applyPendingOverlay hides deleted rows and merges patched fields for subsequent matching', async () => {
    const project = await createProject('Website');
    const container = await createContainer(project.id, 'Frontend');
    const keep = await createTask({ title: 'Keep', projectId: project.id, containerId: container.id });
    const gone = await createTask({ title: 'Gone', projectId: project.id, containerId: container.id });

    const base = {
      tasks: await db.tasks.toArray(),
      containers: await db.containers.toArray(),
      projects: await db.projects.toArray(),
      labels: await db.labels.toArray(),
    };
    const changes: PendingChange[] = [
      { changeId: 'c1', table: 'task', entityId: keep.id, entityLabel: 'Keep', kind: 'update', patch: { completed: true } },
      { changeId: 'c2', table: 'task', entityId: gone.id, entityLabel: 'Gone', kind: 'delete' },
    ];

    const overlaid = applyPendingOverlay(base, changes);
    expect(overlaid.tasks.map((t) => t.id)).toEqual([keep.id]);
    expect(overlaid.tasks[0].completed).toBe(true);

    // A SELECT run against the overlay should reflect the staged completion.
    const matches = resolveMatches('task', and({ field: 'done', op: '=', value: 'true' }), overlaid);
    expect(matches.map((m) => m.title)).toEqual(['Keep']);
  });

  it('commitPendingChanges replays staged updates and deletes atomically', async () => {
    const project = await createProject('Website');
    const container = await createContainer(project.id, 'Frontend');
    const a = await createTask({ title: 'A', projectId: project.id, containerId: container.id });
    const b = await createTask({ title: 'B', projectId: project.id, containerId: container.id });

    const changes: PendingChange[] = [
      {
        changeId: 'c1',
        table: 'task',
        entityId: a.id,
        entityLabel: 'A',
        kind: 'update',
        operation: { type: 'complete', value: true },
      },
      { changeId: 'c2', table: 'task', entityId: b.id, entityLabel: 'B', kind: 'delete' },
    ];

    await commitPendingChanges(changes);

    expect((await db.tasks.get(a.id))?.completed).toBe(true);
    expect(await db.tasks.get(b.id)).toBeUndefined();
  });

  it('commitPendingChanges skips a delete of a protected entity (Inbox) without throwing', async () => {
    await expect(
      commitPendingChanges([
        { changeId: 'c1', table: 'container', entityId: INBOX_CONTAINER_ID, entityLabel: 'Inbox', kind: 'delete' },
      ]),
    ).resolves.toBeUndefined();
    expect(await db.containers.get(INBOX_CONTAINER_ID)).toBeDefined();
  });

  it('commitPendingChanges re-reads current labels so sequential label changes on the same row compose correctly', async () => {
    const project = await createProject('Website');
    const container = await createContainer(project.id, 'Frontend');
    const urgent = await createLabel('Urgent', '#f97316');
    const bug = await createLabel('Bug', '#ef4444');
    const task = await createTask({ title: 'A', projectId: project.id, containerId: container.id });

    await commitPendingChanges([
      {
        changeId: 'c1',
        table: 'task',
        entityId: task.id,
        entityLabel: 'A',
        kind: 'update',
        operation: { type: 'addLabel', labelId: urgent.id },
      },
      {
        changeId: 'c2',
        table: 'task',
        entityId: task.id,
        entityLabel: 'A',
        kind: 'update',
        operation: { type: 'addLabel', labelId: bug.id },
      },
    ]);

    expect((await db.tasks.get(task.id))?.labels.sort()).toEqual([urgent.id, bug.id].sort());
  });

  it('end-to-end: parse an UPDATE statement, resolve it, and commit it', async () => {
    const project = await createProject('Website');
    const container = await createContainer(project.id, 'Frontend');
    const bug = await createLabel('Bug', '#ef4444');
    const task = await createTask({ title: 'Fix nav', projectId: project.id, containerId: container.id, labels: [bug.id] });
    await createTask({ title: 'Docs', projectId: project.id, containerId: container.id });

    const stmt = parseSqlStatement("UPDATE tasks SET completed = true WHERE label = 'bug'") as SqlUpdate;
    const effective = {
      tasks: await db.tasks.toArray(),
      containers: await db.containers.toArray(),
      projects: await db.projects.toArray(),
      labels: await db.labels.toArray(),
    };
    const matches = resolveMatches(stmt.table, stmt.where, effective);
    expect(matches.map((m) => m.title)).toEqual(['Fix nav']);

    const resolved = resolveAssignments(stmt.assignments, effective.labels);
    if ('error' in resolved) throw new Error(resolved.error);
    const changes = buildUpdateChanges(matches, resolved.operations, effective);
    await commitPendingChanges(changes);

    expect((await db.tasks.get(task.id))?.completed).toBe(true);
  });

  it('end-to-end: parse a DELETE statement and commit it', async () => {
    const project = await createProject('Website');
    const container = await createContainer(project.id, 'Frontend');
    const task = await createTask({ title: 'Old', projectId: project.id, containerId: container.id });

    const stmt = parseSqlStatement('DELETE FROM tasks WHERE 1=1');
    if (!stmt || 'error' in stmt || stmt.type !== 'delete') throw new Error('expected a delete statement');

    const effective = {
      tasks: await db.tasks.toArray(),
      containers: await db.containers.toArray(),
      projects: await db.projects.toArray(),
      labels: await db.labels.toArray(),
    };
    const matches = resolveMatches(stmt.table, stmt.where, effective);
    const changes = buildDeleteChanges(matches);
    await commitPendingChanges(changes);

    expect(await db.tasks.get(task.id)).toBeUndefined();
  });

  it('setting a container kanban status via SET status is reflected on commit', async () => {
    const project = await createProject('Website');
    const container = await createContainer(project.id, 'Frontend');
    await setContainerKanbanStatus(container.id, 'Todo');

    const effective = {
      tasks: await db.tasks.toArray(),
      containers: await db.containers.toArray(),
      projects: await db.projects.toArray(),
      labels: await db.labels.toArray(),
    };
    const matches = resolveMatches('container', null, effective);
    const resolved = resolveAssignments([{ field: 'status', op: '=', value: 'doing' }], []);
    if ('error' in resolved) throw new Error(resolved.error);
    const changes = buildUpdateChanges(matches, resolved.operations, effective);
    await commitPendingChanges(changes);

    expect((await db.containers.get(container.id))?.kanban).toEqual({ status: 'Doing' });
  });

  it('is scoped to Inbox correctly: deleting the Inbox project is skipped', async () => {
    await expect(
      commitPendingChanges([
        { changeId: 'c1', table: 'project', entityId: INBOX_PROJECT_ID, entityLabel: 'Inbox', kind: 'delete' },
      ]),
    ).resolves.toBeUndefined();
    expect(await db.projects.get(INBOX_PROJECT_ID)).toBeDefined();
  });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PlanableDB } from '../db/db';

vi.mock('../db/db', async () => {
  const { PlanableDB } = await vi.importActual<typeof import('../db/db')>('../db/db');
  return { db: new PlanableDB(`test-consolebatch-${Math.random()}`) };
});

import { db } from '../db/db';
import { applyBatchOperation } from './consoleBatch';
import { createProject } from '../db/repositories/projects';
import { createContainer, setContainerKanbanStatus } from '../db/repositories/containers';
import { createTask } from '../db/repositories/tasks';
import { createLabel } from '../db/repositories/labels';
import { INBOX_CONTAINER_ID } from '../db/inbox';
import type { ConsoleItemResult } from './consoleSearch';

function itemResult(kind: 'task' | 'container', id: string): ConsoleItemResult {
  return {
    key: `${kind}-${id}`,
    id,
    kind,
    title: id,
    badges: [],
    navigate: { kind: 'all-tasks' },
  };
}

describe('applyBatchOperation', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('marks selected tasks completed, ignoring non-task results', async () => {
    const project = await createProject('P');
    const container = await createContainer(project.id, 'C');
    const a = await createTask({ title: 'A', projectId: project.id, containerId: container.id });
    const b = await createTask({ title: 'B', projectId: project.id, containerId: container.id });

    await applyBatchOperation(
      [itemResult('task', a.id), itemResult('task', b.id), itemResult('container', container.id)],
      { type: 'complete', value: true },
      { tasks: [a, b], containers: [container] },
    );

    expect((await db.tasks.get(a.id))?.completed).toBe(true);
    expect((await db.tasks.get(b.id))?.completed).toBe(true);
    expect((await db.containers.get(container.id))?.archived).toBe(false);
  });

  it('uncompletes selected tasks', async () => {
    const project = await createProject('P');
    const container = await createContainer(project.id, 'C');
    const a = await createTask({ title: 'A', projectId: project.id, containerId: container.id });
    await db.tasks.update(a.id, { completed: true, completedDate: 123 });

    await applyBatchOperation([itemResult('task', a.id)], { type: 'complete', value: false }, {
      tasks: [a],
      containers: [],
    });

    expect((await db.tasks.get(a.id))?.completed).toBe(false);
  });

  it('archives selected tasks and containers together', async () => {
    const project = await createProject('P');
    const container = await createContainer(project.id, 'C');
    const task = await createTask({ title: 'A', projectId: project.id, containerId: container.id });

    await applyBatchOperation(
      [itemResult('task', task.id), itemResult('container', container.id)],
      { type: 'archive', value: true },
      { tasks: [task], containers: [container] },
    );

    expect((await db.tasks.get(task.id))?.archived).toBe(true);
    expect((await db.containers.get(container.id))?.archived).toBe(true);
  });

  it('silently skips containers that refuse to archive (Inbox) instead of failing the batch', async () => {
    const project = await createProject('P');
    const container = await createContainer(project.id, 'C');
    const task = await createTask({ title: 'A', projectId: project.id, containerId: container.id });

    await expect(
      applyBatchOperation(
        [itemResult('container', INBOX_CONTAINER_ID), itemResult('task', task.id)],
        { type: 'archive', value: true },
        { tasks: [task], containers: [container] },
      ),
    ).resolves.toBeUndefined();

    expect((await db.tasks.get(task.id))?.archived).toBe(true);
  });

  it('sets kanban status only for selected containers', async () => {
    const project = await createProject('P');
    const c1 = await createContainer(project.id, 'C1');
    const c2 = await createContainer(project.id, 'C2');
    await setContainerKanbanStatus(c1.id, 'Todo');

    await applyBatchOperation(
      [itemResult('container', c1.id), itemResult('container', c2.id)],
      { type: 'kanbanStatus', status: 'Doing' },
      { tasks: [], containers: [c1, c2] },
    );

    expect((await db.containers.get(c1.id))?.kanban).toEqual({ status: 'Doing' });
    expect((await db.containers.get(c2.id))?.kanban).toEqual({ status: 'Doing' });
  });

  it('adds a label to selected tasks and containers without duplicating it', async () => {
    const project = await createProject('P');
    const container = await createContainer(project.id, 'C');
    const label = await createLabel('Bug', '#ef4444');
    const already = await createLabel('Feature', '#3b82f6');
    const task = await createTask({
      title: 'A',
      projectId: project.id,
      containerId: container.id,
      labels: [already.id],
    });

    await applyBatchOperation(
      [itemResult('task', task.id), itemResult('container', container.id)],
      { type: 'addLabel', labelId: label.id },
      { tasks: [task], containers: [container] },
    );
    // Running it again must not duplicate the label.
    await applyBatchOperation(
      [itemResult('task', task.id), itemResult('container', container.id)],
      { type: 'addLabel', labelId: label.id },
      { tasks: [{ ...task, labels: [already.id, label.id] }], containers: [{ ...container, labels: [label.id] }] },
    );

    expect((await db.tasks.get(task.id))?.labels).toEqual([already.id, label.id]);
    expect((await db.containers.get(container.id))?.labels).toEqual([label.id]);
  });

  it('removes a label from selected tasks and containers', async () => {
    const project = await createProject('P');
    const label = await createLabel('Bug', '#ef4444');
    const container = await createContainer(project.id, 'C');
    await db.containers.update(container.id, { labels: [label.id] });
    const task = await createTask({
      title: 'A',
      projectId: project.id,
      containerId: container.id,
      labels: [label.id],
    });

    await applyBatchOperation(
      [itemResult('task', task.id), itemResult('container', container.id)],
      { type: 'removeLabel', labelId: label.id },
      { tasks: [task], containers: [{ ...container, labels: [label.id] }] },
    );

    expect((await db.tasks.get(task.id))?.labels).toEqual([]);
    expect((await db.containers.get(container.id))?.labels).toEqual([]);
  });
});

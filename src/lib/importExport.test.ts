import { describe, it, expect, vi } from 'vitest';
import { PlanableDB } from '../db/db';

vi.mock('../db/db', async () => {
  const { PlanableDB } = await vi.importActual<typeof import('../db/db')>('../db/db');
  return { db: new PlanableDB(`test-importexport-${Math.random()}`) };
});

import { exportData, importData } from './importExport';
import { createProject } from '../db/repositories/projects';
import { createContainer } from '../db/repositories/containers';
import { createTask, setTaskCompleted } from '../db/repositories/tasks';
import { createLabel } from '../db/repositories/labels';
import { setKanbanStatus, addToWeek, setWeeklyDay } from '../db/repositories/taskMembership';
import { addContainerToWeek, setContainerWeeklyDay } from '../db/repositories/containers';
import type { Container } from '../db/schema';
import { db } from '../db/db';

describe('import/export', () => {
  it('round-trips projects, containers, tasks, and labels, including kanban/weekly/completedDate', async () => {
    const project = await createProject('Alpha');
    const container = await createContainer(project.id, 'Backlog');
    const label = await createLabel('Security', '#ff0000');
    const created = await createTask({
      title: 'Exportable',
      labels: [label.id],
      projectId: project.id,
      containerId: container.id,
    });

    // setKanbanStatus('Doing') keeps kanban.status at 'Doing' without touching completed.
    await setKanbanStatus(created.id, 'Doing');
    await addToWeek(created.id, 'x');
    await setWeeklyDay(created.id, 'Tue');
    // repeatWeekly isn't settable via a repository function yet (Phase 1 doesn't
    // act on it), so patch it directly on the record to exercise the field.
    await db.tasks.update(created.id, { weekly: { weekId: 'x', day: 'Tue', repeatWeekly: true } });
    await setTaskCompleted(created.id, true);

    const exported = await exportData();
    const exportedTask = exported.tasks.find((t) => t.title === 'Exportable');
    expect(exportedTask).toBeDefined();
    expect(exportedTask?.kanban).toEqual({ status: 'Doing' });
    expect(exportedTask?.weekly).toEqual({ weekId: 'x', day: 'Tue', repeatWeekly: true });
    expect(exportedTask?.completedDate).not.toBeNull();

    await db.tasks.clear();
    await db.containers.clear();
    await db.projects.clear();
    await db.labels.clear();

    await importData(exported);

    expect(await db.projects.get(project.id)).toEqual(project);
    expect(await db.containers.get(container.id)).toEqual(container);
    expect(await db.labels.get(label.id)).toEqual(label);
    const task = await db.tasks.filter((t) => t.title === 'Exportable').first();
    expect(task?.labels).toEqual([label.id]);
    expect(task?.kanban).toEqual({ status: 'Doing' });
    expect(task?.weekly).toEqual({ weekId: 'x', day: 'Tue', repeatWeekly: true });
    expect(task?.completedDate).toEqual(exportedTask?.completedDate);
  });

  it('round-trips a scheduled Container with an independently scheduled child Task', async () => {
    const project = await createProject('Eng');
    const container = await createContainer(project.id, 'Architecture');
    await addContainerToWeek(container.id, '2026-W32');
    await setContainerWeeklyDay(container.id, 'Tue');

    const scheduledTask = await createTask({
      title: 'Task 1',
      projectId: project.id,
      containerId: container.id,
    });
    await addToWeek(scheduledTask.id, '2026-W32');
    await setWeeklyDay(scheduledTask.id, 'Thu');

    const unscheduledTask = await createTask({
      title: 'Task 2',
      projectId: project.id,
      containerId: container.id,
    });

    const exported = await exportData();

    await db.tasks.clear();
    await db.containers.clear();
    await db.projects.clear();
    await db.labels.clear();

    await importData(exported);

    const importedContainer = (await db.containers.get(container.id))!;
    expect(importedContainer.weekly).toEqual({ weekId: '2026-W32', day: 'Tue' });

    const importedScheduled = await db.tasks.get(scheduledTask.id);
    expect(importedScheduled?.weekly).toEqual({ weekId: '2026-W32', day: 'Thu', repeatWeekly: false });

    const importedUnscheduled = await db.tasks.get(unscheduledTask.id);
    expect(importedUnscheduled?.weekly).toBeNull();

    expect(importedContainer.id).toBe(container.id);
    expect(importedScheduled?.containerId).toBe(container.id);
  });

  it('normalizes legacy Container records without weekly to null', async () => {
    // Intentionally omit `weekly` to simulate a pre-Container-membership export.
    const legacyContainer = { id: 'legacy', projectId: 'p', name: 'Old', order: 0 } as Container;
    await importData({
      version: 2,
      projects: [],
      containers: [legacyContainer],
      tasks: [],
      labels: [],
      weekTemplates: [],
      settings: [],
    });
    const imported = (await db.containers.get('legacy'))!;
    expect(imported.weekly).toBeNull();
  });
});

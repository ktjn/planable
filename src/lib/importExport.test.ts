import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlanableDB } from '../db/db';

vi.mock('../db/db', async () => {
  const { PlanableDB } = await vi.importActual<typeof import('../db/db')>('../db/db');
  return { db: new PlanableDB(`test-importexport-${Math.random()}`) };
});

import { exportData, importData, exportMarkdown, importMarkdown } from './importExport';
import { createProject } from '../db/repositories/projects';
import { createContainer, setContainerKanbanStatus } from '../db/repositories/containers';
import { createTask, setTaskCompleted, setTaskArchived } from '../db/repositories/tasks';
import { createLabel } from '../db/repositories/labels';
import { addToWeek, setWeeklyDay, setTaskRepeatWeekly } from '../db/repositories/taskMembership';
import { setSetting, SETTING_ACTIVE_WEEK } from '../db/repositories/settings';
import { INBOX_PROJECT, INBOX_CONTAINER } from '../db/inbox';
import type { Container } from '../db/schema';
import { db } from '../db/db';

describe('import/export', () => {
  it('round-trips projects, containers, tasks, and labels, including labels/archive/kanban/weekly/completedDate', async () => {
    const project = await createProject('Alpha');
    const container = await createContainer(project.id, 'Backlog');
    const label = await createLabel('Security', '#ff0000');
    await db.containers.update(container.id, { labels: [label.id], kanban: { status: 'Blocked' } });
    const created = await createTask({
      title: 'Exportable',
      labels: [label.id],
      projectId: project.id,
      containerId: container.id,
    });

    await addToWeek(created.id, 'x');
    await setWeeklyDay(created.id, 'Tue');
    // repeatWeekly isn't settable via a repository function yet (Phase 1 doesn't
    // act on it), so patch it directly on the record to exercise the field.
    await db.tasks.update(created.id, { weekly: { weekId: 'x', day: 'Tue', repeatWeekly: true } });
    await setTaskCompleted(created.id, true);
    await setTaskArchived(created.id, true);
    // Archive clears weekly but not completed, so completedDate remains set.
    await db.tasks.update(created.id, { weekly: { weekId: 'x', day: 'Tue', repeatWeekly: true } });

    const exported = await exportData();
    const exportedTask = exported.tasks.find((t) => t.title === 'Exportable');
    const exportedContainer = exported.containers.find((c) => c.id === container.id);
    expect(exportedTask).toBeDefined();
    expect(exportedTask?.archived).toBe(true);
    expect(exportedTask?.weekly).toEqual(
      expect.objectContaining({ weekId: 'x', day: 'Tue', repeatWeekly: true }),
    );
    expect(exportedTask?.completedDate).not.toBeNull();
    expect(exportedContainer?.labels).toEqual([label.id]);
    expect(exportedContainer?.kanban).toEqual({ status: 'Blocked' });

    await db.tasks.clear();
    await db.containers.clear();
    await db.projects.clear();
    await db.labels.clear();

    await importData(exported);

    expect(await db.projects.get(project.id)).toEqual(project);
    expect((await db.containers.get(container.id))?.labels).toEqual([label.id]);
    expect((await db.containers.get(container.id))?.kanban).toEqual({ status: 'Blocked' });
    expect(await db.labels.get(label.id)).toEqual(label);
    const task = await db.tasks.filter((t) => t.title === 'Exportable').first();
    expect(task?.labels).toEqual([label.id]);
    expect(task?.archived).toBe(true);
    expect(task?.weekly).toEqual(
      expect.objectContaining({ weekId: 'x', day: 'Tue', repeatWeekly: true }),
    );
    expect(task?.completedDate).toEqual(exportedTask?.completedDate);
  });

  it('round-trips a scheduled Task inside a Container with Kanban status', async () => {
    const project = await createProject('Eng');
    const container = await createContainer(project.id, 'Architecture');
    await setContainerKanbanStatus(container.id, 'Doing');

    const scheduledTask = await createTask({
      title: 'Task 1',
      projectId: project.id,
      containerId: container.id,
    });
    await addToWeek(scheduledTask.id, '2026-W32');
    await setWeeklyDay(scheduledTask.id, 'Thu');

    const exported = await exportData();
    await db.tasks.clear();
    await db.containers.clear();
    await db.projects.clear();
    await db.labels.clear();
    await importData(exported);

    const importedContainer = (await db.containers.get(container.id))!;
    expect(importedContainer.kanban).toEqual({ status: 'Doing' });

    const importedScheduled = await db.tasks.get(scheduledTask.id);
    expect(importedScheduled?.weekly).toEqual(
      expect.objectContaining({ weekId: '2026-W32', day: 'Thu', repeatWeekly: false }),
    );
    expect(importedScheduled?.containerId).toBe(container.id);
  });
});

describe('markdown import/export', () => {
  async function resetDb() {
    await Promise.all([
      db.tasks.clear(),
      db.containers.clear(),
      db.projects.clear(),
      db.labels.clear(),
      db.weekTemplates.clear(),
      db.settings.clear(),
    ]);
    await db.projects.add(INBOX_PROJECT);
    await db.containers.add(INBOX_CONTAINER);
  }

  beforeEach(resetDb);

  it('round-trips structure, labels, schedule, repeat, completion, and archive state with new ids', async () => {
    const bug = await createLabel('Bug', '#ef4444');
    const project = await createProject('Alpha');
    const backlog = await createContainer(project.id, 'Backlog');
    const old = await createContainer(project.id, 'Old');
    await db.containers.update(backlog.id, { labels: [bug.id], kanban: { status: 'Doing' } });
    await db.containers.update(old.id, { archived: true });

    const weekly = await createTask({
      title: 'Weekly sync',
      description: 'Agenda:\n\n- status',
      labels: [bug.id],
      projectId: project.id,
      containerId: backlog.id,
    });
    await addToWeek(weekly.id, '2026-W43');
    await setWeeklyDay(weekly.id, 'Fri');
    await setTaskRepeatWeekly(weekly.id, true);

    const done = await createTask({ title: 'Done', projectId: project.id, containerId: backlog.id });
    await setTaskCompleted(done.id, true);
    const completedDate = (await db.tasks.get(done.id))!.completedDate;

    const shelved = await createTask({ title: 'Shelved', projectId: project.id, containerId: old.id });
    await setTaskArchived(shelved.id, true);

    const markdown = await exportMarkdown();
    await resetDb();
    const result = await importMarkdown(markdown);

    expect(result).toEqual({ projects: 1, containers: 2, tasks: 3, labels: 1, warnings: [] });

    const [newProject] = await db.projects.filter((p) => p.name === 'Alpha').toArray();
    expect(newProject.id).not.toBe(project.id);
    const containers = await db.containers
      .where('projectId')
      .equals(newProject.id)
      .sortBy('order');
    expect(containers.map((c) => [c.name, c.archived, c.kanban])).toEqual([
      ['Backlog', false, { status: 'Doing' }],
      ['Old', true, null],
    ]);

    const [newBug] = await db.labels.toArray();
    expect(newBug).toMatchObject({ name: 'Bug', color: '#ef4444' });
    expect(containers[0].labels).toEqual([newBug.id]);

    const byTitle = async (title: string) => (await db.tasks.filter((t) => t.title === title).toArray())[0];
    const newWeekly = await byTitle('Weekly sync');
    expect(newWeekly).toMatchObject({
      description: 'Agenda:\n\n- status',
      labels: [newBug.id],
      containerId: containers[0].id,
      weekly: { weekId: '2026-W43', day: 'Fri', repeatWeekly: true },
    });
    const templates = await db.weekTemplates.toArray();
    expect(templates).toHaveLength(1);
    expect(templates[0]).toMatchObject({ taskId: newWeekly.id, title: 'Weekly sync', containerId: containers[0].id });

    expect(await byTitle('Done')).toMatchObject({ completed: true, completedDate });
    expect(await byTitle('Shelved')).toMatchObject({ archived: true, containerId: containers[1].id });
  });

  it('adds to existing data and reuses projects, containers, and labels by name', async () => {
    const project = await createProject('Alpha');
    const backlog = await createContainer(project.id, 'Backlog');
    const bug = await createLabel('Bug', '#111111');
    await createTask({ title: 'Existing', projectId: project.id, containerId: backlog.id, labels: [bug.id] });

    const result = await importMarkdown(
      [
        '---',
        'planable: 1',
        'labels:',
        '  - {"name": "BUG", "color": "#ff0000"}',
        '---',
        '# alpha',
        '## BACKLOG',
        '- kanban: Done',
        '- [ ] Added',
        '  - labels: bug, New',
        '## Fresh',
        '- [ ] In fresh',
      ].join('\n'),
    );

    expect(result).toEqual({ projects: 0, containers: 1, tasks: 2, labels: 1, warnings: [] });
    expect(await db.projects.filter((p) => p.name.toLowerCase() === 'alpha').count()).toBe(1);
    expect(await db.labels.get(bug.id)).toMatchObject({ color: '#111111' });
    expect((await db.containers.get(backlog.id))?.kanban).toBeNull();

    const tasks = await db.tasks.where('containerId').equals(backlog.id).sortBy('order');
    expect(tasks.map((t) => [t.title, t.order])).toEqual([
      ['Existing', 0],
      ['Added', 1],
    ]);
    const newLabel = (await db.labels.toArray()).find((l) => l.name === 'New');
    expect(tasks[1].labels).toEqual([bug.id, newLabel!.id]);
    expect(newLabel!.color).toBe('#3b82f6');
    expect(tasks[1].globalOrder).toBeGreaterThan(tasks[0].globalOrder);

    const fresh = await db.containers.filter((c) => c.name === 'Fresh').first();
    expect(fresh).toMatchObject({ projectId: project.id, order: 1 });
  });

  it('puts a bare checklist into the Inbox', async () => {
    const result = await importMarkdown('- [ ] Renew domain\n- [x] Reply to emails\n');
    expect(result).toMatchObject({ projects: 0, containers: 0, tasks: 2 });
    const tasks = (await db.tasks.toArray()).sort((a, b) => a.order - b.order);
    expect(tasks.map((t) => [t.title, t.projectId, t.containerId, t.completed])).toEqual([
      ['Renew domain', INBOX_PROJECT.id, INBOX_CONTAINER.id, false],
      ['Reply to emails', INBOX_PROJECT.id, INBOX_CONTAINER.id, true],
    ]);
    expect(tasks[1].completedDate).not.toBeNull();
  });

  it('restores the Inbox when it is missing', async () => {
    await db.tasks.clear();
    await db.containers.clear();
    await db.projects.clear();
    await importMarkdown('- [ ] Orphan\n');
    expect(await db.projects.get(INBOX_PROJECT.id)).toBeDefined();
    expect(await db.containers.get(INBOX_CONTAINER.id)).toBeDefined();
    expect(await db.tasks.count()).toBe(1);
  });

  it('assigns weekly order after existing tasks in the same column', async () => {
    const project = await createProject('Alpha');
    const container = await createContainer(project.id, 'Backlog');
    const first = await createTask({ title: 'First', projectId: project.id, containerId: container.id });
    await addToWeek(first.id, '2026-W43');
    await setWeeklyDay(first.id, 'Tue');

    await importMarkdown('# Alpha\n## Backlog\n- [ ] A\n  - week: 2026-W43 Tue\n- [ ] B\n  - week: 2026-W43 Tue\n');

    const column = (await db.tasks.where('weekly.weekId').equals('2026-W43').toArray()).sort(
      (a, b) => (a.weekly?.order ?? 0) - (b.weekly?.order ?? 0),
    );
    expect(column.map((t) => [t.title, t.weekly?.order])).toEqual([
      ['First', 0],
      ['A', 1],
      ['B', 2],
    ]);
  });

  it('schedules a repeating task without a week into the active week', async () => {
    await setSetting(SETTING_ACTIVE_WEEK, '2026-W40');
    await importMarkdown('- [ ] Standup\n  - repeat: weekly\n');
    const created = (await db.tasks.toArray())[0];
    expect(created.weekly).toMatchObject({ weekId: '2026-W40', day: 'Unplanned', repeatWeekly: true });
    expect(await db.weekTemplates.where('taskId').equals(created.id).count()).toBe(1);
  });

  it('ignores week and repeat on archived tasks and warns', async () => {
    const result = await importMarkdown('- [ ] Old\n  - archived: true\n  - week: 2026-W43 Mon\n  - repeat: weekly\n');
    const created = (await db.tasks.toArray())[0];
    expect(created).toMatchObject({ archived: true, weekly: null });
    expect(await db.weekTemplates.count()).toBe(0);
    expect(result.warnings).toEqual(['Task "Old" is archived; its week and repeat settings were ignored.']);
  });

  it('passes parser warnings through and still imports valid content', async () => {
    const result = await importMarkdown('- [ ] A\n  - week: soon\n');
    expect(result.tasks).toBe(1);
    expect(result.warnings).toHaveLength(1);
  });

  it('imports label definitions on their own', async () => {
    const result = await importMarkdown('---\nplanable: 1\nlabels:\n  - {"name": "Solo", "color": "#123456"}\n---\n');
    expect(result).toEqual({ projects: 0, containers: 0, tasks: 0, labels: 1, warnings: [] });
    expect(await db.labels.toArray()).toEqual([expect.objectContaining({ name: 'Solo', color: '#123456' })]);
  });

  it('rejects a file with no importable content without touching data', async () => {
    await expect(importMarkdown('just some prose\n')).rejects.toThrow(/No projects/);
    await expect(importMarkdown('')).rejects.toThrow(/No projects/);
    expect(await db.tasks.count()).toBe(0);
  });
});

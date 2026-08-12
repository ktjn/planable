import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PlanableDB } from '../db/db';

vi.mock('../db/db', async () => {
  const { PlanableDB } = await vi.importActual<typeof import('../db/db')>('../db/db');
  return { db: new PlanableDB(`test-sampledata-${Math.random()}`) };
});

import { db } from '../db/db';
import { addSampleData } from './sampleData';
import { INBOX_PROJECT_ID } from '../db/inbox';

describe('addSampleData', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('creates projects, containers across every kanban status, labels, and tasks covering every schema aspect', async () => {
    await addSampleData();

    const projects = await db.projects.toArray();
    const containers = await db.containers.toArray();
    const labels = await db.labels.toArray();
    const tasks = await db.tasks.toArray();
    const weekTemplates = await db.weekTemplates.toArray();

    // Multiple projects beyond the built-in Inbox.
    expect(projects.filter((p) => p.id !== INBOX_PROJECT_ID).length).toBeGreaterThanOrEqual(2);

    // Every kanban status represented.
    const statuses = new Set(containers.map((c) => c.kanban?.status).filter(Boolean));
    expect(statuses).toEqual(new Set(['Todo', 'Doing', 'Blocked', 'Done']));

    // At least one archived container, and containers carrying labels.
    expect(containers.some((c) => c.archived)).toBe(true);
    expect(containers.some((c) => c.labels.length > 0)).toBe(true);

    // Distinct labels with colors.
    expect(labels.length).toBeGreaterThanOrEqual(5);
    expect(new Set(labels.map((l) => l.color)).size).toBe(labels.length);

    // Tasks: completed with a completedDate, archived, weekly-scheduled across
    // multiple days (including Unplanned), a repeating task, and Inbox tasks.
    expect(tasks.some((t) => t.completed && t.completedDate !== null)).toBe(true);
    expect(tasks.some((t) => t.archived)).toBe(true);
    const scheduledDays = new Set(tasks.map((t) => t.weekly?.day).filter(Boolean));
    expect(scheduledDays.size).toBeGreaterThanOrEqual(3);
    expect(scheduledDays.has('Unplanned')).toBe(true);
    expect(tasks.some((t) => t.weekly?.repeatWeekly)).toBe(true);
    expect(tasks.some((t) => t.projectId === INBOX_PROJECT_ID)).toBe(true);
    expect(tasks.some((t) => t.labels.length > 1)).toBe(true);

    // A repeating task produces a week template.
    expect(weekTemplates.length).toBeGreaterThanOrEqual(1);
  });

  it('is additive: running it twice does not remove existing data', async () => {
    await addSampleData();
    const firstCount = await db.tasks.count();
    await addSampleData();
    const secondCount = await db.tasks.count();
    expect(secondCount).toBe(firstCount * 2);
  });
});

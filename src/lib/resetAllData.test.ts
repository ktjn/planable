import { describe, it, expect, vi } from 'vitest';
import { PlanableDB } from '../db/db';

vi.mock('../db/db', async () => {
  const { PlanableDB } = await vi.importActual<typeof import('../db/db')>('../db/db');
  return { db: new PlanableDB(`test-resetall-${Math.random()}`) };
});

import { db } from '../db/db';
import { resetAllData } from './resetAllData';
import { addSampleData } from './sampleData';
import { INBOX_PROJECT_ID, INBOX_CONTAINER_ID } from '../db/inbox';

describe('resetAllData', () => {
  it('clears every table but restores the Inbox project and container', async () => {
    await addSampleData();
    expect(await db.tasks.count()).toBeGreaterThan(0);

    await resetAllData();

    expect(await db.tasks.count()).toBe(0);
    expect(await db.labels.count()).toBe(0);
    expect(await db.weekTemplates.count()).toBe(0);
    const projects = await db.projects.toArray();
    const containers = await db.containers.toArray();
    expect(projects).toEqual([expect.objectContaining({ id: INBOX_PROJECT_ID })]);
    expect(containers).toEqual([expect.objectContaining({ id: INBOX_CONTAINER_ID })]);
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { PlanableDB } from './db';
import { INBOX_PROJECT_ID, INBOX_CONTAINER_ID } from './inbox';

describe('PlanableDB', () => {
  let db: PlanableDB;

  beforeEach(() => {
    db = new PlanableDB(`test-db-${Math.random()}`);
  });

  it('seeds the Inbox project and container on first open', async () => {
    await db.open();
    const inboxProject = await db.projects.get(INBOX_PROJECT_ID);
    const inboxContainer = await db.containers.get(INBOX_CONTAINER_ID);
    expect(inboxProject?.name).toBe('Inbox');
    expect(inboxContainer?.projectId).toBe(INBOX_PROJECT_ID);
  });
});

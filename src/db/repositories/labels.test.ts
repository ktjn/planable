import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PlanableDB } from '../db';
import { createLabel, listLabels, updateLabel, deleteLabel } from './labels';
import { INBOX_PROJECT_ID, INBOX_CONTAINER_ID } from '../inbox';

vi.mock('../db', async () => {
  const { PlanableDB } = await vi.importActual<typeof import('../db')>('../db');
  return { db: new PlanableDB(`test-labels-${Math.random()}`) };
});

describe('label repository', () => {
  it('creates, lists, updates, and deletes labels, and strips deleted labels from tasks', async () => {
    const label = await createLabel('Security', '#ff0000');
    expect((await listLabels()).map((l) => l.name)).toContain('Security');

    await updateLabel(label.id, { color: '#00ff00' });
    expect((await listLabels()).find((l) => l.id === label.id)?.color).toBe('#00ff00');

    const { db } = await import('../db');
    await db.tasks.add({
      id: 't1',
      title: 'Task',
      description: '',
      labels: [label.id],
      projectId: INBOX_PROJECT_ID,
      containerId: INBOX_CONTAINER_ID,
      completed: false,
      completedDate: null,
      kanban: null,
      weekly: null,
    });

    await db.tasks.add({
      id: 't2',
      title: 'Task 2',
      description: '',
      labels: [label.id],
      projectId: INBOX_PROJECT_ID,
      containerId: INBOX_CONTAINER_ID,
      completed: false,
      completedDate: null,
      kanban: null,
      weekly: null,
    });

    await deleteLabel(label.id);
    expect((await listLabels()).find((l) => l.id === label.id)).toBeUndefined();
    expect((await db.tasks.get('t1'))?.labels).toEqual([]);
    expect((await db.tasks.get('t2'))?.labels).toEqual([]);
  });
});

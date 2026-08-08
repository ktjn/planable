import { render, screen, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../db/db', async () => {
  const { PlanableDB } = await vi.importActual<typeof import('../../db/db')>('../../db/db');
  return { db: new PlanableDB(`test-sortedtasklist-${Math.random()}`) };
});

import { SortedTaskList } from './SortedTaskList';
import { createTask, setTaskCompleted } from '../../db/repositories/tasks';
import { INBOX_PROJECT_ID, INBOX_CONTAINER_ID } from '../../db/inbox';

describe('SortedTaskList', () => {
  it('sinks completed tasks to the bottom', async () => {
    const open = await createTask({ title: 'Open A', projectId: INBOX_PROJECT_ID, containerId: INBOX_CONTAINER_ID });
    const done = await createTask({ title: 'Done B', projectId: INBOX_PROJECT_ID, containerId: INBOX_CONTAINER_ID });
    await setTaskCompleted(done.id, true);

    render(<SortedTaskList containerId={INBOX_CONTAINER_ID} labelsById={new Map()} />);

    const list = (await screen.findByText('Open A')).closest('ul')!;
    const items = within(list).getAllByRole('button', { name: /^(Open A|Done B)$/ });
    expect(items[0]).toHaveTextContent('Open A');
    expect(items[1]).toHaveTextContent('Done B');
  });
});

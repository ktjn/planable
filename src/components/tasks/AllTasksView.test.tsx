// src/components/tasks/AllTasksView.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../db/db', async () => {
  const { PlanableDB } = await vi.importActual<typeof import('../../db/db')>('../../db/db');
  return { db: new PlanableDB(`test-alltasks-${Math.random()}`) };
});

import { AllTasksView } from './AllTasksView';
import { createProject } from '../../db/repositories/projects';
import { createContainer } from '../../db/repositories/containers';
import { createTask } from '../../db/repositories/tasks';
import { INBOX_PROJECT_ID, INBOX_CONTAINER_ID } from '../../db/inbox';

describe('AllTasksView', () => {
  // Runs first: the mocked `db` instance is created once for this whole file
  // (see vi.mock above), so this must execute before any other test creates
  // tasks in order to observe a genuinely empty list.
  it('shows an empty state with no tasks', async () => {
    render(<AllTasksView />);
    expect(await screen.findByText('No tasks yet.')).toBeInTheDocument();
  });

  it('lists tasks from multiple projects with their resolved project name', async () => {
    const project = await createProject('Alpha');
    const container = await createContainer(project.id, 'Backlog');
    await createTask({ title: 'Alpha task', projectId: project.id, containerId: container.id });
    await createTask({ title: 'Inbox task', projectId: INBOX_PROJECT_ID, containerId: INBOX_CONTAINER_ID });

    render(<AllTasksView />);

    expect(await screen.findByText('Alpha task')).toBeInTheDocument();
    expect(screen.getByText('Inbox task')).toBeInTheDocument();
    expect(screen.getByText('Alpha')).toBeInTheDocument();
  });

  it('toggles a task completed via its checkbox', async () => {
    const task = await createTask({ title: 'Toggle me', projectId: INBOX_PROJECT_ID, containerId: INBOX_CONTAINER_ID });

    render(<AllTasksView />);
    await userEvent.click(await screen.findByLabelText('Toggle completed for Toggle me'));

    const { db } = await import('../../db/db');
    expect((await db.tasks.get(task.id))?.completed).toBe(true);
  });

  it('opens the edit dialog when a task title is clicked', async () => {
    await createTask({ title: 'Editable', projectId: INBOX_PROJECT_ID, containerId: INBOX_CONTAINER_ID });

    render(<AllTasksView />);
    await userEvent.click(await screen.findByText('Editable'));

    expect(await screen.findByText('Edit task')).toBeInTheDocument();
  });
});

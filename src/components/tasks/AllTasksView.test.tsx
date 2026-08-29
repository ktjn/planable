// src/components/tasks/AllTasksView.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../db/db', async () => {
  const { PlanableDB } = await vi.importActual<typeof import('../../db/db')>('../../db/db');
  return { db: new PlanableDB(`test-alltasks-${Math.random()}`) };
});

import { AllTasksView } from './AllTasksView';
import { createProject } from '../../db/repositories/projects';
import { createContainer } from '../../db/repositories/containers';
import { createTask, setTaskCompleted, setTaskArchived } from '../../db/repositories/tasks';
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

  it('sinks completed tasks to the bottom', async () => {
    const project = await createProject('Beta');
    const container = await createContainer(project.id, 'BetaContainer');
    const openTask = await createTask({
      title: 'Open Task Z',
      projectId: project.id,
      containerId: container.id,
    });
    const doneTask = await createTask({
      title: 'Done Task A',
      projectId: project.id,
      containerId: container.id,
    });
    await setTaskCompleted(doneTask.id, true);

    render(<AllTasksView />);

    await screen.findByText('Open Task Z');
    const taskElements = screen.getAllByText(/^(Open Task Z|Done Task A)$/);
    expect(taskElements[0]).toHaveTextContent('Open Task Z');
    expect(taskElements[1]).toHaveTextContent('Done Task A');
  });

  it('hides archived tasks by default and shows only archived when show archived is checked', async () => {
    const project = await createProject('Gamma');
    const container = await createContainer(project.id, 'GammaContainer');
    const activeTask = await createTask({
      title: 'Active Gamma',
      projectId: project.id,
      containerId: container.id,
    });
    const archivedTask = await createTask({
      title: 'Archived Gamma',
      projectId: project.id,
      containerId: container.id,
    });
    await setTaskArchived(archivedTask.id, true);

    render(<AllTasksView />);

    expect(await screen.findByText('Active Gamma')).toBeInTheDocument();
    expect(screen.queryByText('Archived Gamma')).not.toBeInTheDocument();

    const checkbox = screen.getByLabelText('Show archived tasks');
    await userEvent.click(checkbox);

    expect(await screen.findByText('Archived Gamma')).toBeInTheDocument();
    expect(screen.queryByText('Active Gamma')).not.toBeInTheDocument();
  });

  it('toggles a task completed via its checkbox', async () => {
    const task = await createTask({ title: 'Toggle me', projectId: INBOX_PROJECT_ID, containerId: INBOX_CONTAINER_ID });

    render(<AllTasksView />);
    await userEvent.click(await screen.findByLabelText('Toggle completed for Toggle me'));

    const { db } = await import('../../db/db');
    expect((await db.tasks.get(task.id))?.completed).toBe(true);
  });

  it('opens the edit dialog when a task row is double-clicked', async () => {
    await createTask({ title: 'Editable', projectId: INBOX_PROJECT_ID, containerId: INBOX_CONTAINER_ID });

    render(<AllTasksView />);
    await userEvent.dblClick(await screen.findByText('Editable'));

    expect(await screen.findByText('Edit task')).toBeInTheDocument();
  });

  it('rings the card matching a console highlight request', async () => {
    const task = await createTask({
      title: 'Highlight me',
      projectId: INBOX_PROJECT_ID,
      containerId: INBOX_CONTAINER_ID,
    });

    render(<AllTasksView highlight={{ id: `task-${task.id}`, key: 1 }} />);

    const card = await screen.findByText('Highlight me');
    await waitFor(() => expect(card.closest(`#task-${task.id}`)).toHaveClass('ring-2'));
  });
});

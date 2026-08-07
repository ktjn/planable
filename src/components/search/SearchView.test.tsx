import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { PlanableDB } from '../../db/db';

vi.mock('../../db/db', async () => {
  const { PlanableDB } = await vi.importActual<typeof import('../../db/db')>('../../db/db');
  return { db: new PlanableDB(`test-searchview-${Math.random()}`) };
});

import { SearchView } from './SearchView';
import { createProject } from '../../db/repositories/projects';
import { createContainer, setContainerArchived } from '../../db/repositories/containers';
import { createTask, setTaskArchived } from '../../db/repositories/tasks';
import { INBOX_PROJECT_ID, INBOX_CONTAINER_ID } from '../../db/inbox';

describe('SearchView', () => {
  it('finds a task by title and calls onOpenTask on click', async () => {
    const project = await createProject('Alpha');
    const container = await createContainer(project.id, 'Backlog');
    const task = await createTask({
      title: 'Findable task',
      projectId: project.id,
      containerId: container.id,
      description: 'has some **markdown**',
    });

    const onOpenTask = vi.fn();
    render(<SearchView onOpenTask={onOpenTask} />);

    await userEvent.type(screen.getByPlaceholderText('Search tasks, descriptions, and containers…'), 'Findable');
    expect(await screen.findByText('Findable task')).toBeInTheDocument();

    await userEvent.click(screen.getByText('Findable task'));
    expect(onOpenTask).toHaveBeenCalledWith(expect.objectContaining({ id: task.id }));
  });

  it('matches task descriptions in addition to titles', async () => {
    await createTask({
      title: 'Another task',
      projectId: INBOX_PROJECT_ID,
      containerId: INBOX_CONTAINER_ID,
      description: 'mentions the keyword zebra',
    });

    render(<SearchView />);
    await userEvent.type(screen.getByPlaceholderText('Search tasks, descriptions, and containers…'), 'zebra');
    expect(await screen.findByText('Another task')).toBeInTheDocument();
  });

  it('shows a friendly empty state for no matches', async () => {
    render(<SearchView />);
    await userEvent.type(screen.getByPlaceholderText('Search tasks, descriptions, and containers…'), 'nothingmatchesthis');
    expect(await screen.findByText(/Nothing matches/)).toBeInTheDocument();
  });

  it('presents active matches before archived matches and marks archived ones', async () => {
    const project = await createProject('Alpha');
    const activeContainer = await createContainer(project.id, 'Lighthouse');
    await createTask({ title: 'Lighthouse task', projectId: project.id, containerId: activeContainer.id });

    const archivedContainer = await createContainer(project.id, 'Lighthouse Archived');
    const archivedTask = await createTask({
      title: 'Lighthouse stale',
      projectId: project.id,
      containerId: archivedContainer.id,
    });
    await setTaskArchived(archivedTask.id, true);

    render(<SearchView />);
    await userEvent.type(screen.getByPlaceholderText('Search tasks, descriptions, and containers…'), 'Lighthouse');

    await screen.findByText('Lighthouse task');
    await screen.findAllByText(/^Archived$/);
    const active = screen.getByText('Lighthouse task');
    const archivedRow = screen.getByText('Lighthouse stale');
    expect(active.compareDocumentPosition(archivedRow)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    // Archived results carry the Archived badge.
    expect(screen.getAllByText(/^Archived$/).length).toBeGreaterThan(0);
  });

  it('shows an "Archived container" badge for a task hidden by an archived parent container', async () => {
    const project = await createProject('Alpha');
    const archivedContainer = await createContainer(project.id, 'Walled');
    const task = await createTask({ title: 'Walled task', projectId: project.id, containerId: archivedContainer.id });
    await setContainerArchived(archivedContainer.id, true);

    render(<SearchView />);
    await userEvent.type(screen.getByPlaceholderText('Search tasks, descriptions, and containers…'), 'Walled');

    expect(await screen.findByText('Walled task')).toBeInTheDocument();
    expect(screen.getByText('Archived container')).toBeInTheDocument();
  });
});

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
import { createContainer } from '../../db/repositories/containers';
import { createTask } from '../../db/repositories/tasks';
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

    await userEvent.type(screen.getByPlaceholderText('Search tasks and descriptions…'), 'Findable');
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
    await userEvent.type(screen.getByPlaceholderText('Search tasks and descriptions…'), 'zebra');
    expect(await screen.findByText('Another task')).toBeInTheDocument();
  });

  it('shows a friendly empty state for no matches', async () => {
    render(<SearchView />);
    await userEvent.type(screen.getByPlaceholderText('Search tasks and descriptions…'), 'nothingmatchesthis');
    expect(await screen.findByText(/No tasks match/)).toBeInTheDocument();
  });
});

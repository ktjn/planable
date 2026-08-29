import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../db/db', async () => {
  const { PlanableDB } = await vi.importActual<typeof import('../../db/db')>('../../db/db');
  return { db: new PlanableDB(`test-allcontainers-${Math.random()}`) };
});

import { AllContainersView } from './AllContainersView';
import { createProject } from '../../db/repositories/projects';
import { createContainer, setContainerArchived } from '../../db/repositories/containers';
import { createLabel } from '../../db/repositories/labels';
import { createTask } from '../../db/repositories/tasks';
import { db } from '../../db/db';

describe('AllContainersView', () => {
  it('lists active containers with their project name and hides archived ones', async () => {
    const project = await createProject('Alpha');
    await createContainer(project.id, 'Backlog');
    const hidden = await createContainer(project.id, 'Hidden');
    await setContainerArchived(hidden.id, true);

    render(<AllContainersView />);
    expect(await screen.findByText('Backlog')).toBeInTheDocument();
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.queryByText('Hidden')).not.toBeInTheDocument();

    const checkbox = screen.getByLabelText('Show archived containers');
    await userEvent.click(checkbox);
    expect(await screen.findByText('Hidden')).toBeInTheDocument();
    expect(screen.queryByText('Backlog')).not.toBeInTheDocument();
  });

  it('shows labels on a container row', async () => {
    const project = await createProject('Alpha');
    const container = await createContainer(project.id, 'Labeled');
    const label = await createLabel('Security', '#ff0000');
    await db.containers.update(container.id, { labels: [label.id] });

    render(<AllContainersView />);
    expect(await screen.findByText('Security')).toBeInTheDocument();
  });

  it('quick-adds a child task directly into a container', async () => {
    const project = await createProject('Alpha');
    const container = await createContainer(project.id, 'Quick');

    render(<AllContainersView />);
    const row = (await screen.findByText('Quick')).closest('li')!;
    await userEvent.click(within(row).getByText('+ Quick add'));
    await userEvent.type(within(row).getByPlaceholderText('Type a title…'), 'New task{Enter}');

    await waitFor(async () => {
      const created = await db.tasks.filter((t) => t.title === 'New task').first();
      expect(created?.containerId).toBe(container.id);
    });
  });

  it('opens the container editor on double-click of a row', async () => {
    const project = await createProject('Alpha');
    await createContainer(project.id, 'Editable');

    render(<AllContainersView />);
    await userEvent.dblClick(await screen.findByText('Editable'));
    expect(await screen.findByText('Edit container')).toBeInTheDocument();
  });

  it('lists a container\'s tasks after expanding the row', async () => {
    const project = await createProject('Alpha');
    const container = await createContainer(project.id, 'Expando');
    await createTask({ title: 'Child', projectId: project.id, containerId: container.id });

    render(<AllContainersView />);
    const expandButton = await screen.findByRole('button', { name: /expand expando/i });
    const row = expandButton.closest('li')!;
    await userEvent.click(expandButton);
    expect(await within(row).findByText('Child')).toBeInTheDocument();
  });
});

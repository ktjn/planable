import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../db/db', async () => {
  const { PlanableDB } = await vi.importActual<typeof import('../../db/db')>('../../db/db');
  return { db: new PlanableDB(`test-containerdialog-${Math.random()}`) };
});

import { ContainerDialog } from './ContainerDialog';
import { createProject } from '../../db/repositories/projects';
import { createContainer } from '../../db/repositories/containers';
import type { Container } from '../../db/schema';
import { db } from '../../db/db';

describe('ContainerDialog', () => {
  async function makeContainer(): Promise<Container> {
    const project = await createProject('Demo');
    return createContainer(project.id, 'Backlog');
  }

  it('closes via Cancel without persisting a rename', async () => {
    const container = await makeContainer();
    const onClose = vi.fn();
    render(<ContainerDialog container={container} onClose={onClose} />);

    const input = screen.getByLabelText('Name');
    await userEvent.clear(input);
    await userEvent.type(input, 'Renamed');
    await userEvent.click(screen.getByText('Cancel'));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect((await db.containers.get(container.id))?.name).toBe('Backlog');
  });

  it('saves a rename and closes', async () => {
    const container = await makeContainer();
    const onClose = vi.fn();
    render(<ContainerDialog container={container} onClose={onClose} />);

    await userEvent.clear(screen.getByLabelText('Name'));
    await userEvent.type(screen.getByLabelText('Name'), 'Renamed');
    await userEvent.click(screen.getByText('Save'));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect((await db.containers.get(container.id))?.name).toBe('Renamed');
  });
});

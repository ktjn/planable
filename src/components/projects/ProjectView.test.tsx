import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../db/db', async () => {
  const { PlanableDB } = await vi.importActual<typeof import('../../db/db')>('../../db/db');
  return { db: new PlanableDB(`test-projectview-${Math.random()}`) };
});

import { ProjectView } from './ProjectView';
import { createProject } from '../../db/repositories/projects';

describe('ProjectView', () => {
  it('creates a container via the UI and lists it', async () => {
    const project = await createProject('Demo');
    render(<ProjectView projectId={project.id} />);

    await userEvent.type(screen.getByPlaceholderText('New container name'), 'Backlog');
    await userEvent.click(screen.getByText('Add container'));

    expect(await screen.findByDisplayValue('Backlog')).toBeInTheDocument();
  });
});

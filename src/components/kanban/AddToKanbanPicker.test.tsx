import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../db/db', async () => {
  const { PlanableDB } = await vi.importActual<typeof import('../../db/db')>('../../db/db');
  return { db: new PlanableDB(`test-addtokanban-${Math.random()}`) };
});

import { AddToKanbanPicker } from './AddToKanbanPicker';
import { createContainer } from '../../db/repositories/containers';
import { createProject } from '../../db/repositories/projects';
import { db } from '../../db/db';

describe('AddToKanbanPicker', () => {
  it('finds a container by search and adds it to Kanban as Todo on click', async () => {
    const project = await createProject('Eng');
    await createContainer(project.id, 'Board me');
    const onClose = vi.fn();
    render(<AddToKanbanPicker onClose={onClose} />);

    await userEvent.type(screen.getByPlaceholderText('Search containers'), 'Board');
    await userEvent.click(await screen.findByText('Board me'));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const container = await db.containers.filter((c) => c.name === 'Board me').first();
    await waitFor(() => expect(container?.kanban).toEqual({ status: 'Todo' }));
  });
});

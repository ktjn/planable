import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DndContext } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';

vi.mock('../../db/db', async () => {
  const { PlanableDB } = await vi.importActual<typeof import('../../db/db')>('../../db/db');
  return { db: new PlanableDB(`test-containercolumn-dnd-${Math.random()}`) };
});

import { ContainerColumn } from './ContainerColumn';
import { createProject } from '../../db/repositories/projects';
import { createContainer } from '../../db/repositories/containers';
import { createTask } from '../../db/repositories/tasks';

describe('ContainerColumn drag-and-drop', () => {
  it('renders itself as a drop target and its tasks as drag sources', async () => {
    const project = await createProject('Demo');
    const container = await createContainer(project.id, 'Backlog');
    await createTask({ title: 'Movable task', projectId: project.id, containerId: container.id });

    render(
      <DndContext onDragEnd={() => {}}>
        <SortableContext items={[container.id]} strategy={rectSortingStrategy}>
          <ContainerColumn container={container} />
        </SortableContext>
      </DndContext>,
    );

    const columnHeading = await screen.findByDisplayValue('Backlog');
    expect(columnHeading.closest('[data-dnd-droppable]')).toBeInTheDocument();
    const taskRow = await screen.findByText('Movable task');
    expect(taskRow.closest('[data-dnd-draggable]')).toBeInTheDocument();
  });
});

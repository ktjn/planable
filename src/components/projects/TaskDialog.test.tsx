import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../db/db', async () => {
  const { PlanableDB } = await vi.importActual<typeof import('../../db/db')>('../../db/db');
  return { db: new PlanableDB(`test-taskdialog-${Math.random()}`) };
});

import { TaskDialog } from './TaskDialog';
import { INBOX_PROJECT_ID, INBOX_CONTAINER_ID } from '../../db/inbox';
import { listTasksByContainer } from '../../db/repositories/tasks';

describe('TaskDialog', () => {
  it('creates a task with a title and description', async () => {
    const onClose = vi.fn();
    render(
      <TaskDialog
        mode="create"
        projectId={INBOX_PROJECT_ID}
        containerId={INBOX_CONTAINER_ID}
        onClose={onClose}
      />,
    );

    await userEvent.type(screen.getByLabelText('Title'), 'Write spec');
    await userEvent.type(screen.getByLabelText('Description'), 'Some **markdown**');
    await userEvent.click(screen.getByText('Save'));

    expect(onClose).toHaveBeenCalled();
    const tasks = await listTasksByContainer(INBOX_CONTAINER_ID);
    expect(tasks.find((t) => t.title === 'Write spec')?.description).toBe('Some **markdown**');
  });
});

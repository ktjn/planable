import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../db/db', async () => {
  const { PlanableDB } = await vi.importActual<typeof import('../../db/db')>('../../db/db');
  return { db: new PlanableDB(`test-taskdialog-${Math.random()}`) };
});

import { TaskDialog } from './TaskDialog';
import { INBOX_PROJECT_ID, INBOX_CONTAINER_ID } from '../../db/inbox';
import { listTasksByContainer } from '../../db/repositories/tasks';
import { addToWeek } from '../../db/repositories/taskMembership';
import { listWeekTemplates } from '../../db/repositories/weekTemplates';
import { db } from '../../db/db';

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

  it('registers a repeat-every-week task as a template when toggled', async () => {
    const task = await (async () => {
      const { createTask } = await import('../../db/repositories/tasks');
      const t = await createTask({
        title: 'Standup',
        projectId: INBOX_PROJECT_ID,
        containerId: INBOX_CONTAINER_ID,
      });
      await addToWeek(t.id, '2026-W32');
      return t;
    })();

    const onClose = vi.fn();
    render(
      <TaskDialog
        mode="edit"
        projectId={INBOX_PROJECT_ID}
        containerId={INBOX_CONTAINER_ID}
        task={task}
        onClose={onClose}
      />,
    );

    await userEvent.click(screen.getByLabelText('Repeat every week'));
    await userEvent.click(screen.getByText('Save'));
    await waitFor(() => expect(onClose).toHaveBeenCalled());

    const templates = await listWeekTemplates();
    expect(templates).toHaveLength(1);
    expect(templates[0].taskId).toBe(task.id);
    expect(templates[0].title).toBe('Standup');

    const updated = await db.tasks.get(task.id);
    expect(updated?.weekly?.repeatWeekly).toBe(true);
  });
});

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../db/db', async () => {
  const { PlanableDB } = await vi.importActual<typeof import('../../db/db')>('../../db/db');
  return { db: new PlanableDB(`test-console-${Math.random()}`) };
});

import { ConsolePanel } from './ConsolePanel';
import { db } from '../../db/db';
import { createProject } from '../../db/repositories/projects';
import { createContainer } from '../../db/repositories/containers';
import { createTask } from '../../db/repositories/tasks';
import { createLabel } from '../../db/repositories/labels';
import { INBOX_PROJECT_ID } from '../../db/inbox';

describe('ConsolePanel', () => {
  let confirmSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  afterEach(() => {
    confirmSpy.mockRestore();
  });

  it('renders collapsed with a hint, and expands to show the query input', async () => {
    render(<ConsolePanel onNavigate={vi.fn()} />);

    expect(screen.getByText(/press/i)).toBeInTheDocument();
    expect(screen.queryByLabelText('Console query')).not.toBeInTheDocument();

    await userEvent.click(screen.getByText(/press/i));

    expect(await screen.findByLabelText('Console query')).toBeInTheDocument();
  });

  it('finds a matching task and navigates with a highlight id on selection', async () => {
    const project = await createProject('Website');
    const container = await createContainer(project.id, 'Frontend');
    await createTask({ title: 'Fix nav overlap', projectId: project.id, containerId: container.id });

    const onNavigate = vi.fn();
    render(<ConsolePanel onNavigate={onNavigate} />);
    await userEvent.click(screen.getByText(/press/i));
    await userEvent.type(screen.getByLabelText('Console query'), 'nav');

    const result = await screen.findByText('Fix nav overlap');
    await userEvent.click(result);

    expect(onNavigate).toHaveBeenCalledWith(
      { kind: 'all-tasks' },
      expect.stringMatching(/^task-/),
    );
  });

  it('runs the > reset action after confirming, clearing all data back to Inbox only', async () => {
    await createProject('Doomed project');
    expect(await db.projects.count()).toBeGreaterThan(1);

    render(<ConsolePanel onNavigate={vi.fn()} />);
    await userEvent.click(screen.getByText(/press/i));
    await userEvent.type(screen.getByLabelText('Console query'), '> reset{Enter}');

    await waitFor(async () => {
      const projects = await db.projects.toArray();
      expect(projects).toEqual([expect.objectContaining({ id: INBOX_PROJECT_ID })]);
    });
    expect(confirmSpy).toHaveBeenCalled();
  });

  it('the Sample data button seeds a demo dataset without confirmation', async () => {
    confirmSpy.mockReturnValue(false);
    render(<ConsolePanel onNavigate={vi.fn()} />);
    await userEvent.click(screen.getByText(/press/i));

    await userEvent.click(screen.getByRole('button', { name: /sample data/i }));

    await waitFor(async () => expect(await db.tasks.count()).toBeGreaterThan(0));
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('the Reset button asks for confirmation before clearing data', async () => {
    confirmSpy.mockReturnValue(false);
    await createProject('Keep me');

    render(<ConsolePanel onNavigate={vi.fn()} />);
    await userEvent.click(screen.getByText(/press/i));
    await userEvent.click(screen.getByRole('button', { name: /^reset$/i }));

    expect(confirmSpy).toHaveBeenCalled();
    expect(await db.projects.count()).toBeGreaterThan(1);
  });

  it('Tab-completes a partial field name', async () => {
    render(<ConsolePanel onNavigate={vi.fn()} />);
    await userEvent.click(screen.getByText(/press/i));
    const input = screen.getByLabelText('Console query') as HTMLInputElement;

    await userEvent.type(input, 'l');
    await userEvent.keyboard('{Tab}');

    expect(input).toHaveValue('label:');
  });

  it('Tab-completes a label value from live data', async () => {
    const project = await createProject('Website');
    const container = await createContainer(project.id, 'Frontend');
    await createTask({ title: 'Task', projectId: project.id, containerId: container.id, labels: [] });
    await createLabel('Bug', '#ef4444');

    render(<ConsolePanel onNavigate={vi.fn()} />);
    await userEvent.click(screen.getByText(/press/i));
    const input = screen.getByLabelText('Console query') as HTMLInputElement;

    await userEvent.type(input, 'label:b');
    await waitFor(() => expect(input).toHaveValue('label:b'));
    await userEvent.keyboard('{Tab}');

    expect(input).toHaveValue('label:bug ');
  });

  it('ArrowRight also accepts the current suggestion', async () => {
    render(<ConsolePanel onNavigate={vi.fn()} />);
    await userEvent.click(screen.getByText(/press/i));
    const input = screen.getByLabelText('Console query') as HTMLInputElement;

    await userEvent.type(input, 'con');
    await userEvent.keyboard('{ArrowRight}');

    expect(input).toHaveValue('container ');
  });

  it('Tab-completes an action invocation after >', async () => {
    render(<ConsolePanel onNavigate={vi.fn()} />);
    await userEvent.click(screen.getByText(/press/i));
    const input = screen.getByLabelText('Console query') as HTMLInputElement;

    await userEvent.type(input, '> goto k');
    await userEvent.keyboard('{Tab}');

    expect(input).toHaveValue('> goto kanban ');
  });

  it('batch-completes checked tasks via the action bar', async () => {
    const project = await createProject('Website');
    const container = await createContainer(project.id, 'Frontend');
    const a = await createTask({ title: 'Batchcomplete Alpha', projectId: project.id, containerId: container.id });
    const b = await createTask({ title: 'Batchcomplete Beta', projectId: project.id, containerId: container.id });

    render(<ConsolePanel onNavigate={vi.fn()} />);
    await userEvent.click(screen.getByText(/press/i));
    await userEvent.type(screen.getByLabelText('Console query'), 'task batchcomplete');

    await userEvent.click(await screen.findByLabelText('Select Batchcomplete Alpha'));
    await userEvent.click(screen.getByLabelText('Select Batchcomplete Beta'));
    expect(screen.getByText('2 selected')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /^complete$/i }));

    await waitFor(async () => expect((await db.tasks.get(a.id))?.completed).toBe(true));
    expect((await db.tasks.get(b.id))?.completed).toBe(true);
    // Selection clears itself after applying.
    expect(screen.queryByText('2 selected')).not.toBeInTheDocument();
  });

  it('"select all" checks every visible result and toggles back off', async () => {
    const project = await createProject('Website');
    const container = await createContainer(project.id, 'Frontend');
    await createTask({ title: 'Selectall Alpha', projectId: project.id, containerId: container.id });
    await createTask({ title: 'Selectall Beta', projectId: project.id, containerId: container.id });

    render(<ConsolePanel onNavigate={vi.fn()} />);
    await userEvent.click(screen.getByText(/press/i));
    await userEvent.type(screen.getByLabelText('Console query'), 'task selectall');
    await screen.findByLabelText('Select Selectall Alpha');

    await userEvent.click(screen.getByLabelText('Select all results'));
    expect(await screen.findByText('2 selected')).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText('Select all results'));
    expect(screen.queryByText('2 selected')).not.toBeInTheDocument();
  });

  it('batch-archives a mixed selection of a task and a container', async () => {
    const project = await createProject('Website');
    const container = await createContainer(project.id, 'Archivemix Container');
    const task = await createTask({
      title: 'Archivemix Task',
      projectId: project.id,
      containerId: container.id,
    });

    render(<ConsolePanel onNavigate={vi.fn()} />);
    await userEvent.click(screen.getByText(/press/i));
    await userEvent.type(screen.getByLabelText('Console query'), 'archivemix');

    await userEvent.click(await screen.findByLabelText('Select Archivemix Task'));
    await userEvent.click(screen.getByLabelText('Select Archivemix Container'));

    await userEvent.click(screen.getByRole('button', { name: /^archive$/i }));

    await waitFor(async () => expect((await db.tasks.get(task.id))?.archived).toBe(true));
    expect((await db.containers.get(container.id))?.archived).toBe(true);
  });

  it('adds a label to checked results via the label select', async () => {
    const project = await createProject('Website');
    const container = await createContainer(project.id, 'Frontend');
    const task = await createTask({ title: 'Labeltarget Task', projectId: project.id, containerId: container.id });
    await createLabel('Batchlabelxyz', '#f97316');

    render(<ConsolePanel onNavigate={vi.fn()} />);
    await userEvent.click(screen.getByText(/press/i));
    await userEvent.type(screen.getByLabelText('Console query'), 'task labeltarget');
    await userEvent.click(await screen.findByLabelText('Select Labeltarget Task'));

    await userEvent.selectOptions(screen.getByLabelText('Label to add or remove'), 'Batchlabelxyz');
    await userEvent.click(screen.getByRole('button', { name: /^add$/i }));

    await waitFor(async () => {
      const updated = await db.tasks.get(task.id);
      expect(updated?.labels.length).toBe(1);
    });
  });

  it('clears the checked selection when the query changes', async () => {
    const project = await createProject('Website');
    const container = await createContainer(project.id, 'Frontend');
    await createTask({ title: 'Clearselect Task', projectId: project.id, containerId: container.id });

    render(<ConsolePanel onNavigate={vi.fn()} />);
    await userEvent.click(screen.getByText(/press/i));
    const input = screen.getByLabelText('Console query');
    await userEvent.type(input, 'task clearselect');
    await userEvent.click(await screen.findByLabelText('Select Clearselect Task'));
    expect(screen.getByText('1 selected')).toBeInTheDocument();

    await userEvent.type(input, ' extra');

    expect(screen.queryByText('1 selected')).not.toBeInTheDocument();
  });

  it('SELECT feeds the same checkbox/item pipeline as the plain query language', async () => {
    const project = await createProject('Website');
    const container = await createContainer(project.id, 'Frontend');
    await createTask({ title: 'Sqlselect Match', projectId: project.id, containerId: container.id });
    await createLabel('Sqlselectlabel', '#ef4444');

    render(<ConsolePanel onNavigate={vi.fn()} />);
    await userEvent.click(screen.getByText(/press/i));
    await userEvent.type(
      screen.getByLabelText('Console query'),
      "SELECT * FROM tasks WHERE title LIKE '%sqlselect%'",
    );

    expect(await screen.findByText('Sqlselect Match')).toBeInTheDocument();
    // It's checkable, exactly like a plain-text query result.
    expect(screen.getByLabelText('Select Sqlselect Match')).toBeInTheDocument();
  });

  it('shows a non-runnable error row when UPDATE is missing a WHERE clause', async () => {
    render(<ConsolePanel onNavigate={vi.fn()} />);
    await userEvent.click(screen.getByText(/press/i));
    await userEvent.type(screen.getByLabelText('Console query'), 'UPDATE tasks SET completed = true');

    expect(await screen.findByText(/WHERE clause/i)).toBeInTheDocument();
  });

  it('UPDATE runs immediately (autocommit) when there is no active transaction', async () => {
    const project = await createProject('Website');
    const container = await createContainer(project.id, 'Frontend');
    const task = await createTask({
      title: 'Autoupdate Task',
      projectId: project.id,
      containerId: container.id,
    });

    render(<ConsolePanel onNavigate={vi.fn()} />);
    await userEvent.click(screen.getByText(/press/i));
    await userEvent.type(
      screen.getByLabelText('Console query'),
      "UPDATE tasks SET completed = true WHERE title LIKE '%autoupdate%'{Enter}",
    );

    await waitFor(async () => expect((await db.tasks.get(task.id))?.completed).toBe(true));
  });

  it('DELETE FROM ... WHERE 1=1 deletes every matching row immediately outside a transaction', async () => {
    const project = await createProject('Website');
    const container = await createContainer(project.id, 'Frontend');
    const task = await createTask({
      title: 'Autodelete Task',
      projectId: project.id,
      containerId: container.id,
    });

    render(<ConsolePanel onNavigate={vi.fn()} />);
    await userEvent.click(screen.getByText(/press/i));
    await userEvent.type(
      screen.getByLabelText('Console query'),
      "DELETE FROM tasks WHERE title LIKE '%autodelete%'{Enter}",
    );

    await waitFor(async () => expect(await db.tasks.get(task.id)).toBeUndefined());
  });

  it('BEGIN, UPDATE, and COMMIT: staged changes are invisible to the database until COMMIT, then are written atomically', async () => {
    const project = await createProject('Website');
    const container = await createContainer(project.id, 'Frontend');
    const task = await createTask({
      title: 'Sandboxflow Task',
      projectId: project.id,
      containerId: container.id,
    });

    render(<ConsolePanel onNavigate={vi.fn()} />);
    await userEvent.click(screen.getByText(/press/i));
    const input = screen.getByLabelText('Console query');

    await userEvent.type(input, 'BEGIN{Enter}');
    expect(await screen.findByText(/1 pending|0 pending/)).toBeInTheDocument();

    await userEvent.type(
      input,
      "UPDATE tasks SET completed = true WHERE title LIKE '%sandboxflow%'{Enter}",
    );

    // Staged, not yet written.
    expect((await db.tasks.get(task.id))?.completed).toBe(false);
    expect(await screen.findByText(/1 pending/)).toBeInTheDocument();

    // A SELECT run inside the still-open transaction reflects the staged edit.
    await userEvent.type(input, "SELECT * FROM tasks WHERE done = true");
    expect(await screen.findByText('Sandboxflow Task')).toBeInTheDocument();

    await userEvent.clear(input);
    await userEvent.type(input, 'COMMIT{Enter}');

    await waitFor(async () => expect((await db.tasks.get(task.id))?.completed).toBe(true));
    expect(screen.queryByText(/pending/)).not.toBeInTheDocument();
  });

  it('ROLLBACK discards staged changes without writing them', async () => {
    const project = await createProject('Website');
    const container = await createContainer(project.id, 'Frontend');
    const task = await createTask({
      title: 'Rollbackflow Task',
      projectId: project.id,
      containerId: container.id,
    });

    render(<ConsolePanel onNavigate={vi.fn()} />);
    await userEvent.click(screen.getByText(/press/i));
    const input = screen.getByLabelText('Console query');

    await userEvent.type(input, 'BEGIN{Enter}');
    await userEvent.type(
      input,
      "DELETE FROM tasks WHERE title LIKE '%rollbackflow%'{Enter}",
    );
    expect(await screen.findByText(/1 pending/)).toBeInTheDocument();

    await userEvent.type(input, 'ROLLBACK{Enter}');

    expect(screen.queryByText(/pending/)).not.toBeInTheDocument();
    expect(await db.tasks.get(task.id)).toBeDefined();
  });

  it('a sandbox survives folding the console (Escape) and reopening it', async () => {
    render(<ConsolePanel onNavigate={vi.fn()} />);
    await userEvent.click(screen.getByText(/press/i));
    const input = screen.getByLabelText('Console query');
    await userEvent.type(input, 'BEGIN{Enter}');
    await screen.findByText(/pending/);

    await userEvent.keyboard('{Escape}');
    expect(screen.queryByLabelText('Console query')).not.toBeInTheDocument();
    expect(screen.getByText(/pending/)).toBeInTheDocument();

    await userEvent.click(screen.getByText(/Console — press/i));
    expect(await screen.findByText(/0 pending/)).toBeInTheDocument();
  });

  it('toggles open and closed with Ctrl+K', async () => {
    render(<ConsolePanel onNavigate={vi.fn()} />);
    expect(screen.queryByLabelText('Console query')).not.toBeInTheDocument();

    await userEvent.keyboard('{Control>}k{/Control}');
    expect(await screen.findByLabelText('Console query')).toBeInTheDocument();

    await userEvent.keyboard('{Control>}k{/Control}');
    await waitFor(() => expect(screen.queryByLabelText('Console query')).not.toBeInTheDocument());
  });
});

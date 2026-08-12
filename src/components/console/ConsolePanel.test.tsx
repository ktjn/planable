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

  it('toggles open and closed with Ctrl+K', async () => {
    render(<ConsolePanel onNavigate={vi.fn()} />);
    expect(screen.queryByLabelText('Console query')).not.toBeInTheDocument();

    await userEvent.keyboard('{Control>}k{/Control}');
    expect(await screen.findByLabelText('Console query')).toBeInTheDocument();

    await userEvent.keyboard('{Control>}k{/Control}');
    await waitFor(() => expect(screen.queryByLabelText('Console query')).not.toBeInTheDocument());
  });
});

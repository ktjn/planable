import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../db/db', async () => {
  const { PlanableDB } = await vi.importActual<typeof import('../../db/db')>('../../db/db');
  return { db: new PlanableDB(`test-taskcard-${Math.random()}`) };
});

import { TaskCard } from './TaskCard';
import type { Task } from '../../db/schema';

const baseTask: Task = {
  id: 't1',
  title: 'Badged task',
  description: '',
  labels: [],
  projectId: 'p',
  containerId: 'c',
  completed: false,
  completedDate: null,
  kanban: { status: 'Doing' },
  weekly: { weekId: '2026-W32', day: 'Tue', repeatWeekly: false },
};

describe('TaskCard membership badges', () => {
  it('shows kanban and weekly badges when the task has that membership', () => {
    render(<TaskCard task={baseTask} />);
    expect(screen.getByText('Kanban: Doing')).toBeInTheDocument();
    expect(screen.getByText('Week: Tue')).toBeInTheDocument();
  });

  it('shows no badges when the task has no membership', () => {
    render(<TaskCard task={{ ...baseTask, kanban: null, weekly: null }} />);
    expect(screen.queryByText(/Kanban:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Week:/)).not.toBeInTheDocument();
  });
});

describe('TaskCard add-to buttons', () => {
  it('shows both add buttons when the task has no membership', () => {
    render(<TaskCard task={{ ...baseTask, kanban: null, weekly: null }} />);
    expect(screen.getByText('Add to this week')).toBeInTheDocument();
    expect(screen.getByText('Add to Kanban')).toBeInTheDocument();
  });

  it('hides "Add to this week" when the task already has weekly membership', () => {
    render(<TaskCard task={{ ...baseTask, kanban: null }} />);
    expect(screen.queryByText('Add to this week')).not.toBeInTheDocument();
    expect(screen.getByText('Add to Kanban')).toBeInTheDocument();
  });

  it('hides "Add to Kanban" when the task already has kanban membership', () => {
    render(<TaskCard task={{ ...baseTask, weekly: null }} />);
    expect(screen.queryByText('Add to Kanban')).not.toBeInTheDocument();
    expect(screen.getByText('Add to this week')).toBeInTheDocument();
  });
});

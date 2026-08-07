import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../db/db', async () => {
  const { PlanableDB } = await vi.importActual<typeof import('../../db/db')>('../../db/db');
  return { db: new PlanableDB(`test-taskcard-${Math.random()}`) };
});

import { TaskCard } from './TaskCard';
import type { Task, Label } from '../../db/schema';

const baseTask: Task = {
  id: 't1',
  title: 'Badged task',
  description: '',
  labels: ['l1'],
  projectId: 'p',
  containerId: 'c',
  completed: false,
  completedDate: null,
  archived: false,
  weekly: { weekId: '2026-W32', day: 'Tue', repeatWeekly: false },
};

const label: Label = { id: 'l1', name: 'Security', color: '#ff0000' };
const labelsById = new Map([['l1', label]]);

describe('TaskCard membership badges', () => {
  it('shows weekly badge and labels', () => {
    const { queryByText } = render(<TaskCard task={baseTask} labelsById={labelsById} />);
    expect(screen.getByText('Week: Tue')).toBeInTheDocument();
    expect(screen.getByText('Security')).toBeInTheDocument();
    expect(queryByText(/Kanban:/)).not.toBeInTheDocument();
  });

  it('shows no badges when the task has no membership', () => {
    render(<TaskCard task={{ ...baseTask, labels: [], weekly: null }} labelsById={new Map()} />);
    expect(screen.queryByText(/Week:/)).not.toBeInTheDocument();
  });
});

describe('TaskCard interactions', () => {
  it('shows "Add to this week" only when not already scheduled', () => {
    const { rerender } = render(<TaskCard task={baseTask} labelsById={labelsById} />);
    expect(screen.queryByTitle('Add to this week')).not.toBeInTheDocument();

    rerender(<TaskCard task={{ ...baseTask, weekly: null }} labelsById={labelsById} />);
    expect(screen.getByTitle('Add to this week')).toBeInTheDocument();
  });
});

describe('TaskCard editing', () => {
  it('opens the edit dialog on double-click', async () => {
    render(<TaskCard task={baseTask} labelsById={labelsById} />);
    await userEvent.dblClick(screen.getByText('Badged task'));
    expect(await screen.findByText('Edit task')).toBeInTheDocument();
  });
});

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { DndContext } from '@dnd-kit/core';
import type { ReactElement } from 'react';

vi.mock('../../db/db', async () => {
  const { PlanableDB } = await vi.importActual<typeof import('../../db/db')>('../../db/db');
  return { db: new PlanableDB(`test-taskcard-${Math.random()}`) };
});

import { TaskCard } from './TaskCard';
import type { Task, Label } from '../../db/schema';

function wrap(node: ReactElement) {
  return <DndContext>{node}</DndContext>;
}

const baseTask: Task = {
  id: 't1',
  title: 'Badged task',
  description: '',
  labels: ['l1'],
  projectId: 'p',
  containerId: 'c',
  order: 0,
  completed: false,
  completedDate: null,
  archived: false,
  weekly: { weekId: '2026-W32', day: 'Tue', repeatWeekly: false },
};

const label: Label = { id: 'l1', name: 'Security', color: '#ff0000' };
const labelsById = new Map([['l1', label]]);

describe('TaskCard membership badges', () => {
  it('shows weekly badge and labels', () => {
    const { queryByText } = render(wrap(<TaskCard task={baseTask} labelsById={labelsById} />));
    expect(screen.getByText('Week: Tue')).toBeInTheDocument();
    expect(screen.getByText('Security')).toBeInTheDocument();
    expect(queryByText(/Kanban:/)).not.toBeInTheDocument();
  });

  it('shows no badges when the task has no membership', () => {
    render(wrap(<TaskCard task={{ ...baseTask, labels: [], weekly: null }} labelsById={new Map()} />));
    expect(screen.queryByText(/Week:/)).not.toBeInTheDocument();
  });
});

describe('TaskCard interactions', () => {
  it('shows "Add to this week" only when not already scheduled', () => {
    const { rerender } = render(wrap(<TaskCard task={baseTask} labelsById={labelsById} />));
    expect(screen.queryByTitle('Add to this week')).not.toBeInTheDocument();

    rerender(wrap(<TaskCard task={{ ...baseTask, weekly: null }} labelsById={labelsById} />));
    expect(screen.getByTitle('Add to this week')).toBeInTheDocument();
  });
});

describe('TaskCard editing', () => {
  it('opens the edit dialog on double-click', async () => {
    render(wrap(<TaskCard task={baseTask} labelsById={labelsById} />));
    await userEvent.dblClick(screen.getByText('Badged task'));
    expect(await screen.findByText('Edit task')).toBeInTheDocument();
  });
});

describe('TaskCard variants', () => {
  it('renders extra content when provided', () => {
    render(
      wrap(
        <TaskCard
          task={{ ...baseTask, labels: [], weekly: null }}
          labelsById={new Map()}
          extra={<span data-testid="extra">Alpha</span>}
        />,
      ),
    );
    expect(screen.getByTestId('extra')).toBeInTheDocument();
  });

  it('hides the checkbox when showCheckbox=false', () => {
    render(
      wrap(<TaskCard task={{ ...baseTask, labels: [], weekly: null }} labelsById={new Map()} showCheckbox={false} />),
    );
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('does not crash outside a SortableContext when sortableId is null', () => {
    render(
      wrap(
        <TaskCard
          task={{ ...baseTask, labels: [], weekly: null }}
          labelsById={new Map()}
          sortableId={null}
        />,
      ),
    );
    expect(screen.getByText('Badged task')).toBeInTheDocument();
  });
});

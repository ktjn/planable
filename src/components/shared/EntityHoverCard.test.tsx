import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import {
  TaskHoverCardContent,
  ContainerHoverCardContent,
  ProjectHoverCardContent,
} from './EntityHoverCard';
import type { Task, Container, Project, Label } from '../../db/schema';

const labelsById = new Map<string, Label>([['l1', { id: 'l1', name: 'Security', color: '#f00' }]]);
const task: Task = {
  id: 't1',
  title: 'Hover task',
  description: 'Details here',
  labels: ['l1'],
  projectId: 'p1',
  containerId: 'c1',
  order: 0,
  completed: false,
  completedDate: null,
  archived: false,
  weekly: { weekId: 'w', day: 'Tue', repeatWeekly: false, order: 0 },
};
const container: Container = {
  id: 'c1',
  projectId: 'p1',
  name: 'Backlog',
  order: 0,
  labels: ['l1'],
  archived: false,
  kanban: null,
};
const project: Project = { id: 'p1', name: 'Alpha', order: 0 };
const projectById = new Map([['p1', project]]);
const containerById = new Map([['c1', container]]);

describe('EntityHoverCard content', () => {
  it('renders task hover content', () => {
    render(
      <TaskHoverCardContent
        task={task}
        containerById={containerById}
        projectById={projectById}
        labelsById={labelsById}
      />,
    );
    expect(screen.getByText('Hover task')).toBeInTheDocument();
    expect(screen.getByText('Alpha › Backlog')).toBeInTheDocument();
    expect(screen.getByText('Security')).toBeInTheDocument();
  });

  it('renders container hover content', () => {
    render(
      <ContainerHoverCardContent
        container={container}
        projectById={projectById}
        labelsById={labelsById}
        taskCount={7}
      />,
    );
    expect(screen.getByText('Backlog')).toBeInTheDocument();
    expect(screen.getByText('7 tasks')).toBeInTheDocument();
  });

  it('renders project hover content', () => {
    render(
      <ProjectHoverCardContent
        project={project}
        labelsById={labelsById}
        containerCount={3}
        taskCount={12}
      />,
    );
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('3 containers · 12 tasks')).toBeInTheDocument();
  });
});

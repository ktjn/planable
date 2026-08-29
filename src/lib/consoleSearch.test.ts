import { describe, it, expect } from 'vitest';
import { parseConsoleQuery, type ItemQuery } from './consoleQuery';
import { searchItems } from './consoleSearch';
import type { Container, Label, Project, Task } from '../db/schema';

const project: Project = { id: 'p1', name: 'Website', order: 0 };
const otherProject: Project = { id: 'p2', name: 'Mobile', order: 1 };

const bugLabel: Label = { id: 'l1', name: 'Bug', color: '#ef4444' };
const featureLabel: Label = { id: 'l2', name: 'Feature', color: '#3b82f6' };

const frontend: Container = {
  id: 'c1',
  projectId: project.id,
  name: 'Frontend',
  order: 0,
  labels: [bugLabel.id],
  archived: false,
  kanban: { status: 'Doing' },
};
const archivedContainer: Container = {
  id: 'c2',
  projectId: project.id,
  name: 'Legacy',
  order: 1,
  labels: [],
  archived: true,
  kanban: null,
};

const navTask: Task = {
  id: 't1',
  title: 'Fix nav overlap',
  description: 'iOS Safari only',
  labels: [bugLabel.id],
  projectId: project.id,
  containerId: frontend.id,
  order: 0,
  globalOrder: 0,
  completed: false,
  completedDate: null,
  archived: false,
  weekly: { weekId: 'w1', day: 'Tue', repeatWeekly: false },
};
const doneTask: Task = {
  id: 't2',
  title: 'Ship release notes',
  description: '',
  labels: [featureLabel.id],
  projectId: otherProject.id,
  containerId: 'c3',
  order: 0,
  globalOrder: 1,
  completed: true,
  completedDate: 123,
  archived: false,
  weekly: null,
};

const ctx = {
  tasks: [navTask, doneTask],
  containers: [frontend, archivedContainer],
  projects: [project, otherProject],
  labels: [bugLabel, featureLabel],
};

function parse(input: string): ItemQuery {
  const parsed = parseConsoleQuery(input);
  if (parsed.kind !== 'items') throw new Error('expected item query');
  return parsed;
}

describe('searchItems', () => {
  it('free-text matches task title and description across all kinds', () => {
    const results = searchItems(parse('nav'), ctx);
    expect(results.map((r) => r.key)).toEqual(['task-t1']);
  });

  it('restricts to an explicit type', () => {
    const results = searchItems(parse('container'), ctx);
    expect(results.map((r) => r.kind)).toEqual(['container', 'container']);
  });

  it('filters tasks by label name', () => {
    const results = searchItems(parse('label:bug'), ctx);
    expect(results.map((r) => r.key)).toEqual(['task-t1', 'container-c1']);
  });

  it('excludes results with a negated label filter', () => {
    const results = searchItems(parse('-label:bug'), ctx);
    expect(results.some((r) => r.key === 'task-t1')).toBe(false);
    expect(results.some((r) => r.key === 'container-c1')).toBe(false);
  });

  it('filters containers by kanban status, narrowing kinds automatically', () => {
    const results = searchItems(parse('status:doing'), ctx);
    expect(results).toEqual([
      expect.objectContaining({ key: 'container-c1', kind: 'container' }),
    ]);
  });

  it('filters tasks by completion', () => {
    const results = searchItems(parse('done:true'), ctx);
    expect(results.map((r) => r.key)).toEqual(['task-t2']);
  });

  it('filters by day, accepting common aliases', () => {
    expect(searchItems(parse('day:tuesday'), ctx).map((r) => r.key)).toEqual(['task-t1']);
    expect(searchItems(parse('day:tue'), ctx).map((r) => r.key)).toEqual(['task-t1']);
  });

  it('filters by project name', () => {
    const results = searchItems(parse('project:mobile'), ctx);
    expect(results.map((r) => r.key)).toEqual(['task-t2']);
  });

  it('filters containers by archived flag', () => {
    const results = searchItems(parse('container archived:true'), ctx);
    expect(results.map((r) => r.key)).toEqual(['container-c2']);
  });

  it('matches projects and labels by name', () => {
    expect(searchItems(parse('project mobile'), ctx).map((r) => r.key)).toEqual(['project-p2']);
    expect(searchItems(parse('label feature'), ctx).map((r) => r.key)).toEqual(['label-l2']);
  });

  it('ignores unknown filter fields rather than excluding every entity', () => {
    const results = searchItems(parse('nonsense:whatever nav'), ctx);
    expect(results.map((r) => r.key)).toEqual(['task-t1']);
  });

  it('combines multiple filters and terms with AND semantics', () => {
    const results = searchItems(parse('task label:bug day:tue nav'), ctx);
    expect(results.map((r) => r.key)).toEqual(['task-t1']);
    expect(searchItems(parse('task label:bug day:mon nav'), ctx)).toEqual([]);
  });
});

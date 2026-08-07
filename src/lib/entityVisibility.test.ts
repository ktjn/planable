import { describe, it, expect } from 'vitest';
import {
  isContainerVisible,
  isTaskVisible,
  isTaskEffectivelyArchived,
} from './entityVisibility';
import type { Container, Task } from '../db/schema';

function container(over: Partial<Container> = {}): Container {
  return {
    id: 'c',
    projectId: 'p',
    name: 'C',
    order: 0,
    labels: [],
    archived: false,
    weekly: null,
    kanban: null,
    ...over,
  };
}

function task(over: Partial<Task> = {}): Task {
  return {
    id: 't',
    title: 'T',
    description: '',
    labels: [],
    projectId: 'p',
    containerId: 'c',
    completed: false,
    completedDate: null,
    archived: false,
    weekly: null,
    ...over,
  };
}

describe('entityVisibility', () => {
  it('a container is visible unless archived', () => {
    expect(isContainerVisible(container({ archived: false }))).toBe(true);
    expect(isContainerVisible(container({ archived: true }))).toBe(false);
  });

  it('a task is hidden when it is archived', () => {
    const map = new Map([['c', container()]]);
    expect(isTaskVisible(task({ archived: true }), map)).toBe(false);
    expect(isTaskEffectivelyArchived(task({ archived: true }), map)).toBe(true);
  });

  it('a task is effectively archived when its parent container is archived', () => {
    const map = new Map([['c', container({ archived: true })]]);
    expect(isTaskEffectivelyArchived(task({ archived: false }), map)).toBe(true);
    expect(isTaskVisible(task({ archived: false }), map)).toBe(false);
  });

  it('a missing parent container does not hide a task', () => {
    expect(isTaskEffectivelyArchived(task({ archived: false }), new Map())).toBe(false);
  });
});

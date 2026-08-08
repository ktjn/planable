import Dexie, { type Table } from 'dexie';
import type { Project, Container, Task, Label, WeekTemplate, Setting } from './schema';
import { INBOX_PROJECT, INBOX_CONTAINER } from './inbox';

export class PlanableDB extends Dexie {
  projects!: Table<Project, string>;
  containers!: Table<Container, string>;
  tasks!: Table<Task, string>;
  labels!: Table<Label, string>;
  weekTemplates!: Table<WeekTemplate, string>;
  settings!: Table<Setting, string>;

  constructor(name = 'planable') {
    super(name);
    this.version(1).stores({
      projects: 'id, order',
      containers: 'id, projectId, order',
      tasks: 'id, projectId, containerId, completed',
      labels: 'id, name',
    });
    // v2: drops the `completed` index. IndexedDB doesn't support boolean
    // index keys, so it was silently excluded from every record's index.
    this.version(2).stores({
      projects: 'id, order',
      containers: 'id, projectId, order',
      tasks: 'id, projectId, containerId',
      labels: 'id, name',
    });
    // v3: adds weekly templates (repeat-every-week definitions) and a
    // key/value settings store (active week, sync prefs, etc.).
    this.version(3).stores({
      projects: 'id, order',
      containers: 'id, projectId, order',
      tasks: 'id, projectId, containerId, weekly.weekId',
      labels: 'id, name',
      weekTemplates: 'id, projectId, taskId',
      settings: '&key',
    });
    // v4: adds an optional weekly membership to Containers so Containers can be
    // scheduled independently from their child Tasks on the Weekly Plan. Adds a
    // `weekly.weekId` index so scheduled Containers can be queried per week.
    this.version(4).stores({
      projects: 'id, order',
      containers: 'id, projectId, order, weekly.weekId',
      tasks: 'id, projectId, containerId, weekly.weekId',
      labels: 'id, name',
      weekTemplates: 'id, projectId, taskId',
      settings: '&key',
    }).upgrade(async (tx) => {
      await tx.table('containers').toCollection().modify((container) => {
        if (container.weekly === undefined) {
          container.weekly = null;
        }
      });
    });
    // v5: adds optional per-week/per-day ordering so the weekly plan can be
    // reordered independently of the task's container order.
    this.version(5).stores({
      projects: 'id, order',
      containers: 'id, projectId, order, weekly.weekId',
      tasks: 'id, projectId, containerId, weekly.weekId',
      labels: 'id, name',
      weekTemplates: 'id, projectId, taskId',
      settings: '&key',
    });
    this.on('populate', () => {
      this.projects.add(INBOX_PROJECT);
      this.containers.add(INBOX_CONTAINER);
    });
  }
}

export const db = new PlanableDB();

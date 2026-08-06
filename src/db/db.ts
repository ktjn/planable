import Dexie, { type Table } from 'dexie';
import type { Project, Container, Task, Label } from './schema';
import { INBOX_PROJECT, INBOX_CONTAINER } from './inbox';

export class PlanableDB extends Dexie {
  projects!: Table<Project, string>;
  containers!: Table<Container, string>;
  tasks!: Table<Task, string>;
  labels!: Table<Label, string>;

  constructor(name = 'planable') {
    super(name);
    this.version(1).stores({
      projects: 'id, order',
      containers: 'id, projectId, order',
      tasks: 'id, projectId, containerId, completed',
      labels: 'id, name',
    });
    // v2 drops the `completed` index: IndexedDB doesn't support boolean index
    // keys, so it was silently excluded from every record's index anyway.
    // No data migration needed — only the index declaration changes.
    this.version(2).stores({
      projects: 'id, order',
      containers: 'id, projectId, order',
      tasks: 'id, projectId, containerId',
      labels: 'id, name',
    });
    this.on('populate', () => {
      this.projects.add(INBOX_PROJECT);
      this.containers.add(INBOX_CONTAINER);
    });
  }
}

export const db = new PlanableDB();

import { db } from '../db/db';
import type { Project, Container, Task, Label } from '../db/schema';
import { INBOX_PROJECT, INBOX_CONTAINER } from '../db/inbox';

export interface PlanableExport {
  version: 1;
  projects: Project[];
  containers: Container[];
  tasks: Task[];
  labels: Label[];
}

export async function exportData(): Promise<PlanableExport> {
  const [projects, containers, tasks, labels] = await Promise.all([
    db.projects.toArray(),
    db.containers.toArray(),
    db.tasks.toArray(),
    db.labels.toArray(),
  ]);
  return { version: 1, projects, containers, tasks, labels };
}

export async function importData(data: PlanableExport): Promise<void> {
  await db.transaction('rw', db.projects, db.containers, db.tasks, db.labels, async () => {
    await db.tasks.clear();
    await db.containers.clear();
    await db.projects.clear();
    await db.labels.clear();

    await db.projects.bulkAdd(data.projects);
    if (!data.projects.some((p) => p.id === INBOX_PROJECT.id)) {
      await db.projects.add(INBOX_PROJECT);
    }
    await db.containers.bulkAdd(data.containers);
    if (!data.containers.some((c) => c.id === INBOX_CONTAINER.id)) {
      await db.containers.add(INBOX_CONTAINER);
    }
    await db.labels.bulkAdd(data.labels);
    await db.tasks.bulkAdd(data.tasks);
  });
}

import { db } from '../db/db';
import type { Project, Container, Task, Label, WeekTemplate, Setting } from '../db/schema';
import { INBOX_PROJECT, INBOX_CONTAINER } from '../db/inbox';

export interface PlanableExport {
  version: 2;
  projects: Project[];
  containers: Container[];
  tasks: Task[];
  labels: Label[];
  weekTemplates: WeekTemplate[];
  settings: Setting[];
}

export async function exportData(): Promise<PlanableExport> {
  const [projects, containers, tasks, labels, weekTemplates, settings] = await Promise.all([
    db.projects.toArray(),
    db.containers.toArray(),
    db.tasks.toArray(),
    db.labels.toArray(),
    db.weekTemplates.toArray(),
    db.settings.toArray(),
  ]);
  return { version: 2, projects, containers, tasks, labels, weekTemplates, settings };
}

export async function importData(data: PlanableExport): Promise<void> {
  const tasks = data.tasks ?? [];
  const projects = data.projects ?? [];
  const containers = data.containers ?? [];
  const labels = data.labels ?? [];
  // Legacy exports before Containers gained optional weekly membership have no
  // `weekly` field. Normalize it to `null` so the weekly.weekId index stays valid.
  const normalizedContainers = containers.map((container) => ({
    ...container,
    weekly: container.weekly ?? null,
  }));
  const weekTemplates = (data as Partial<PlanableExport>).weekTemplates ?? [];
  const settings = (data as Partial<PlanableExport>).settings ?? [];

  await db.transaction(
    'rw',
    [
      db.projects,
      db.containers,
      db.tasks,
      db.labels,
      db.weekTemplates,
      db.settings,
    ],
    async () => {
      await db.tasks.clear();
      await db.containers.clear();
      await db.projects.clear();
      await db.labels.clear();
      await db.weekTemplates.clear();
      await db.settings.clear();

      await db.projects.bulkAdd(projects);
      if (!projects.some((p) => p.id === INBOX_PROJECT.id)) {
        await db.projects.add(INBOX_PROJECT);
      }
      await db.containers.bulkAdd(normalizedContainers);
      if (!containers.some((c) => c.id === INBOX_CONTAINER.id)) {
        await db.containers.add(INBOX_CONTAINER);
      }
      await db.labels.bulkAdd(labels);
      await db.tasks.bulkAdd(tasks);
      await db.weekTemplates.bulkAdd(weekTemplates);
      await db.settings.bulkAdd(settings);
    },
  );
}

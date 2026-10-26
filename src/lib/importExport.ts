import { db } from '../db/db';
import type {
  Project,
  Container,
  Task,
  Label,
  WeekTemplate,
  Setting,
  WeekDay,
} from '../db/schema';
import { INBOX_PROJECT, INBOX_CONTAINER } from '../db/inbox';
import { getActiveWeekId } from './activeWeek';
import { DEFAULT_LABEL_COLOR, parseMarkdown, serializeMarkdown } from './markdownFormat';

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
      await db.containers.bulkAdd(containers);
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

export async function exportMarkdown(): Promise<string> {
  return serializeMarkdown(await exportData());
}

export interface MarkdownImportResult {
  projects: number;
  containers: number;
  tasks: number;
  labels: number;
  warnings: string[];
}

const nameKey = (name: string) => name.trim().toLowerCase();

/**
 * Additive import: never clears existing data. Projects, containers and labels
 * are matched by name (case-insensitive) and reused; everything else is
 * created with fresh ids.
 */
export async function importMarkdown(text: string): Promise<MarkdownImportResult> {
  const doc = parseMarkdown(text);
  if (doc.labels.length === 0 && doc.projects.length === 0) {
    throw new Error('No projects, containers, tasks, or labels found in the Markdown file.');
  }

  const defaultWeekId = await getActiveWeekId();
  const warnings = [...doc.warnings];
  const result: MarkdownImportResult = { projects: 0, containers: 0, tasks: 0, labels: 0, warnings };

  await db.transaction(
    'rw',
    [db.projects, db.containers, db.tasks, db.labels, db.weekTemplates],
    async () => {
      const [projects, containers, tasks, labels] = await Promise.all([
        db.projects.toArray(),
        db.containers.toArray(),
        db.tasks.toArray(),
        db.labels.toArray(),
      ]);

      const newLabels: Label[] = [];
      const newProjects: Project[] = [];
      const newContainers: Container[] = [];
      const newTasks: Task[] = [];
      const newTemplates: WeekTemplate[] = [];

      if (!projects.some((p) => p.id === INBOX_PROJECT.id)) {
        projects.push(INBOX_PROJECT);
        newProjects.push(INBOX_PROJECT);
      }
      if (!containers.some((c) => c.id === INBOX_CONTAINER.id)) {
        containers.push(INBOX_CONTAINER);
        newContainers.push(INBOX_CONTAINER);
      }

      const labelByName = new Map<string, Label>();
      for (const label of labels) {
        if (!labelByName.has(nameKey(label.name))) labelByName.set(nameKey(label.name), label);
      }
      const ensureLabel = (name: string, color = DEFAULT_LABEL_COLOR): Label => {
        const existing = labelByName.get(nameKey(name));
        if (existing) return existing;
        const label: Label = { id: crypto.randomUUID(), name: name.trim(), color };
        labelByName.set(nameKey(name), label);
        newLabels.push(label);
        return label;
      };
      for (const def of doc.labels) ensureLabel(def.name, def.color);

      const projectByName = new Map<string, Project>();
      for (const project of [...projects].sort((a, b) => a.order - b.order)) {
        if (!projectByName.has(nameKey(project.name))) {
          projectByName.set(nameKey(project.name), project);
        }
      }
      let nextProjectOrder = projects.reduce((max, p) => Math.max(max, p.order), -1) + 1;

      const containerByKey = new Map<string, Container>();
      const nextContainerOrder = new Map<string, number>();
      for (const container of [...containers].sort((a, b) => a.order - b.order)) {
        const key = `${container.projectId}\u0000${nameKey(container.name)}`;
        if (!containerByKey.has(key)) containerByKey.set(key, container);
        nextContainerOrder.set(
          container.projectId,
          Math.max(nextContainerOrder.get(container.projectId) ?? 0, container.order + 1),
        );
      }

      const nextTaskOrder = new Map<string, number>();
      const nextWeeklyOrder = new Map<string, number>();
      let nextGlobalOrder = 0;
      for (const task of tasks) {
        nextTaskOrder.set(
          task.containerId,
          Math.max(nextTaskOrder.get(task.containerId) ?? 0, task.order + 1),
        );
        nextGlobalOrder = Math.max(nextGlobalOrder, task.globalOrder + 1);
        if (task.weekly) {
          const key = `${task.weekly.weekId}\u0000${task.weekly.day}`;
          nextWeeklyOrder.set(key, Math.max(nextWeeklyOrder.get(key) ?? 0, (task.weekly.order ?? -1) + 1));
        }
      }

      for (const mdProject of doc.projects) {
        let project = projectByName.get(nameKey(mdProject.name));
        if (!project) {
          project = { id: crypto.randomUUID(), name: mdProject.name, order: nextProjectOrder };
          nextProjectOrder += 1;
          projectByName.set(nameKey(project.name), project);
          newProjects.push(project);
          result.projects += 1;
        }
        const projectId = project.id;

        for (const mdContainer of mdProject.containers) {
          const key = `${projectId}\u0000${nameKey(mdContainer.name)}`;
          let container = containerByKey.get(key);
          if (!container) {
            const order = nextContainerOrder.get(projectId) ?? 0;
            nextContainerOrder.set(projectId, order + 1);
            container = {
              id: crypto.randomUUID(),
              projectId,
              name: mdContainer.name,
              order,
              labels: mdContainer.labels.map((n) => ensureLabel(n).id),
              archived: mdContainer.archived,
              kanban: mdContainer.archived || !mdContainer.kanban ? null : { status: mdContainer.kanban },
            };
            containerByKey.set(key, container);
            newContainers.push(container);
            result.containers += 1;
          }
          const containerId = container.id;

          for (const mdTask of mdContainer.tasks) {
            const order = nextTaskOrder.get(containerId) ?? 0;
            nextTaskOrder.set(containerId, order + 1);

            let weekly: Task['weekly'] = null;
            if (mdTask.archived) {
              if (mdTask.week || mdTask.repeat) {
                warnings.push(
                  `Task "${mdTask.title}" is archived; its week and repeat settings were ignored.`,
                );
              }
            } else if (mdTask.week || mdTask.repeat) {
              const weekId = mdTask.week?.weekId ?? defaultWeekId;
              const day: WeekDay = mdTask.week?.day ?? 'Unplanned';
              const orderKey = `${weekId}\u0000${day}`;
              const weeklyOrder = nextWeeklyOrder.get(orderKey) ?? 0;
              nextWeeklyOrder.set(orderKey, weeklyOrder + 1);
              weekly = { weekId, day, repeatWeekly: mdTask.repeat, order: weeklyOrder };
            }

            const labelIds = mdTask.labels.map((n) => ensureLabel(n).id);
            const task: Task = {
              id: crypto.randomUUID(),
              title: mdTask.title,
              description: mdTask.description,
              labels: labelIds,
              projectId,
              containerId,
              order,
              globalOrder: nextGlobalOrder,
              completed: mdTask.completed,
              completedDate: mdTask.completed ? (mdTask.completedDate ?? Date.now()) : null,
              archived: mdTask.archived,
              weekly,
            };
            nextGlobalOrder += 1;
            newTasks.push(task);
            result.tasks += 1;

            if (weekly?.repeatWeekly) {
              newTemplates.push({
                id: crypto.randomUUID(),
                taskId: task.id,
                title: task.title,
                description: task.description,
                labels: task.labels,
                projectId,
                containerId,
              });
            }
          }
        }
      }

      result.labels = newLabels.length;
      await db.labels.bulkAdd(newLabels);
      await db.projects.bulkAdd(newProjects);
      await db.containers.bulkAdd(newContainers);
      await db.tasks.bulkAdd(newTasks);
      await db.weekTemplates.bulkAdd(newTemplates);
    },
  );

  return result;
}

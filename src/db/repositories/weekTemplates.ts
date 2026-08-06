import { db } from '../db';
import type { WeekTemplate } from '../schema';
import type { WeekDay } from '../schema';

export async function listWeekTemplates(): Promise<WeekTemplate[]> {
  return db.weekTemplates.toArray();
}

export async function getWeekTemplate(taskId: string): Promise<WeekTemplate | undefined> {
  return db.weekTemplates.where('taskId').equals(taskId).first();
}

export async function upsertWeekTemplate(input: {
  taskId: string;
  title: string;
  description?: string;
  labels?: string[];
  projectId: string;
  containerId: string;
}): Promise<WeekTemplate> {
  const existing = await getWeekTemplate(input.taskId);
  const template: WeekTemplate = {
    id: existing?.id ?? crypto.randomUUID(),
    taskId: input.taskId,
    title: input.title,
    description: input.description ?? '',
    labels: input.labels ?? [],
    projectId: input.projectId,
    containerId: input.containerId,
  };
  await db.weekTemplates.put(template);
  return template;
}

export async function deleteWeekTemplate(taskId: string): Promise<void> {
  const template = await getWeekTemplate(taskId);
  if (template) {
    await db.weekTemplates.delete(template.id);
  }
}

export async function spawnWeekTemplate(
  template: WeekTemplate,
  weekId: string,
  containerId?: string,
  projectId?: string,
): Promise<void> {
  await db.tasks.add({
    id: crypto.randomUUID(),
    title: template.title,
    description: template.description,
    labels: template.labels,
    projectId: projectId ?? template.projectId,
    containerId: containerId ?? template.containerId,
    completed: false,
    completedDate: null,
    kanban: null,
    weekly: { weekId, day: 'Unplanned' as WeekDay, repeatWeekly: true },
  });
}

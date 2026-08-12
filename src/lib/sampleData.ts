import { createProject } from '../db/repositories/projects';
import { createContainer, updateContainer, setContainerKanbanStatus, setContainerArchived } from '../db/repositories/containers';
import { createLabel } from '../db/repositories/labels';
import { createTask, setTaskCompleted, setTaskArchived } from '../db/repositories/tasks';
import { addToWeek, setWeeklyDay, setTaskRepeatWeekly } from '../db/repositories/taskMembership';
import { getActiveWeekId } from './activeWeek';
import { INBOX_PROJECT_ID, INBOX_CONTAINER_ID } from '../db/inbox';

/**
 * Inserts a demo dataset that touches every aspect of the schema — multiple
 * projects, an archived container, all four kanban statuses, labels with
 * distinct colors, weekly-scheduled tasks across several days (including
 * Unplanned), a repeating task with its week template, completed tasks, an
 * archived task, and Inbox tasks. Purely additive: existing data is untouched.
 */
export async function addSampleData(): Promise<void> {
  const weekId = await getActiveWeekId();

  const [bug, feature, urgent, docs, chore] = await Promise.all([
    createLabel('Bug', '#ef4444'),
    createLabel('Feature', '#3b82f6'),
    createLabel('Urgent', '#f97316'),
    createLabel('Docs', '#a855f7'),
    createLabel('Chore', '#6b7280'),
  ]);

  const website = await createProject('Website Redesign');
  const mobile = await createProject('Mobile App');

  const design = await createContainer(website.id, 'Design');
  await updateContainer(design.id, { labels: [feature.id] });

  const frontend = await createContainer(website.id, 'Frontend');
  await updateContainer(frontend.id, { labels: [bug.id, feature.id] });
  await setContainerKanbanStatus(frontend.id, 'Doing');

  const backend = await createContainer(website.id, 'Backend');
  await updateContainer(backend.id, { labels: [urgent.id] });
  await setContainerKanbanStatus(backend.id, 'Blocked');

  const legacy = await createContainer(website.id, 'Legacy Marketing Site');
  await setContainerArchived(legacy.id, true);

  const planning = await createContainer(mobile.id, 'Planning');
  await updateContainer(planning.id, { labels: [docs.id] });
  await setContainerKanbanStatus(planning.id, 'Todo');

  const release = await createContainer(mobile.id, 'Release 1.0');
  await setContainerKanbanStatus(release.id, 'Done');

  const wireframe = await createTask({
    title: 'Wireframe the landing page',
    projectId: website.id,
    containerId: design.id,
    labels: [feature.id],
  });
  await addToWeek(wireframe.id, weekId);
  await setWeeklyDay(wireframe.id, 'Mon');

  const navBug = await createTask({
    title: 'Fix nav overlap on mobile',
    description: 'Reported by QA on iOS Safari.',
    projectId: website.id,
    containerId: frontend.id,
    labels: [bug.id, urgent.id],
  });
  await addToWeek(navBug.id, weekId);
  await setWeeklyDay(navBug.id, 'Tue');

  const ciSetup = await createTask({
    title: 'Set up CI pipeline',
    projectId: website.id,
    containerId: backend.id,
    labels: [chore.id],
  });
  await setTaskCompleted(ciSetup.id, true);

  await createTask({
    title: 'Write API docs',
    projectId: website.id,
    containerId: backend.id,
    labels: [docs.id],
  });

  const oldForm = await createTask({
    title: 'Retire old contact form',
    projectId: website.id,
    containerId: legacy.id,
  });
  await setTaskArchived(oldForm.id, true);

  const teamSync = await createTask({
    title: 'Weekly team sync',
    description: 'Recurring planning check-in.',
    projectId: mobile.id,
    containerId: planning.id,
    labels: [chore.id],
  });
  await addToWeek(teamSync.id, weekId);
  await setWeeklyDay(teamSync.id, 'Fri');
  await setTaskRepeatWeekly(teamSync.id, true);

  const screenshots = await createTask({
    title: 'App Store screenshots',
    projectId: mobile.id,
    containerId: release.id,
    labels: [feature.id],
  });
  await setTaskCompleted(screenshots.id, true);

  await createTask({
    title: 'Triage crash reports',
    projectId: mobile.id,
    containerId: planning.id,
    labels: [bug.id, urgent.id],
  });

  const supportEmails = await createTask({
    title: 'Reply to support emails',
    projectId: INBOX_PROJECT_ID,
    containerId: INBOX_CONTAINER_ID,
    labels: [chore.id],
  });
  await addToWeek(supportEmails.id, weekId);

  await createTask({
    title: 'Renew domain registration',
    projectId: INBOX_PROJECT_ID,
    containerId: INBOX_CONTAINER_ID,
  });
}

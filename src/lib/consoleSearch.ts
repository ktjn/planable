import type { Container, KanbanStatus, Label, Project, Task, WeekDay } from '../db/schema';
import type { ActiveView } from '../components/layout/NavTabs';
import type { ConsoleEntityKind, ItemQuery, QueryFilter, QueryTerm } from './consoleQuery';

export interface ConsoleItemResult {
  key: string;
  id: string;
  kind: ConsoleEntityKind;
  title: string;
  subtitle?: string;
  badges: string[];
  navigate: ActiveView;
  /** DOM id of the card to scroll to and highlight after navigating, if any. */
  highlightId?: string;
}

export interface ConsoleSearchContext {
  tasks: Task[];
  containers: Container[];
  projects: Project[];
  labels: Label[];
}

const ALL_KINDS: ConsoleEntityKind[] = ['task', 'container', 'project', 'label'];

/** Which entity kinds a given filter field can possibly apply to. */
const FIELD_KINDS: Record<string, ConsoleEntityKind[]> = {
  label: ['task', 'container'],
  status: ['container'],
  day: ['task', 'container'],
  project: ['task', 'container'],
  done: ['task'],
  completed: ['task'],
  archived: ['task', 'container'],
  repeat: ['task'],
  kanban: ['container'],
  color: ['label'],
};

const DAY_ALIASES: Record<string, WeekDay> = {
  mon: 'Mon',
  monday: 'Mon',
  tue: 'Tue',
  tues: 'Tue',
  tuesday: 'Tue',
  wed: 'Wed',
  wednesday: 'Wed',
  thu: 'Thu',
  thur: 'Thu',
  thurs: 'Thu',
  thursday: 'Thu',
  fri: 'Fri',
  friday: 'Fri',
  unplanned: 'Unplanned',
  none: 'Unplanned',
  backlog: 'Unplanned',
};

export const STATUS_ALIASES: Record<string, KanbanStatus> = {
  todo: 'Todo',
  doing: 'Doing',
  'in-progress': 'Doing',
  inprogress: 'Doing',
  blocked: 'Blocked',
  done: 'Done',
  complete: 'Done',
  completed: 'Done',
};

export function parseBool(value: string): boolean {
  return ['true', 'yes', 'y', '1'].includes(value.toLowerCase());
}

function textMatches(haystacks: (string | undefined)[], term: QueryTerm): boolean {
  const hit = haystacks.some((h) => (h ?? '').toLowerCase().includes(term.text));
  return term.negate ? !hit : hit;
}

function effectiveKinds(query: ItemQuery): ConsoleEntityKind[] {
  let kinds = query.types ?? ALL_KINDS;
  const fields = new Set(query.filters.map((f) => f.field));
  for (const field of fields) {
    const applicable = FIELD_KINDS[field];
    if (applicable) kinds = kinds.filter((k) => applicable.includes(k));
  }
  return kinds;
}

function fieldMatchesTask(
  task: Task,
  filter: QueryFilter,
  projectById: Map<string, Project>,
  labelById: Map<string, Label>,
): boolean {
  let result: boolean;
  switch (filter.field) {
    case 'label':
      result = task.labels.some((id) => labelById.get(id)?.name.toLowerCase().includes(filter.value));
      break;
    case 'day': {
      const day = DAY_ALIASES[filter.value];
      result = Boolean(day) && task.weekly?.day === day;
      break;
    }
    case 'project': {
      const project = projectById.get(task.projectId);
      result = Boolean(project?.name.toLowerCase().includes(filter.value));
      break;
    }
    case 'done':
    case 'completed':
      result = task.completed === parseBool(filter.value);
      break;
    case 'archived':
      result = task.archived === parseBool(filter.value);
      break;
    case 'repeat':
      result = Boolean(task.weekly?.repeatWeekly) === parseBool(filter.value);
      break;
    default:
      return true;
  }
  return filter.negate ? !result : result;
}

function fieldMatchesContainer(
  container: Container,
  filter: QueryFilter,
  projectById: Map<string, Project>,
  labelById: Map<string, Label>,
): boolean {
  let result: boolean;
  switch (filter.field) {
    case 'label':
      result = container.labels.some((id) => labelById.get(id)?.name.toLowerCase().includes(filter.value));
      break;
    case 'status': {
      const status = STATUS_ALIASES[filter.value];
      result = Boolean(status) && container.kanban?.status === status;
      break;
    }
    case 'day': {
      // Reserved for future container scheduling; containers have no weekly field wired up yet.
      result = false;
      break;
    }
    case 'project': {
      const project = projectById.get(container.projectId);
      result = Boolean(project?.name.toLowerCase().includes(filter.value));
      break;
    }
    case 'archived':
      result = container.archived === parseBool(filter.value);
      break;
    case 'kanban':
      result = Boolean(container.kanban) === parseBool(filter.value);
      break;
    default:
      return true;
  }
  return filter.negate ? !result : result;
}

function fieldMatchesLabel(label: Label, filter: QueryFilter): boolean {
  let result: boolean;
  switch (filter.field) {
    case 'color':
      result = label.color.toLowerCase().includes(filter.value);
      break;
    default:
      return true;
  }
  return filter.negate ? !result : result;
}

function taskResult(task: Task, containerById: Map<string, Container>, projectById: Map<string, Project>): ConsoleItemResult {
  const project = projectById.get(task.projectId);
  const container = containerById.get(task.containerId);
  const badges: string[] = [];
  if (task.completed) badges.push('Done');
  if (task.archived) badges.push('Archived');
  if (task.weekly) badges.push(task.weekly.repeatWeekly ? 'Repeats weekly' : `Week: ${task.weekly.day}`);
  return {
    key: `task-${task.id}`,
    id: task.id,
    kind: 'task',
    title: task.title,
    subtitle: [project?.name, container?.name].filter(Boolean).join(' › '),
    badges,
    navigate: { kind: 'all-tasks' },
    highlightId: `task-${task.id}`,
  };
}

function containerResult(container: Container, projectById: Map<string, Project>): ConsoleItemResult {
  const project = projectById.get(container.projectId);
  const badges: string[] = [];
  if (container.kanban) badges.push(`Kanban: ${container.kanban.status}`);
  if (container.archived) badges.push('Archived');
  return {
    key: `container-${container.id}`,
    id: container.id,
    kind: 'container',
    title: container.name,
    subtitle: project?.name,
    badges,
    navigate: { kind: 'all-containers' },
    highlightId: `container-${container.id}`,
  };
}

function projectResult(project: Project): ConsoleItemResult {
  return {
    key: `project-${project.id}`,
    id: project.id,
    kind: 'project',
    title: project.name,
    badges: [],
    navigate: { kind: 'project', projectId: project.id },
  };
}

function labelResult(label: Label): ConsoleItemResult {
  return {
    key: `label-${label.id}`,
    id: label.id,
    kind: 'label',
    title: label.name,
    badges: [],
    navigate: { kind: 'labels' },
    highlightId: `label-${label.id}`,
  };
}

const RESULT_LIMIT = 30;

/** Matches tasks, containers, projects, and labels against a parsed item query. */
export function searchItems(query: ItemQuery, ctx: ConsoleSearchContext): ConsoleItemResult[] {
  const kinds = effectiveKinds(query);
  const containerById = new Map(ctx.containers.map((c) => [c.id, c]));
  const projectById = new Map(ctx.projects.map((p) => [p.id, p]));
  const labelById = new Map(ctx.labels.map((l) => [l.id, l]));
  const results: ConsoleItemResult[] = [];

  if (kinds.includes('task')) {
    for (const task of ctx.tasks) {
      const okFilters = query.filters.every((f) => fieldMatchesTask(task, f, projectById, labelById));
      const okTerms = query.terms.every((t) => textMatches([task.title, task.description], t));
      if (okFilters && okTerms) results.push(taskResult(task, containerById, projectById));
    }
  }
  if (kinds.includes('container')) {
    for (const container of ctx.containers) {
      const okFilters = query.filters.every((f) => fieldMatchesContainer(container, f, projectById, labelById));
      const okTerms = query.terms.every((t) => textMatches([container.name], t));
      if (okFilters && okTerms) results.push(containerResult(container, projectById));
    }
  }
  if (kinds.includes('project')) {
    for (const project of ctx.projects) {
      const okTerms = query.terms.every((t) => textMatches([project.name], t));
      if (okTerms) results.push(projectResult(project));
    }
  }
  if (kinds.includes('label')) {
    for (const label of ctx.labels) {
      const okFilters = query.filters.every((f) => fieldMatchesLabel(label, f));
      const okTerms = query.terms.every((t) => textMatches([label.name], t));
      if (okFilters && okTerms) results.push(labelResult(label));
    }
  }

  return results.slice(0, RESULT_LIMIT);
}

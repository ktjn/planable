import type { Container, KanbanStatus, Label, Project, Task, WeekDay } from '../db/schema';

export const MARKDOWN_FORMAT_VERSION = 1;
export const DEFAULT_LABEL_COLOR = '#3b82f6';

const KANBAN_STATUSES: KanbanStatus[] = ['Todo', 'Doing', 'Blocked', 'Done'];
const WEEK_DAYS: WeekDay[] = ['Unplanned', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const WEEK_ID = /^\d{4}-W(\d{2})$/;
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const CONTAINER_KEYS = new Set(['labels', 'kanban', 'archived']);
const TASK_KEYS = new Set(['labels', 'week', 'repeat', 'completed', 'archived']);
const TRUE_WORDS = new Set(['true', 'yes', 'on']);
const FALSE_WORDS = new Set(['false', 'no', 'off']);

export interface MdLabelDef {
  name: string;
  color: string;
}

export interface MdTask {
  title: string;
  description: string;
  labels: string[];
  completed: boolean;
  completedDate: number | null;
  archived: boolean;
  week: { weekId: string; day: WeekDay } | null;
  repeat: boolean;
}

export interface MdContainer {
  name: string;
  labels: string[];
  kanban: KanbanStatus | null;
  archived: boolean;
  tasks: MdTask[];
}

export interface MdProject {
  name: string;
  containers: MdContainer[];
}

export interface MdDocument {
  labels: MdLabelDef[];
  projects: MdProject[];
  warnings: string[];
}

export interface MarkdownExportInput {
  projects: Project[];
  containers: Container[];
  tasks: Task[];
  labels: Label[];
}

function oneLine(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function joinList(items: string[]): string {
  return items.map((item) => item.replace(/[\\,]/g, '\\$&')).join(', ');
}

export function splitList(value: string): string[] {
  const out: string[] = [];
  let current = '';
  for (let i = 0; i < value.length; i += 1) {
    const ch = value[i];
    const next = value[i + 1];
    if (ch === '\\' && (next === ',' || next === '\\')) {
      current += next;
      i += 1;
    } else if (ch === ',') {
      out.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  out.push(current);
  return out.map((s) => s.trim()).filter(Boolean);
}

function uniqueNames(names: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const name of names) {
    const key = name.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(name);
    }
  }
  return out;
}

function headingText(name: string): string {
  const text = oneLine(name) || 'Untitled';
  return /\s#+$/.test(text) ? `${text} #` : text;
}

function parseBool(value: string): boolean | null {
  const v = value.trim().toLowerCase();
  if (TRUE_WORDS.has(v)) return true;
  if (FALSE_WORDS.has(v)) return false;
  return null;
}

export function serializeMarkdown(data: MarkdownExportInput): string {
  const labelNames = new Map(data.labels.map((l) => [l.id, l.name]));
  const namesFor = (ids: string[]) =>
    uniqueNames(ids.map((id) => labelNames.get(id)).filter((n): n is string => !!n));

  const out: string[] = ['---', `planable: ${MARKDOWN_FORMAT_VERSION}`];
  if (data.labels.length > 0) {
    out.push('labels:');
    for (const label of data.labels) {
      out.push(`  - ${JSON.stringify({ name: label.name, color: label.color })}`);
    }
  }
  out.push('---', '');

  const projectIds = new Set(data.projects.map((p) => p.id));
  const containerIds = new Set(data.containers.map((c) => c.id));
  const byOrder = <T extends { order: number }>(a: T, b: T) => a.order - b.order;

  const tasksByContainer = new Map<string, Task[]>();
  for (const task of [...data.tasks].sort(byOrder)) {
    const list = tasksByContainer.get(task.containerId) ?? [];
    list.push(task);
    tasksByContainer.set(task.containerId, list);
  }

  const writeTask = (task: Task) => {
    const mark = task.completed ? 'x' : ' ';
    out.push(`- [${mark}] ${oneLine(task.title) || 'Untitled'}`);
    const labels = namesFor(task.labels);
    if (labels.length > 0) out.push(`  - labels: ${joinList(labels)}`);
    if (task.weekly) out.push(`  - week: ${task.weekly.weekId} ${task.weekly.day}`);
    if (task.weekly?.repeatWeekly) out.push('  - repeat: weekly');
    if (task.completedDate !== null && Number.isFinite(task.completedDate)) {
      out.push(`  - completed: ${new Date(task.completedDate).toISOString()}`);
    }
    if (task.archived) out.push('  - archived: true');
    const description = (task.description ?? '')
      .replace(/\r\n?/g, '\n')
      .replace(/^(?:[ \t]*\n)+/, '')
      .trimEnd();
    if (description.trim()) {
      out.push('');
      for (const line of description.split('\n')) {
        out.push(line.trim() ? `  ${line}` : '');
      }
    }
  };

  const writeContainer = (container: Container | null, name: string) => {
    out.push(`## ${headingText(name)}`);
    if (container) {
      const labels = namesFor(container.labels);
      if (labels.length > 0) out.push(`- labels: ${joinList(labels)}`);
      if (container.kanban) out.push(`- kanban: ${container.kanban.status}`);
      if (container.archived) out.push('- archived: true');
    }
    const tasks = container ? (tasksByContainer.get(container.id) ?? []) : [];
    if (container && (container.labels.length > 0 || container.kanban || container.archived)) {
      if (tasks.length > 0) out.push('');
    }
    for (const task of tasks) writeTask(task);
    out.push('');
  };

  for (const project of [...data.projects].sort(byOrder)) {
    out.push(`# ${headingText(project.name)}`, '');
    const containers = data.containers.filter((c) => c.projectId === project.id).sort(byOrder);
    for (const container of containers) writeContainer(container, container.name);
  }

  const orphanContainers = data.containers.filter((c) => !projectIds.has(c.projectId));
  const orphanTasks = data.tasks
    .filter((t) => !containerIds.has(t.containerId))
    .sort(byOrder);
  if (orphanContainers.length > 0 || orphanTasks.length > 0) {
    out.push('# Inbox', '');
    for (const container of orphanContainers.sort(byOrder)) {
      writeContainer(container, container.name);
    }
    if (orphanTasks.length > 0) {
      out.push('## Unfiled');
      for (const task of orphanTasks) writeTask(task);
      out.push('');
    }
  }

  while (out.length > 0 && out[out.length - 1] === '') out.pop();
  return `${out.join('\n')}\n`;
}

function parseFrontMatter(lines: string[], firstLine: number, doc: MdDocument): void {
  let inLabels = false;
  lines.forEach((raw, idx) => {
    const lineNo = firstLine + idx;
    if (!raw.trim()) return;
    if (/^\S/.test(raw)) {
      inLabels = /^labels:\s*$/.test(raw);
      const version = /^planable:\s*(\d+)\s*$/.exec(raw);
      if (version && Number(version[1]) > MARKDOWN_FORMAT_VERSION) {
        doc.warnings.push(
          `Line ${lineNo}: format version ${version[1]} is newer than supported version ${MARKDOWN_FORMAT_VERSION}; importing best-effort.`,
        );
      }
      return;
    }
    if (!inLabels) return;
    const entry = /^\s+-\s+(\{.*\})\s*$/.exec(raw);
    if (!entry) {
      doc.warnings.push(`Line ${lineNo}: unrecognized label entry ignored.`);
      return;
    }
    try {
      const parsed: unknown = JSON.parse(entry[1]);
      const name =
        parsed && typeof parsed === 'object' && 'name' in parsed && typeof parsed.name === 'string'
          ? oneLine(parsed.name)
          : '';
      if (!name) throw new Error('missing name');
      const rawColor = 'color' in (parsed as object) ? (parsed as { color: unknown }).color : null;
      const color =
        typeof rawColor === 'string' && HEX_COLOR.test(rawColor) ? rawColor : DEFAULT_LABEL_COLOR;
      doc.labels.push({ name, color });
    } catch {
      doc.warnings.push(`Line ${lineNo}: invalid label entry ignored.`);
    }
  });
}

function parseDay(value: string): WeekDay | null {
  const key = value.trim().toLowerCase().slice(0, 3);
  if (key === 'unp') return 'Unplanned';
  return WEEK_DAYS.find((d) => d !== 'Unplanned' && d.toLowerCase() === key) ?? null;
}

function applyTaskMeta(
  task: MdTask,
  key: string,
  value: string,
  lineNo: number,
  warnings: string[],
): void {
  switch (key) {
    case 'labels':
      task.labels = uniqueNames([...task.labels, ...splitList(value)]);
      break;
    case 'week': {
      const [weekId, day = 'Unplanned', ...extra] = value.trim().split(/\s+/);
      const weekNo = Number(WEEK_ID.exec(weekId ?? '')?.[1]);
      const parsedDay = parseDay(day);
      if (!weekId || !(weekNo >= 1 && weekNo <= 53) || extra.length > 0) {
        warnings.push(`Line ${lineNo}: invalid week "${value}" ignored (expected e.g. 2026-W43 Tue).`);
      } else if (!parsedDay) {
        warnings.push(`Line ${lineNo}: unknown day "${day}"; scheduled as Unplanned.`);
        task.week = { weekId, day: 'Unplanned' };
      } else {
        task.week = { weekId, day: parsedDay };
      }
      break;
    }
    case 'repeat': {
      const v = value.trim().toLowerCase();
      const flag = v === 'weekly' ? true : parseBool(v);
      if (flag === null) {
        warnings.push(`Line ${lineNo}: invalid repeat "${value}" ignored (expected weekly).`);
      } else {
        task.repeat = flag;
      }
      break;
    }
    case 'completed': {
      const ms = Date.parse(value.trim());
      if (Number.isFinite(ms)) {
        task.completedDate = ms;
      } else {
        warnings.push(`Line ${lineNo}: invalid completed date "${value}" ignored.`);
      }
      break;
    }
    case 'archived': {
      const flag = parseBool(value);
      if (flag === null) {
        warnings.push(`Line ${lineNo}: invalid archived value "${value}" ignored.`);
      } else {
        task.archived = flag;
      }
      break;
    }
  }
}

function applyContainerMeta(
  container: MdContainer,
  key: string,
  value: string,
  lineNo: number,
  warnings: string[],
): void {
  if (key === 'labels') {
    container.labels = uniqueNames([...container.labels, ...splitList(value)]);
  } else if (key === 'kanban') {
    const v = value.trim().toLowerCase();
    const status = KANBAN_STATUSES.find((s) => s.toLowerCase() === v);
    if (status) {
      container.kanban = status;
    } else if (v !== 'none' && v !== '') {
      warnings.push(`Line ${lineNo}: unknown kanban status "${value}" ignored.`);
    }
  } else if (key === 'archived') {
    const flag = parseBool(value);
    if (flag === null) {
      warnings.push(`Line ${lineNo}: invalid archived value "${value}" ignored.`);
    } else {
      container.archived = flag;
    }
  }
}

const INDENTED = /^(?: {2,}|\t)/;
const TASK_META = /^(?: {2,}|\t)[-*+][ \t]+([A-Za-z]+):[ \t]*(.*?)\s*$/;
const CONTAINER_META = /^([A-Za-z]+):[ \t]*(.*?)\s*$/;

export function parseMarkdown(text: string): MdDocument {
  const lines = text.replace(/^﻿/, '').split(/\r\n|\r|\n/);
  const doc: MdDocument = { labels: [], projects: [], warnings: [] };

  let i = 0;
  if (lines[0]?.trim() === '---') {
    const end = lines.findIndex((line, idx) => idx > 0 && line.trim() === '---');
    if (end > 0) {
      parseFrontMatter(lines.slice(1, end), 2, doc);
      i = end + 1;
    }
  }

  const st = {
    project: null as MdProject | null,
    container: null as MdContainer | null,
    metaOpen: false,
    fence: null as string | null,
    ignored: 0,
    firstIgnored: 0,
  };

  const startProject = (name: string): MdProject => {
    const project: MdProject = { name, containers: [] };
    doc.projects.push(project);
    st.project = project;
    st.container = null;
    st.metaOpen = false;
    return project;
  };

  const startContainer = (name: string): MdContainer => {
    const project = st.project ?? startProject('Inbox');
    const container: MdContainer = { name, labels: [], kanban: null, archived: false, tasks: [] };
    project.containers.push(container);
    st.container = container;
    st.metaOpen = true;
    return container;
  };

  const currentContainer = (): MdContainer => {
    if (st.container) return st.container;
    if (!st.project) {
      startProject('Inbox');
      return startContainer('Inbox');
    }
    return startContainer('General');
  };

  while (i < lines.length) {
    const line = lines[i];
    const lineNo = i + 1;

    const fence = /^ {0,3}(`{3,}|~{3,})/.exec(line);
    if (st.fence) {
      if (fence && fence[1][0] === st.fence[0] && fence[1].length >= st.fence.length) {
        st.fence = null;
      }
      i += 1;
      continue;
    }
    if (fence) {
      st.fence = fence[1];
      i += 1;
      continue;
    }

    if (!line.trim() || /^\s*<!--.*-->\s*$/.test(line) || /^ {0,3}([-*_])([ \t]*\1){2,}[ \t]*$/.test(line)) {
      i += 1;
      continue;
    }

    const heading = /^ {0,3}(#{1,6})[ \t]+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      const name = heading[2].replace(/[ \t]+#+[ \t]*$/, '').trim();
      if (level > 2) {
        doc.warnings.push(`Line ${lineNo}: heading level ${level} is not used and was ignored.`);
      } else if (!name) {
        doc.warnings.push(`Line ${lineNo}: empty heading ignored.`);
      } else if (level === 1) {
        startProject(name);
      } else {
        startContainer(name);
      }
      i += 1;
      continue;
    }

    const bullet = /^ {0,3}[-*+][ \t]+(.*)$/.exec(line);
    if (bullet) {
      const rest = bullet[1];

      if (st.container && st.metaOpen) {
        const meta = CONTAINER_META.exec(rest);
        const key = meta?.[1].toLowerCase();
        if (meta && key && CONTAINER_KEYS.has(key)) {
          applyContainerMeta(st.container, key, meta[2], lineNo, doc.warnings);
          i += 1;
          continue;
        }
      }

      const checkbox = /^\[([ xX])\][ \t]+(.*\S)\s*$/.exec(rest);
      const title = (checkbox ? checkbox[2] : rest).trim();
      if (!title || /^\[[ xX]\]$/.test(title)) {
        doc.warnings.push(`Line ${lineNo}: task without a title ignored.`);
        i += 1;
        continue;
      }

      const task: MdTask = {
        title,
        description: '',
        labels: [],
        completed: !!checkbox && checkbox[1] !== ' ',
        completedDate: null,
        archived: false,
        week: null,
        repeat: false,
      };

      let j = i + 1;
      while (j < lines.length) {
        const meta = TASK_META.exec(lines[j]);
        const key = meta?.[1].toLowerCase();
        if (!meta || !key || !TASK_KEYS.has(key)) break;
        applyTaskMeta(task, key, meta[2], j + 1, doc.warnings);
        j += 1;
      }

      let last = j - 1;
      for (let k = j; k < lines.length; k += 1) {
        if (!lines[k].trim()) continue;
        if (INDENTED.test(lines[k])) last = k;
        else break;
      }
      const description = lines
        .slice(j, last + 1)
        .map((l) => (l.trim() ? l.replace(/^(?: {2}|\t)/, '') : ''));
      while (description.length > 0 && description[0] === '') description.shift();
      task.description = description.join('\n');

      currentContainer().tasks.push(task);
      st.metaOpen = false;
      i = last + 1;
      continue;
    }

    if (st.ignored === 0) st.firstIgnored = lineNo;
    st.ignored += 1;
    i += 1;
  }

  if (st.ignored > 0) {
    doc.warnings.push(
      `${st.ignored} line(s) of text outside tasks were ignored (first at line ${st.firstIgnored}).`,
    );
  }
  return doc;
}

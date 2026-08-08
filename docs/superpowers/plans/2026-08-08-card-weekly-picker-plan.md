# Hover cards, All-Containers view, Weekly tick-off, and Entity pickers — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add hover cards for tasks/containers/projects, list tasks inside All Containers, let weekly-plan tasks be ticked off with completed tasks sinking to the bottom, decouple weekly ordering from container ordering, and reuse a single picker for adding existing entities.

**Architecture:** Build one Base UI `PreviewCard` primitive (`src/components/ui/preview-card.tsx`) and one `EntityHoverCard` shell, then wire it into the existing shared task/container/project components (`TaskCard`, `ContainerColumn`, `KanbanCard`, `AllContainersView.ContainerRow`, `ProjectTab`) so the feature appears everywhere those components are used. Extend `TaskCard` with optional sortable/checkbox/extra-content props so it can also render weekly rows and All-Tasks rows, replacing the duplicated inline row implementations. Add `order` to `WeeklyTaskMembership` (Dexie schema v5) and a `reorderWeeklyTasks` repository function so weekly order can be persisted independently. Extract a generic `EntityPicker<T>` and refactor `AddToWeekPicker` and `AddToKanbanPicker` onto it.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS 4, shadcn/base-nova UI primitives (Base UI 1.7), Dexie 4, `@dnd-kit/core` + `@dnd-kit/sortable`, Vitest + `fake-indexeddb`.

## Global Constraints

- All Dexie/schema changes require a schema version bump in `src/db/db.ts`.
- Write colocated Vitest tests for new repository functions and components (`src/**/*.test.{ts,tsx}`), using `fake-indexeddb`.
- Keep components small and reusable; prefer extending existing shared components over duplicating row/list markup.
- Follow the existing relative-import style used by neighboring files.
- Record design decisions in `docs/decisions.md` (already updated for this work).

---

## File map

| File | Responsibility |
|------|----------------|
| `src/db/schema.ts` | Add optional `order` to `WeeklyTaskMembership`. |
| `src/db/db.ts` | Bump Dexie schema to v5. |
| `src/db/repositories/taskMembership.ts` | Assign weekly `order` on add/day-change; add `reorderWeeklyTasks`. |
| `src/db/repositories/taskMembership.test.ts` | Tests for weekly ordering helpers. |
| `src/lib/weeklyOrder.ts` | Pure helper that sorts weekly tasks: open by order, completed by date desc. |
| `src/lib/weeklyOrder.test.ts` | Tests for the sort helper. |
| `src/components/ui/preview-card.tsx` | Base UI `PreviewCard` wrapper styled like the rest of the UI. |
| `src/components/shared/EntityHoverCard.tsx` | Generic hover-card shell + content components for task/container/project. |
| `src/components/shared/EntityHoverCard.test.tsx` | Tests that each content variant renders expected fields. |
| `src/components/shared/EntityPicker.tsx` | Generic search-and-select dialog. |
| `src/components/shared/EntityPicker.test.tsx` | Tests for filtering and selection. |
| `src/components/projects/TaskCard.tsx` | Extend props; wrap with hover card; support non-sortable, checkbox, extra node, weekly-badge toggles. |
| `src/components/projects/TaskCard.test.tsx` | Update/extend tests for new props and hover card. |
| `src/components/projects/ContainerColumn.tsx` | Wrap container header with hover card. |
| `src/components/projects/ProjectView.tsx` | (no change unless tests fail) |
| `src/components/kanban/KanbanView.tsx` | Wrap `KanbanCard` header with hover card. |
| `src/components/kanban/AddToKanbanPicker.tsx` | Refactor onto `EntityPicker`. |
| `src/components/kanban/AddToKanbanPicker.test.tsx` | Update/keep existing behavior tests. |
| `src/components/weekly/WeeklyPlanView.tsx` | Replace `DraggableRow` with `TaskCard`; add sortable day columns; sort completed to bottom. |
| `src/components/weekly/WeeklyPlanView.test.tsx` | Add tests for tick-off, completed sorting, reordering. |
| `src/components/weekly/AddToWeekPicker.tsx` | Refactor onto `EntityPicker`. |
| `src/components/weekly/AddToWeekPicker.test.tsx` | Update/keep existing behavior tests. |
| `src/components/tasks/AllTasksView.tsx` | Use `TaskCard` instead of inline row markup. |
| `src/components/tasks/AllTasksView.test.tsx` | Update tests. |
| `src/components/containers/AllContainersView.tsx` | Add expand/collapse per row; render `SortedTaskList` when expanded. |
| `src/components/containers/AllContainersView.test.tsx` | Add expand/collapse tests. |
| `src/components/layout/ProjectTab.tsx` | Wrap project button with hover card. |

---

### Task 1: Add `order` to `WeeklyTaskMembership` and bump schema to v5

**Files:**
- Modify: `src/db/schema.ts:15-17`
- Modify: `src/db/db.ts:55-60`

**Interfaces:**
- `WeeklyTaskMembership` gains an optional numeric `order?: number` field.
- No new exported functions; consumers will read `task.weekly?.order`.

- [ ] **Step 1: Add `order` to the type**

Edit `src/db/schema.ts`:

```ts
export interface WeeklyTaskMembership extends WeeklyMembership {
  repeatWeekly: boolean;
  order?: number;
}
```

- [ ] **Step 2: Bump the Dexie version**

Append a new version block in `src/db/db.ts` after the existing `version(4)` block:

```ts
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
```

- [ ] **Step 3: Run the type checker**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/db/schema.ts src/db/db.ts
git commit -m "chore(db): add weekly.order field and bump schema to v5"
```

---

### Task 2: Repository functions for weekly ordering

**Files:**
- Modify: `src/db/repositories/taskMembership.ts`
- Create: `src/db/repositories/taskMembership.test.ts`

**Interfaces:**
- `addToWeek(taskId, weekId?)` now assigns the new task to the end of the `Unplanned` day.
- `setWeeklyDay(taskId, day)` now assigns `order` to the end of the target day when the day changes.
- New `reorderWeeklyTasks(weekId: string, day: WeekDay, orderedIds: string[]): Promise<void>` writes the `weekly.order` values for the given ids.

- [ ] **Step 1: Write the failing repository test**

Create `src/db/repositories/taskMembership.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PlanableDB } from '../db';

vi.mock('../db', async () => {
  const { PlanableDB } = await vi.importActual<typeof import('../db')>('../db');
  return { db: new PlanableDB(`test-membership-${Math.random()}`) };
});

import { createTask } from './tasks';
import { addToWeek, setWeeklyDay, reorderWeeklyTasks } from './taskMembership';
import { INBOX_PROJECT_ID, INBOX_CONTAINER_ID } from '../inbox';
import { getCurrentWeekId } from '../../lib/week';

describe('taskMembership weekly ordering', () => {
  let db: PlanableDB;

  beforeEach(async () => {
    const { db: mockDb } = await import('../db');
    db = mockDb;
    await db.delete();
    await db.open();
  });

  it('assigns order=0 when adding the first task to a week', async () => {
    const task = await createTask({ title: 'A', projectId: INBOX_PROJECT_ID, containerId: INBOX_CONTAINER_ID });
    await addToWeek(task.id, getCurrentWeekId());
    const updated = await db.tasks.get(task.id);
    expect(updated?.weekly?.order).toBe(0);
  });

  it('appends the next task at the end of Unplanned', async () => {
    const a = await createTask({ title: 'A', projectId: INBOX_PROJECT_ID, containerId: INBOX_CONTAINER_ID });
    const b = await createTask({ title: 'B', projectId: INBOX_PROJECT_ID, containerId: INBOX_CONTAINER_ID });
    await addToWeek(a.id, getCurrentWeekId());
    await addToWeek(b.id, getCurrentWeekId());
    const updated = await db.tasks.get(b.id);
    expect(updated?.weekly?.order).toBe(1);
  });

  it('assigns order at the end of the target day when moving days', async () => {
    const task = await createTask({ title: 'A', projectId: INBOX_PROJECT_ID, containerId: INBOX_CONTAINER_ID });
    await addToWeek(task.id, getCurrentWeekId());
    await setWeeklyDay(task.id, 'Mon');
    const first = await db.tasks.get(task.id);
    expect(first?.weekly?.day).toBe('Mon');
    expect(first?.weekly?.order).toBe(0);

    const other = await createTask({ title: 'B', projectId: INBOX_PROJECT_ID, containerId: INBOX_CONTAINER_ID });
    await addToWeek(other.id, getCurrentWeekId());
    await setWeeklyDay(other.id, 'Mon');
    const second = await db.tasks.get(other.id);
    expect(second?.weekly?.order).toBe(1);
  });

  it('reorders tasks within a day', async () => {
    const a = await createTask({ title: 'A', projectId: INBOX_PROJECT_ID, containerId: INBOX_CONTAINER_ID });
    const b = await createTask({ title: 'B', projectId: INBOX_PROJECT_ID, containerId: INBOX_CONTAINER_ID });
    const week = getCurrentWeekId();
    await addToWeek(a.id, week);
    await addToWeek(b.id, week);
    await reorderWeeklyTasks(week, 'Unplanned', [b.id, a.id]);
    const tasks = await db.tasks.where('weekly.weekId').equals(week).toArray();
    const byId = new Map(tasks.map((t) => [t.id, t]));
    expect(byId.get(b.id)?.weekly?.order).toBe(0);
    expect(byId.get(a.id)?.weekly?.order).toBe(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/db/repositories/taskMembership.test.ts`
Expected: FAIL — `order` not set and `reorderWeeklyTasks` not defined.

- [ ] **Step 3: Implement repository changes**

Edit `src/db/repositories/taskMembership.ts`:

```ts
import { db } from '../db';
import type { Task, WeekDay } from '../schema';
import { getActiveWeekId } from '../../lib/activeWeek';
import { deleteWeekTemplate, upsertWeekTemplate } from './weekTemplates';

async function nextWeeklyOrder(weekId: string, day: WeekDay): Promise<number> {
  const tasks = await db.tasks
    .where('weekly.weekId')
    .equals(weekId)
    .and((t) => t.weekly?.day === day)
    .toArray();
  const max = tasks.reduce((m, t) => Math.max(m, t.weekly?.order ?? -1), -1);
  return max + 1;
}

export async function addToWeek(taskId: string, weekId?: string): Promise<void> {
  const targetWeek = weekId ?? (await getActiveWeekId());
  const order = await nextWeeklyOrder(targetWeek, 'Unplanned');
  await db.tasks.update(taskId, {
    weekly: { weekId: targetWeek, day: 'Unplanned', repeatWeekly: false, order },
  });
}

export async function setWeeklyDay(taskId: string, day: WeekDay): Promise<void> {
  const task = await db.tasks.get(taskId);
  if (!task?.weekly) return;
  if (task.weekly.day === day) return;
  const order = await nextWeeklyOrder(task.weekly.weekId, day);
  await db.tasks.update(taskId, { weekly: { ...task.weekly, day, order } });
}

export async function reorderWeeklyTasks(
  weekId: string,
  day: WeekDay,
  orderedIds: string[],
): Promise<void> {
  await db.transaction('rw', db.tasks, async () => {
    await Promise.all(
      orderedIds.map(async (id, index) => {
        const task = await db.tasks.get(id);
        if (!task?.weekly || task.weekly.weekId !== weekId || task.weekly.day !== day) return;
        await db.tasks.update(id, { weekly: { ...task.weekly, order: index } });
      }),
    );
  });
}
```

Keep the existing `setTaskArchived` and `setTaskRepeatWeekly` functions unchanged.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/db/repositories/taskMembership.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/db/repositories/taskMembership.ts src/db/repositories/taskMembership.test.ts
git commit -m "feat(db): assign and reorder weekly task order"
```

---

### Task 3: Pure helper to sort weekly tasks

**Files:**
- Create: `src/lib/weeklyOrder.ts`
- Create: `src/lib/weeklyOrder.test.ts`

**Interfaces:**
- `sortWeeklyTasks(tasks: Task[]): Task[]` returns a new array: open tasks first (sorted by `weekly.order` asc, falling back to id for stability), then completed tasks (sorted by `completedDate` desc).

- [ ] **Step 1: Write the failing test**

Create `src/lib/weeklyOrder.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { sortWeeklyTasks } from './weeklyOrder';
import type { Task } from '../db/schema';

function task(id: string, overrides: Partial<Task> = {}): Task {
  return {
    id,
    title: id,
    description: '',
    labels: [],
    projectId: 'p',
    containerId: 'c',
    order: 0,
    completed: false,
    completedDate: null,
    archived: false,
    weekly: { weekId: '2026-W32', day: 'Mon', repeatWeekly: false, order: 0 },
    ...overrides,
  };
}

describe('sortWeeklyTasks', () => {
  it('places open tasks before completed tasks', () => {
    const completed = task('done', { completed: true, completedDate: 1, weekly: { weekId: 'w', day: 'Mon', repeatWeekly: false, order: 0 } });
    const open = task('open', { completed: false, weekly: { weekId: 'w', day: 'Mon', repeatWeekly: false, order: 5 } });
    expect(sortWeeklyTasks([completed, open]).map((t) => t.id)).toEqual(['open', 'done']);
  });

  it('sorts open tasks by weekly.order', () => {
    const a = task('a', { weekly: { weekId: 'w', day: 'Mon', repeatWeekly: false, order: 2 } });
    const b = task('b', { weekly: { weekId: 'w', day: 'Mon', repeatWeekly: false, order: 1 } });
    expect(sortWeeklyTasks([a, b]).map((t) => t.id)).toEqual(['b', 'a']);
  });

  it('sorts completed tasks by completedDate descending', () => {
    const old = task('old', { completed: true, completedDate: 100, weekly: { weekId: 'w', day: 'Mon', repeatWeekly: false, order: 0 } });
    const recent = task('recent', { completed: true, completedDate: 500, weekly: { weekId: 'w', day: 'Mon', repeatWeekly: false, order: 0 } });
    expect(sortWeeklyTasks([old, recent]).map((t) => t.id)).toEqual(['recent', 'old']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/weeklyOrder.test.ts`
Expected: FAIL — `sortWeeklyTasks` not defined.

- [ ] **Step 3: Implement the helper**

Create `src/lib/weeklyOrder.ts`:

```ts
import type { Task } from '../db/schema';

export function sortWeeklyTasks(tasks: Task[]): Task[] {
  const open: Task[] = [];
  const completed: Task[] = [];
  for (const t of tasks) {
    if (t.completed) completed.push(t);
    else open.push(t);
  }
  open.sort((a, b) => {
    const ao = a.weekly?.order ?? Number.MAX_SAFE_INTEGER;
    const bo = b.weekly?.order ?? Number.MAX_SAFE_INTEGER;
    if (ao !== bo) return ao - bo;
    return a.id.localeCompare(b.id);
  });
  completed.sort((a, b) => {
    const ad = a.completedDate ?? 0;
    const bd = b.completedDate ?? 0;
    if (bd !== ad) return bd - ad;
    return a.id.localeCompare(b.id);
  });
  return [...open, ...completed];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/weeklyOrder.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/weeklyOrder.ts src/lib/weeklyOrder.test.ts
git commit -m "feat(lib): add weekly task sort helper"
```

---

### Task 4: Base UI PreviewCard wrapper

**Files:**
- Create: `src/components/ui/preview-card.tsx`

**Interfaces:**
- Re-export named parts of `PreviewCard` as `PreviewCard.Root`, `PreviewCard.Trigger`, etc., with Tailwind styling on `Popup`.

- [ ] **Step 1: Create the wrapper**

Create `src/components/ui/preview-card.tsx`:

```tsx
import * as React from 'react';
import { PreviewCard as PreviewCardPrimitive } from '@base-ui/react/preview-card';
import { cn } from '@/lib/utils';

function PreviewCardRoot({ ...props }: PreviewCardPrimitive.Root.Props) {
  return <PreviewCardPrimitive.Root data-slot="preview-card" {...props} />;
}

function PreviewCardTrigger({ ...props }: PreviewCardPrimitive.Trigger.Props) {
  return <PreviewCardPrimitive.Trigger data-slot="preview-card-trigger" {...props} />;
}

function PreviewCardPortal({ ...props }: PreviewCardPrimitive.Portal.Props) {
  return <PreviewCardPrimitive.Portal data-slot="preview-card-portal" {...props} />;
}

function PreviewCardPositioner({
  className,
  ...props
}: PreviewCardPrimitive.Positioner.Props) {
  return (
    <PreviewCardPrimitive.Positioner
      data-slot="preview-card-positioner"
      className={cn('z-50', className)}
      {...props}
    />
  );
}

function PreviewCardPopup({ className, ...props }: PreviewCardPrimitive.Popup.Props) {
  return (
    <PreviewCardPrimitive.Popup
      data-slot="preview-card-popup"
      className={cn(
        'max-w-xs rounded-xl border border-border bg-popover p-3 text-sm text-popover-foreground shadow-lg ring-1 ring-foreground/10 data-[open]:animate-in data-[open]:fade-in-0 data-[open]:zoom-in-95 data-[closed]:animate-out data-[closed]:fade-out-0 data-[closed]:zoom-out-95',
        className,
      )}
      {...props}
    />
  );
}

function PreviewCardArrow({ className, ...props }: PreviewCardPrimitive.Arrow.Props) {
  return (
    <PreviewCardPrimitive.Arrow
      data-slot="preview-card-arrow"
      className={cn('bg-popover', className)}
      {...props}
    />
  );
}

export const PreviewCard = {
  Root: PreviewCardRoot,
  Trigger: PreviewCardTrigger,
  Portal: PreviewCardPortal,
  Positioner: PreviewCardPositioner,
  Popup: PreviewCardPopup,
  Arrow: PreviewCardArrow,
};
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/preview-card.tsx
git commit -m "feat(ui): add preview-card primitive wrapper"
```

---

### Task 5: Entity hover-card shell and content variants

**Files:**
- Create: `src/components/shared/EntityHoverCard.tsx`
- Create: `src/components/shared/EntityHoverCard.test.tsx`

**Interfaces:**
- `EntityHoverCard({ children, content, align? })` — wraps `children` in the hover trigger and renders `content` in the popup.
- `TaskHoverCardContent({ task, containerById, projectById, labelsById })`.
- `ContainerHoverCardContent({ container, projectById, labelsById, taskCount })`.
- `ProjectHoverCardContent({ project, labelsById, containerCount, taskCount })`.

- [ ] **Step 1: Write the failing component test**

Create `src/components/shared/EntityHoverCard.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import {
  EntityHoverCard,
  TaskHoverCardContent,
  ContainerHoverCardContent,
  ProjectHoverCardContent,
} from './EntityHoverCard';
import type { Task, Container, Project, Label } from '../../db/schema';

const labelsById = new Map<string, Label>([['l1', { id: 'l1', name: 'Security', color: '#f00' }]]);
const task: Task = {
  id: 't1',
  title: 'Hover task',
  description: 'Details here',
  labels: ['l1'],
  projectId: 'p1',
  containerId: 'c1',
  order: 0,
  completed: false,
  completedDate: null,
  archived: false,
  weekly: { weekId: 'w', day: 'Tue', repeatWeekly: false, order: 0 },
};
const container: Container = {
  id: 'c1',
  projectId: 'p1',
  name: 'Backlog',
  order: 0,
  labels: ['l1'],
  archived: false,
  kanban: null,
};
const project: Project = { id: 'p1', name: 'Alpha', order: 0 };
const projectById = new Map([['p1', project]]);
const containerById = new Map([['c1', container]]);

describe('EntityHoverCard content', () => {
  it('renders task hover content', () => {
    render(
      <TaskHoverCardContent
        task={task}
        containerById={containerById}
        projectById={projectById}
        labelsById={labelsById}
      />,
    );
    expect(screen.getByText('Hover task')).toBeInTheDocument();
    expect(screen.getByText('Alpha › Backlog')).toBeInTheDocument();
    expect(screen.getByText('Security')).toBeInTheDocument();
  });

  it('renders container hover content', () => {
    render(
      <ContainerHoverCardContent
        container={container}
        projectById={projectById}
        labelsById={labelsById}
        taskCount={7}
      />,
    );
    expect(screen.getByText('Backlog')).toBeInTheDocument();
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('7 tasks')).toBeInTheDocument();
  });

  it('renders project hover content', () => {
    render(
      <ProjectHoverCardContent
        project={project}
        labelsById={labelsById}
        containerCount={3}
        taskCount={12}
      />,
    );
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('3 containers')).toBeInTheDocument();
    expect(screen.getByText('12 tasks')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/shared/EntityHoverCard.test.tsx`
Expected: FAIL — components do not exist.

- [ ] **Step 3: Implement the component**

Create `src/components/shared/EntityHoverCard.tsx`:

```tsx
import type { ReactNode } from 'react';
import { PreviewCard } from '../ui/preview-card';
import type { Task, Container, Project, Label } from '../../db/schema';
import { Badge } from '../ui/badge';
import { EntityLabels } from './EntityLabels';

export function EntityHoverCard({
  children,
  content,
  align = 'start',
}: {
  children: ReactNode;
  content: ReactNode;
  align?: 'start' | 'center' | 'end';
}) {
  return (
    <PreviewCard.Root>
      <PreviewCard.Trigger
        render={<div className="contents" />}
        delay={300}
        closeDelay={150}
      >
        {children}
      </PreviewCard.Trigger>
      <PreviewCard.Portal>
        <PreviewCard.Positioner align={align} side="top" sideOffset={8}>
          <PreviewCard.Popup>
            <PreviewCard.Arrow />
            {content}
          </PreviewCard.Popup>
        </PreviewCard.Positioner>
      </PreviewCard.Portal>
    </PreviewCard.Root>
  );
}

function plainTextExcerpt(markdown: string, maxLen = 200): string {
  const text = markdown.replace(/[#*_`\[\]\(\)]/g, '').replace(/\s+/g, ' ').trim();
  return text.length > maxLen ? text.slice(0, maxLen) + '…' : text;
}

export function TaskHoverCardContent({
  task,
  containerById,
  projectById,
  labelsById,
}: {
  task: Task;
  containerById: Map<string, Container>;
  projectById: Map<string, Project>;
  labelsById: Map<string, Label>;
}) {
  const container = containerById.get(task.containerId);
  const project = projectById.get(task.projectId);
  const path = [project?.name, container?.name].filter(Boolean).join(' › ');
  return (
    <div className="flex flex-col gap-1.5">
      <div className="font-medium text-foreground">{task.title}</div>
      {path && <div className="text-xs text-muted-foreground">{path}</div>}
      <EntityLabels labelIds={task.labels} labelsById={labelsById} />
      {task.weekly && (
        <Badge variant="secondary" className="w-fit">
          {task.weekly.repeatWeekly ? 'Repeats weekly' : `Week: ${task.weekly.day}`}
        </Badge>
      )}
      {container?.kanban && (
        <Badge variant="outline" className="w-fit">Kanban: {container.kanban.status}</Badge>
      )}
      {task.description && (
        <p className="text-xs text-muted-foreground">{plainTextExcerpt(task.description)}</p>
      )}
      {task.completed && <div className="text-xs text-muted-foreground">Completed</div>}
    </div>
  );
}

export function ContainerHoverCardContent({
  container,
  projectById,
  labelsById,
  taskCount,
}: {
  container: Container;
  projectById: Map<string, Project>;
  labelsById: Map<string, Label>;
  taskCount: number;
}) {
  const project = projectById.get(container.projectId);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="font-medium text-foreground">{container.name}</div>
      {project && <div className="text-xs text-muted-foreground">{project.name}</div>}
      <EntityLabels labelIds={container.labels} labelsById={labelsById} />
      {container.kanban && <Badge variant="secondary">Kanban: {container.kanban.status}</Badge>}
      <div className="text-xs text-muted-foreground">
        {taskCount} {taskCount === 1 ? 'task' : 'tasks'}
      </div>
    </div>
  );
}

export function ProjectHoverCardContent({
  project,
  labelsById,
  containerCount,
  taskCount,
}: {
  project: Project;
  labelsById: Map<string, Label>;
  containerCount: number;
  taskCount: number;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="font-medium text-foreground">{project.name}</div>
      <div className="text-xs text-muted-foreground">
        {containerCount} {containerCount === 1 ? 'container' : 'containers'} · {taskCount} {taskCount === 1 ? 'task' : 'tasks'}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/shared/EntityHoverCard.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/shared/EntityHoverCard.tsx src/components/shared/EntityHoverCard.test.tsx
git commit -m "feat(shared): add EntityHoverCard and content variants"
```

---

### Task 6: Wire hover cards into shared components

**Files:**
- Modify: `src/components/projects/TaskCard.tsx`
- Modify: `src/components/projects/ContainerColumn.tsx`
- Modify: `src/components/kanban/KanbanView.tsx`
- Modify: `src/components/containers/AllContainersView.tsx`
- Modify: `src/components/layout/ProjectTab.tsx`

**Interfaces:**
- Each shared component receives the same lookup maps it already has access to, plus a `containerById` map where needed.

- [ ] **Step 1: Update `TaskCard` to wrap itself with the hover card**

Edit `src/components/projects/TaskCard.tsx`:

- Add imports:

```ts
import { useMemo } from 'react';
import { EntityHoverCard, TaskHoverCardContent } from '../shared/EntityHoverCard';
import type { Container, Project } from '../../db/schema';
```

- Change props to accept `containerById` and `projectById`:

```ts
export function TaskCard({
  task,
  labelsById,
  containerById,
  projectById,
}: {
  task: Task;
  labelsById: Map<string, Label>;
  containerById?: Map<string, Container>;
  projectById?: Map<string, Project>;
}) {
```

- Wrap the outer `div` with `EntityHoverCard`:

```tsx
const hoverContent = useMemo(
  () => (
    <TaskHoverCardContent
      task={task}
      containerById={containerById ?? new Map()}
      projectById={projectById ?? new Map()}
      labelsById={labelsById}
    />
  ),
  [task, containerById, projectById, labelsById],
);

return (
  <>
    <EntityHoverCard content={hoverContent}>
      <div ...existing div props...>
        ...existing content...
      </div>
    </EntityHoverCard>
    ...dialog...
  </>
);
```

- Type-check.

- [ ] **Step 2: Update call sites to pass `containerById`/`projectById`**

In `src/components/shared/SortedTaskList.tsx`, `ProjectView.tsx`, `ContainerColumn.tsx`, `KanbanView.tsx`, and `AllContainersView.tsx`, pass `containerById` and `projectById` to `TaskCard`.

For `SortedTaskList`, add props:

```ts
export function SortedTaskList({
  containerId,
  labelsById,
  containerById,
  projectById,
}: {
  containerId: string;
  labelsById: Map<string, Label>;
  containerById?: Map<string, Container>;
  projectById?: Map<string, Project>;
}) {
```

and render `<TaskCard task={task} labelsById={labelsById} containerById={containerById} projectById={projectById} />`.

- [ ] **Step 3: Wrap container headers with `ContainerHoverCardContent`**

In `src/components/projects/ContainerColumn.tsx`, import `EntityHoverCard` and `ContainerHoverCardContent`. Wrap the header div (the one with `onDoubleClick`) with `EntityHoverCard` and pass the popup content. `taskCount` is already available via live query.

Do the same in `src/components/kanban/KanbanView.tsx` for `KanbanCard`.

In `src/components/containers/AllContainersView.tsx`, wrap the inner `ContainerRow` title block with `EntityHoverCard`; `taskCount` is already passed to `ContainerRow`.

- [ ] **Step 4: Wrap `ProjectTab` with `ProjectHoverCardContent`**

In `src/components/layout/ProjectTab.tsx`, import `EntityHoverCard` and `ProjectHoverCardContent`. Wrap the project-button area with `EntityHoverCard`. `ProjectTab` only has the project; counts must be fetched via `useLiveQuery`:

```ts
const taskCount = useLiveQuery(() => db.tasks.where('projectId').equals(project.id).count(), [project.id], 0);
const containerCount = useLiveQuery(() => db.containers.where('projectId').equals(project.id).count(), [project.id], 0);
```

Wrap the rendered `Button`/input in `EntityHoverCard` with `ProjectHoverCardContent`.

- [ ] **Step 5: Run all existing component tests**

Run: `npx vitest run src/components/projects/TaskCard.test.tsx src/components/projects/ContainerColumn.test.tsx src/components/kanban/KanbanView.test.tsx src/components/containers/AllContainersView.test.tsx src/components/layout/NavTabs.test.tsx`
Expected: PASS (or update tests if prop changes broke them).

- [ ] **Step 6: Commit**

```bash
git add src/components/projects/TaskCard.tsx src/components/shared/SortedTaskList.tsx src/components/projects/ContainerColumn.tsx src/components/kanban/KanbanView.tsx src/components/containers/AllContainersView.tsx src/components/layout/ProjectTab.tsx
git commit -m "feat(ui): wire EntityHoverCard into shared task/container/project components"
```

---

### Task 7: Extend `TaskCard` for reuse in weekly plan and All Tasks

**Files:**
- Modify: `src/components/projects/TaskCard.tsx`
- Modify: `src/components/shared/SortedTaskList.tsx`
- Modify: `src/components/tasks/AllTasksView.tsx`
- Modify: `src/components/projects/TaskCard.test.tsx`

**Interfaces:**
- `TaskCard` props:
  ```ts
  task: Task;
  labelsById: Map<string, Label>;
  containerById?: Map<string, Container>;
  projectById?: Map<string, Project>;
  sortableId?: string | null; // null disables sortable
  showCheckbox?: boolean;
  showWeeklyBadge?: boolean;
  showAddToWeek?: boolean;
  extra?: ReactNode;
  className?: string;
  onEdit?: (task: Task) => void; // overrides the default self-contained edit dialog
  ```

- [ ] **Step 1: Write the failing test for new props**

Append to `src/components/projects/TaskCard.test.tsx`:

```ts
describe('TaskCard variants', () => {
  it('renders extra content when provided', () => {
    render(
      <TaskCard
        task={{ ...baseTask, labels: [], weekly: null }}
        labelsById={new Map()}
        extra={<span data-testid="extra">Alpha</span>}
      />,
    );
    expect(screen.getByTestId('extra')).toBeInTheDocument();
  });

  it('hides the checkbox when showCheckbox=false', () => {
    render(<TaskCard task={{ ...baseTask, labels: [], weekly: null }} labelsById={new Map()} showCheckbox={false} />);
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('does not crash outside a SortableContext when sortableId is null', () => {
    render(
      <TaskCard
        task={{ ...baseTask, labels: [], weekly: null }}
        labelsById={new Map()}
        sortableId={null}
      />,
    );
    expect(screen.getByText('Badged task')).toBeInTheDocument();
  });
});
```

Run: `npx vitest run src/components/projects/TaskCard.test.tsx`
Expected: FAIL — props not supported.

- [ ] **Step 2: Implement TaskCard variants**

Edit `src/components/projects/TaskCard.tsx`:

```tsx
import { useState, type ReactNode } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { GripVertical } from 'lucide-react';
import { setTaskCompleted } from '../../db/repositories/tasks';
import { addToWeek } from '../../db/repositories/taskMembership';
import { fireAndForget } from '../../lib/fireAndForget';
import type { Task, Label, Container, Project } from '../../db/schema';
import { Checkbox } from '../../components/ui/checkbox';
import { Badge } from '../../components/ui/badge';
import { CalendarPlus } from 'lucide-react';
import { TaskDialog } from './TaskDialog';
import { EntityLabels } from '../shared/EntityLabels';
import { EntityHoverCard, TaskHoverCardContent } from '../shared/EntityHoverCard';

export function TaskCard({
  task,
  labelsById,
  containerById,
  projectById,
  sortableId = task.id,
  showCheckbox = true,
  showWeeklyBadge = true,
  showAddToWeek = true,
  extra,
  className,
  onEdit,
}: {
  task: Task;
  labelsById: Map<string, Label>;
  containerById?: Map<string, Container>;
  projectById?: Map<string, Project>;
  sortableId?: string | null;
  showCheckbox?: boolean;
  showWeeklyBadge?: boolean;
  showAddToWeek?: boolean;
  extra?: ReactNode;
  className?: string;
  onEdit?: (task: Task) => void;
}) {
  const [editing, setEditing] = useState(false);
  const sortable = useSortable({
    id: sortableId ?? '__disabled__',
    disabled: sortableId === null,
  });
  const { setNodeRef, setActivatorNodeRef, listeners, attributes, transform, isDragging } = sortable;

  return (
    <>
      <EntityHoverCard
        content={
          <TaskHoverCardContent
            task={task}
            containerById={containerById ?? new Map()}
            projectById={projectById ?? new Map()}
            labelsById={labelsById}
          />
        }
      >
        <div
          ref={setNodeRef}
          data-dnd-draggable
          style={{ transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined }}
          onDoubleClick={() => (onEdit ? onEdit(task) : setEditing(true))}
          className={`group flex items-center gap-2 rounded-lg border border-border/70 bg-background/70 px-2.5 py-2 shadow-sm hover:border-input hover:bg-background hover:shadow-md ${
            isDragging ? 'opacity-50' : ''
          } ${className ?? ''}`}
        >
          {showCheckbox && (
            <Checkbox
              checked={task.completed}
              aria-label={`Toggle completed for ${task.title}`}
              onCheckedChange={(checked) => fireAndForget(setTaskCompleted(task.id, checked))}
              onClick={(e) => e.stopPropagation()}
            />
          )}
          <button
            className={`min-w-0 flex-1 truncate text-left text-sm ${
              task.completed ? 'text-muted-foreground line-through' : 'text-foreground'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {task.title}
          </button>
          <EntityLabels labelIds={task.labels} labelsById={labelsById} />
          {extra}
          {showWeeklyBadge && task.weekly && (
            <Badge variant="secondary" className="shrink-0">
              {task.weekly.repeatWeekly ? 'Repeats weekly' : `Week: ${task.weekly.day}`}
            </Badge>
          )}
          <span className="flex shrink-0 items-center gap-0.5">
            {showAddToWeek && !task.weekly && (
              <button
                className="rounded px-1.5 py-1 text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 hover:bg-muted hover:text-foreground"
                title="Add to this week"
                onClick={(e) => {
                  e.stopPropagation();
                  fireAndForget(addToWeek(task.id));
                }}
              >
                <CalendarPlus className="h-3.5 w-3.5" />
              </button>
            )}
            {sortableId !== null && (
              <button
                ref={setActivatorNodeRef}
                aria-label={`Drag ${task.title}`}
                className="shrink-0 cursor-grab touch-none text-muted-foreground/60 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 hover:text-muted-foreground active:cursor-grabbing"
                {...listeners}
                {...attributes}
                onClick={(e) => e.stopPropagation()}
              >
                <GripVertical className="h-4 w-4" />
              </button>
            )}
          </span>
        </div>
      </EntityHoverCard>
      {editing && (
        <TaskDialog
          mode="edit"
          projectId={task.projectId}
          containerId={task.containerId}
          task={task}
          onClose={() => setEditing(false)}
        />
      )}
    </>
  );
}
```

- [ ] **Step 3: Update `SortedTaskList` to pass maps**

Edit `src/components/shared/SortedTaskList.tsx` to accept and forward `containerById` and `projectById` to `TaskCard`.

- [ ] **Step 4: Refactor `AllTasksView` to use `TaskCard`**

Edit `src/components/tasks/AllTasksView.tsx`:

```tsx
import { TaskCard } from '../projects/TaskCard';

// inside visibleTasks.map:
<li key={task.id}>
  <TaskCard
    task={task}
    labelsById={labelsById}
    projectById={projectById}
    containerById={containerById}
    sortableId={null}
    showAddToWeek={false}
    extra={
      projectById.get(task.projectId) && (
        <span className="shrink-0 text-xs text-muted-foreground">
          {projectById.get(task.projectId)!.name}
        </span>
      )
    }
  />
</li>
```

Remove the now-unused `Checkbox` and `Badge` imports from `AllTasksView.tsx` if no longer used.

- [ ] **Step 5: Run tests**

Run: `npx vitest run src/components/projects/TaskCard.test.tsx src/components/tasks/AllTasksView.test.tsx src/components/shared/SortedTaskList.tsx` (only test files exist for first two).
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/projects/TaskCard.tsx src/components/projects/TaskCard.test.tsx src/components/shared/SortedTaskList.tsx src/components/tasks/AllTasksView.tsx
git commit -m "feat(shared): make TaskCard reusable for weekly and all-tasks views"
```

---

### Task 8: Weekly plan tick-off, sortable day columns, and completed-at-bottom

**Files:**
- Modify: `src/components/weekly/WeeklyPlanView.tsx`
- Modify: `src/components/weekly/WeeklyPlanView.test.tsx`

**Interfaces:**
- `WeeklyDayColumn` renders `TaskCard` inside a `SortableContext`.
- `handleDragEnd` handles:
  - over id `t:<day>` → `setWeeklyDay(taskId, day)`.
  - over id is a task id (no prefix) → `reorderWeeklyTasks(current day, orderedIds)`.
- Entries are sorted with `sortWeeklyTasks`.

- [ ] **Step 1: Add a test for tick-off and completed ordering**

Append to `src/components/weekly/WeeklyPlanView.test.tsx`:

```ts
import { setTaskCompleted } from '../../db/repositories/tasks';

describe('WeeklyPlanView tick-off', () => {
  it('ticks off a task and moves it to the bottom of the day column', async () => {
    const open = await createTask({ title: 'Open', projectId: INBOX_PROJECT_ID, containerId: INBOX_CONTAINER_ID });
    const done = await createTask({ title: 'Done', projectId: INBOX_PROJECT_ID, containerId: INBOX_CONTAINER_ID });
    await addToWeek(open.id, getCurrentWeekId());
    await addToWeek(done.id, getCurrentWeekId());
    await setWeeklyDay(open.id, 'Mon');
    await setWeeklyDay(done.id, 'Mon');
    await setTaskCompleted(done.id, true);

    render(<WeeklyPlanView />);
    const monSection = (await screen.findByText('Mon')).closest('section')!;
    const rows = within(monSection).getAllByRole('button', { name: /^(Open|Done)$/ });
    expect(rows[0]).toHaveTextContent('Open');
    expect(rows[1]).toHaveTextContent('Done');
  });
});
```

Run: `npx vitest run src/components/weekly/WeeklyPlanView.test.tsx`
Expected: FAIL — weekly rows are not `TaskCard` yet.

- [ ] **Step 2: Implement sortable weekly columns**

Edit `src/components/weekly/WeeklyPlanView.tsx`:

- Add imports:

```ts
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { TaskCard } from '../projects/TaskCard';
import { sortWeeklyTasks } from '../../lib/weeklyOrder';
import { reorderWeeklyTasks } from '../../db/repositories/taskMembership';
```

- Delete the `DraggableRow` component.

- Update `WeeklyDayColumn`:

```tsx
function WeeklyDayColumn({
  day,
  entries,
  labelsById,
  containerById,
  projectById,
  onQuickAdd,
  onEdit,
}: {
  day: WeekDay;
  entries: Task[];
  labelsById: Map<string, Label>;
  containerById: Map<string, Container>;
  projectById: Map<string, Project>;
  onQuickAdd: (title: string) => Promise<void>;
  onEdit: (task: Task) => void;
}) {
  // onEdit is passed down to TaskCard, which opens WeeklyPlanView's managed
  // TaskDialog (via its onEdit prop) instead of its own.
  const { setNodeRef } = useDroppable({ id: `t:${day}` });
  const sorted = sortWeeklyTasks(entries);
  const ids = sorted.map((t) => t.id);

  return (
    <section
      ref={setNodeRef}
      data-dnd-droppable
      className="flex w-52 shrink-0 flex-col rounded-xl border border-border bg-card shadow-sm"
    >
      <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          <span className={DAY_ACCENT[day]}>
            <span className="block size-2 shrink-0 rounded-full bg-current" />
          </span>
          <h3 className="text-sm font-semibold">{day}</h3>
        </div>
        <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground tabular-nums">
          {entries.length}
        </span>
      </div>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ul className="flex flex-col gap-1.5 p-2">
          {sorted.map((task) => (
            <li key={task.id}>
              <TaskCard
                task={task}
                labelsById={labelsById}
                containerById={containerById}
                projectById={projectById}
                showWeeklyBadge={false}
                showAddToWeek={false}
                className={task.completed ? 'opacity-70' : ''}
                onEdit={onEdit}
              />
            </li>
          ))}
        </ul>
      </SortableContext>
      <div className="p-2 pt-0">
        <QuickAddRow onAdd={onQuickAdd} />
      </div>
    </section>
  );
}
```

TaskCard already exposes `onEdit?: (task: Task) => void` (added in Task 7). When provided, `onDoubleClick` calls it instead of opening the self-contained `TaskDialog`. Add the `onEdit` prop to the `WeeklyDayColumn` signature (below) so weekly rows route editing through `WeeklyPlanView`'s parent-managed `TaskDialog`.

- Update `handleDragEnd` in `WeeklyPlanView`:

```tsx
function handleDragEnd(event: DragEndEvent) {
  const { active, over } = event;
  if (!over) return;
  const activeId = String(active.id);
  const overId = String(over.id);

  if (overId.startsWith('t:')) {
    fireAndForget(setWeeklyDay(activeId, overId.slice(2) as WeekDay));
    return;
  }

  const task = visibleTasks.find((t) => t.id === activeId);
  if (!task?.weekly) return;
  const day = task.weekly.day;
  const dayTasks = sortWeeklyTasks(visibleTasks.filter((t) => t.weekly?.day === day));
  const oldIndex = dayTasks.findIndex((t) => t.id === activeId);
  const newIndex = dayTasks.findIndex((t) => t.id === overId);
  if (oldIndex < 0 || newIndex < 0) return;
  const next = arrayMove(dayTasks, oldIndex, newIndex).map((t) => t.id);
  fireAndForget(reorderWeeklyTasks(weekId, day, next));
}
```

- Pass `containerById` and `projectById` to `WeeklyDayColumn` from `WeeklyPlanView`.

- [ ] **Step 3: Add `onEdit` prop to `TaskCard` if not already present**

Edit `src/components/projects/TaskCard.tsx` to add `onEdit?: (task: Task) => void` and use it in `onDoubleClick`.

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/components/weekly/WeeklyPlanView.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/weekly/WeeklyPlanView.tsx src/components/weekly/WeeklyPlanView.test.tsx src/components/projects/TaskCard.tsx
git commit -m "feat(weekly): tick-off tasks, sort completed to bottom, add intra-day reordering"
```

---

### Task 9: All Containers view lists tasks inside containers

**Files:**
- Modify: `src/components/containers/AllContainersView.tsx`
- Modify: `src/components/containers/AllContainersView.test.tsx`

**Interfaces:**
- Each `ContainerRow` has an expand/collapse toggle (default collapsed).
- When expanded, render `SortedTaskList` for that container.

- [ ] **Step 1: Add a test for expanding a row**

Append to `src/components/containers/AllContainersView.test.tsx`:

```ts
import { createTask } from '../../db/repositories/tasks';

describe('AllContainersView task lists', () => {
  it('shows a container\'s tasks after expanding the row', async () => {
    const project = await createProject('Alpha');
    const container = await createContainer(project.id, 'Backlog');
    await createTask({ title: 'Child', projectId: project.id, containerId: container.id });

    render(<AllContainersView />);
    const row = (await screen.findByText('Backlog')).closest('li')!;
    await userEvent.click(within(row).getByRole('button', { name: /expand/i }));
    expect(await within(row).findByText('Child')).toBeInTheDocument();
  });
});
```

Run: `npx vitest run src/components/containers/AllContainersView.test.tsx`
Expected: FAIL — no expand button.

- [ ] **Step 2: Implement expand/collapse and task list**

Edit `src/components/containers/AllContainersView.tsx`:

- Import `ChevronRight`, `ChevronDown` from `lucide-react`.
- Add `expanded` state to `ContainerRow`:

```tsx
const [expanded, setExpanded] = useState(false);
```

- Add expand toggle button next to the container name. Render `SortedTaskList` when expanded.
- Pass `containerById` and `projectById` to `SortedTaskList`. `AllContainersView` already computes `projectById`; add `containerById` map:

```ts
const containerById = useMemo(() => new Map((containers ?? []).map((c) => [c.id, c])), [containers]);
```

- Updated `ContainerRow` structure (simplified):

```tsx
<li ...>
  <div className="flex items-center gap-2">
    <button
      aria-label={expanded ? 'Collapse' : 'Expand'}
      aria-expanded={expanded}
      onClick={() => setExpanded((v) => !v)}
      className="..."
    >
      {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
    </button>
    ...title block...
  </div>
  {expanded && (
    <SortedTaskList
      containerId={container.id}
      labelsById={labelsById}
      containerById={containerById}
      projectById={projectById}
    />
  )}
  <QuickAddRow ... />
</li>
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run src/components/containers/AllContainersView.test.tsx`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/containers/AllContainersView.tsx src/components/containers/AllContainersView.test.tsx
git commit -m "feat(containers): list tasks inside All Containers view"
```

---

### Task 10: Generic entity picker

**Files:**
- Create: `src/components/shared/EntityPicker.tsx`
- Create: `src/components/shared/EntityPicker.test.tsx`
- Modify: `src/components/weekly/AddToWeekPicker.tsx`
- Modify: `src/components/kanban/AddToKanbanPicker.tsx`
- Modify: `src/components/weekly/AddToWeekPicker.test.tsx` (if needed)
- Modify: `src/components/kanban/AddToKanbanPicker.test.tsx` (if needed)

**Interfaces:**
```ts
export interface EntityPickerEntity {
  id: string;
  title: string;
  subtitle?: string;
}

export function EntityPicker({
  open,
  onOpenChange,
  title,
  placeholder,
  entities,
  onSelect,
  emptyMessage,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  placeholder: string;
  entities: EntityPickerEntity[];
  onSelect: (id: string) => void;
  emptyMessage: string;
}) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      q.length === 0
        ? []
        : entities.filter(
            (e) =>
              e.title.toLowerCase().includes(q) ||
              e.subtitle?.toLowerCase().includes(q),
          ),
    [entities, q],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <Input
          autoFocus
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <ul className="flex max-h-72 flex-col gap-1.5 overflow-y-auto">
          {filtered.map((entity) => (
            <li key={entity.id}>
              <button
                className="flex w-full items-center justify-between gap-2 rounded-lg border border-border/60 bg-background px-3 py-2 text-left text-sm shadow-sm transition-colors hover:border-primary/30 hover:bg-muted/40"
                onClick={() => onSelect(entity.id)}
              >
                <span className="truncate">{entity.title}</span>
                {entity.subtitle && (
                  <span className="shrink-0 text-xs text-muted-foreground">{entity.subtitle}</span>
                )}
              </button>
            </li>
          ))}
          {q.length > 0 && filtered.length === 0 && (
            <li className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
              {emptyMessage}
            </li>
          )}
          {q.length === 0 && (
            <li className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
              Type to search.
            </li>
          )}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 1: Write the failing picker test**

Create `src/components/shared/EntityPicker.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { EntityPicker } from './EntityPicker';

const entities = [
  { id: '1', title: 'Alpha', subtitle: 'Project A' },
  { id: '2', title: 'Beta', subtitle: 'Project B' },
];

describe('EntityPicker', () => {
  it('filters entities by query', async () => {
    render(
      <EntityPicker
        open
        onOpenChange={vi.fn()}
        title="Pick"
        placeholder="Search"
        entities={entities}
        onSelect={vi.fn()}
        emptyMessage="No matches"
      />,
    );
    await userEvent.type(screen.getByPlaceholderText('Search'), 'Alpha');
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.queryByText('Beta')).not.toBeInTheDocument();
  });

  it('calls onSelect with the entity id', async () => {
    const onSelect = vi.fn();
    render(
      <EntityPicker
        open
        onOpenChange={vi.fn()}
        title="Pick"
        placeholder="Search"
        entities={entities}
        onSelect={onSelect}
        emptyMessage="No matches"
      />,
    );
    await userEvent.type(screen.getByPlaceholderText('Search'), 'Beta');
    await userEvent.click(screen.getByText('Beta'));
    expect(onSelect).toHaveBeenCalledWith('2');
  });
});
```

Run: `npx vitest run src/components/shared/EntityPicker.test.tsx`
Expected: FAIL — `EntityPicker` does not exist.

- [ ] **Step 2: Implement `EntityPicker`**

Create `src/components/shared/EntityPicker.tsx` with the code shown in the Interfaces section above.

- [ ] **Step 3: Refactor `AddToWeekPicker`**

Edit `src/components/weekly/AddToWeekPicker.tsx`:

```tsx
import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { addToWeek } from '../../db/repositories/taskMembership';
import { getCurrentWeekId } from '../../lib/week';
import { SETTING_ACTIVE_WEEK } from '../../db/repositories/settings';
import { fireAndForget } from '../../lib/fireAndForget';
import { EntityPicker } from '../shared/EntityPicker';

export function AddToWeekPicker({ onClose }: { onClose: () => void }) {
  const activeWeekSetting = useLiveQuery(() => db.settings.get(SETTING_ACTIVE_WEEK), [], undefined);
  const weekId =
    (typeof activeWeekSetting?.value === 'string' && activeWeekSetting.value) || getCurrentWeekId();

  const containers = useLiveQuery(() => db.containers.toArray(), [], []);
  const containerById = useMemo(() => new Map((containers ?? []).map((c) => [c.id, c])), [containers]);
  const projects = useLiveQuery(() => db.projects.toArray(), [], []);
  const projectById = useMemo(() => new Map((projects ?? []).map((p) => [p.id, p])), [projects]);

  const tasks = useLiveQuery(
    () =>
      db.tasks
        .filter(
          (t) =>
            t.weekly?.weekId !== weekId &&
            !t.archived &&
            !containerById.get(t.containerId)?.archived,
        )
        .toArray(),
    [weekId, containers],
    [],
  );

  const entities = useMemo(
    () =>
      (tasks ?? []).map((t) => ({
        id: t.id,
        title: t.title,
        subtitle: projectById.get(t.projectId)?.name,
      })),
    [tasks, projectById],
  );

  return (
    <EntityPicker
      open
      onOpenChange={(open) => !open && onClose()}
      title="Add task to this week"
      placeholder="Search tasks"
      entities={entities}
      onSelect={(id) => fireAndForget(addToWeek(id, weekId).then(onClose))}
      emptyMessage="No tasks match your search."
    />
  );
}
```

- [ ] **Step 4: Refactor `AddToKanbanPicker`**

Edit `src/components/kanban/AddToKanbanPicker.tsx`:

```tsx
import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { addContainerToKanban } from '../../db/repositories/containers';
import { fireAndForget } from '../../lib/fireAndForget';
import { EntityPicker } from '../shared/EntityPicker';

export function AddToKanbanPicker({ onClose }: { onClose: () => void }) {
  const containers = useLiveQuery(
    () =>
      db.containers
        .filter((c) => !c.archived && c.kanban === null && c.id !== 'inbox-container')
        .toArray(),
    [],
    [],
  );
  const projects = useLiveQuery(() => db.projects.toArray(), [], []);
  const projectById = useMemo(() => new Map((projects ?? []).map((p) => [p.id, p])), [projects]);

  const entities = useMemo(
    () =>
      (containers ?? []).map((c) => ({
        id: c.id,
        title: c.name,
        subtitle: projectById.get(c.projectId)?.name,
      })),
    [containers, projectById],
  );

  return (
    <EntityPicker
      open
      onOpenChange={(open) => !open && onClose()}
      title="Add container to Kanban"
      placeholder="Search containers"
      entities={entities}
      onSelect={(id) => fireAndForget(addContainerToKanban(id).then(onClose))}
      emptyMessage="No containers match your search."
    />
  );
}
```

- [ ] **Step 5: Run picker tests**

Run: `npx vitest run src/components/shared/EntityPicker.test.tsx src/components/weekly/AddToWeekPicker.test.tsx src/components/kanban/AddToKanbanPicker.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/shared/EntityPicker.tsx src/components/shared/EntityPicker.test.tsx src/components/weekly/AddToWeekPicker.tsx src/components/kanban/AddToKanbanPicker.tsx
git commit -m "feat(shared): generic EntityPicker and refactor existing pickers"
```

---

### Task 11: Final verification

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 2: Type-check and build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Run the dev server smoke test (optional)**

Run: `npm run dev` and open the local URL. Verify:
- Hovering a task in the inbox shows the hover card.
- Weekly plan day columns show checkboxes; ticking a task moves it to the bottom.
- Dragging within a day persists order across reloads.
- All Containers rows expand to show tasks.
- "Add existing task" and "Add existing container" pickers filter and select.

- [ ] **Step 4: Commit any final fixes**

```bash
git add -A
git commit -m "fix: address review/test feedback"
```

---

## Self-review

**Spec coverage:**
- Hover cards for task/container/project → Tasks 4–6.
- All Containers lists tasks → Task 9.
- Weekly tick-off + completed-at-bottom → Tasks 3, 8.
- Reusable components → Tasks 6–8, 10.
- Weekly order independent of container order → Tasks 1–3, 8.
- Pick-from-list for existing tasks/containers → Task 10.
- Decisions recorded → already in `docs/decisions.md` and `AGENTS.md`.

**Placeholder scan:** no TBD/TODO, no vague "add error handling", all test code is concrete.

**Type consistency:** `WeeklyTaskMembership.order?: number`, `reorderWeeklyTasks(weekId, day, orderedIds)`, `sortWeeklyTasks(tasks)`, `EntityPickerEntity`, and `TaskCard` props are used consistently across tasks.

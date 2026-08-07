# Quick-Add Columns & All Tasks Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an inline "+" quick-add row to every Weekly Plan day column and
every Kanban status column that creates a task straight into that day/status
with a single Enter press, and add a new "All Tasks" nav tab listing every
task across every project.

**Architecture:** A single reusable `QuickAddRow` component (idle button →
autofocused text input → `onAdd(title)` callback on Enter, stays open for
the next entry) gets dropped into `WeeklyPlanView`'s `DayColumn` and
`KanbanView`'s `StatusColumn`, each supplying an `onAdd` that composes
existing repository functions (`createTask`, `addToWeek`/`setWeeklyDay`,
`addToKanban`/`setKanbanStatus`). A new `AllTasksView` component reuses the
same checkbox + click-to-edit + badge pattern already established by
`TaskCard` and `SearchView`, backed by an unfiltered `db.tasks.toArray()`
query. Both features only compose existing repository/UI primitives — no new
repository functions or schema changes.

**Tech Stack:** React, TypeScript, Vite, Tailwind CSS, Dexie +
dexie-react-hooks, Vitest + @testing-library/react + fake-indexeddb (matches
the rest of the codebase — see `docs/superpowers/plans/2026-08-06-phase-1-implementation.md`).

## Global Constraints

- Quick-added tasks always go to `INBOX_PROJECT_ID`/`INBOX_CONTAINER_ID`
  (from `src/db/inbox.ts`) — never a prompt for project/container at
  creation time.
- Quick-add is title-only. No description/labels UI at creation time.
- All Tasks is an unfiltered, flat list sorted by title — no filter, sort,
  or "hide completed" controls in this plan.
- Every new/changed component gets a `@testing-library/react` test file
  following the existing `vi.mock('../../db/db', ...)` pattern used
  throughout `src/components/**/*.test.tsx` (isolated in-memory Dexie
  instance per test file via `fake-indexeddb`).
- Follow existing import conventions: relative imports for app code (e.g.
  `../../db/db`), `@/lib/utils`-style alias only inside `src/components/ui/*`
  (unchanged by this plan).
- Mutations from event handlers go through `fireAndForget`
  (`src/lib/fireAndForget.ts`), matching every existing call site in
  `WeeklyPlanView.tsx`, `KanbanView.tsx`, `TaskCard.tsx`.

---

## File Structure

```
src/components/shared/QuickAddRow.tsx        - new, reusable inline quick-add control
src/components/shared/QuickAddRow.test.tsx    - new
src/components/weekly/WeeklyPlanView.tsx      - modified: DayColumn gets a QuickAddRow
src/components/weekly/WeeklyPlanView.test.tsx - modified: add quick-add test
src/components/kanban/KanbanView.tsx          - modified: StatusColumn gets a QuickAddRow
src/components/kanban/KanbanView.test.tsx     - modified: add quick-add test
src/components/tasks/AllTasksView.tsx         - new, flat cross-project task list
src/components/tasks/AllTasksView.test.tsx    - new
src/components/layout/NavTabs.tsx             - modified: new 'all-tasks' ActiveView + tab
src/components/layout/NavTabs.test.tsx        - modified: add tab test
src/App.tsx                                   - modified: render AllTasksView
```

---

### Task 1: `QuickAddRow` shared component

**Files:**
- Create: `src/components/shared/QuickAddRow.tsx`
- Test: `src/components/shared/QuickAddRow.test.tsx`

**Interfaces:**
- Consumes: `Button` (from `../ui/button`), `Input` (from `../ui/input`),
  `fireAndForget` (from `../../lib/fireAndForget`).
- Produces: `<QuickAddRow onAdd={(title: string) => Promise<void>} />` — a
  dashed "+ Quick add" button that, when clicked, becomes an autofocused
  text input. Enter with a non-empty trimmed value calls `onAdd(trimmed)`,
  clears the input, and stays in the input state (ready for the next
  entry). Escape, or blur while empty, returns to the idle button.

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/shared/QuickAddRow.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { QuickAddRow } from './QuickAddRow';

describe('QuickAddRow', () => {
  it('shows an idle button, then an input that calls onAdd on Enter and stays open for the next entry', async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    render(<QuickAddRow onAdd={onAdd} />);

    await userEvent.click(screen.getByText('+ Quick add'));
    const input = screen.getByPlaceholderText('Type a title…');
    await userEvent.type(input, 'First task{Enter}');

    expect(onAdd).toHaveBeenCalledWith('First task');
    expect(screen.getByPlaceholderText('Type a title…')).toHaveValue('');
  });

  it('ignores Enter with an empty or whitespace-only title', async () => {
    const onAdd = vi.fn();
    render(<QuickAddRow onAdd={onAdd} />);

    await userEvent.click(screen.getByText('+ Quick add'));
    await userEvent.type(screen.getByPlaceholderText('Type a title…'), '   {Enter}');

    expect(onAdd).not.toHaveBeenCalled();
  });

  it('returns to the idle button on Escape', async () => {
    const onAdd = vi.fn();
    render(<QuickAddRow onAdd={onAdd} />);

    await userEvent.click(screen.getByText('+ Quick add'));
    await userEvent.type(screen.getByPlaceholderText('Type a title…'), '{Escape}');

    expect(screen.getByText('+ Quick add')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- QuickAddRow.test.tsx`
Expected: FAIL — `./QuickAddRow` module doesn't exist.

- [ ] **Step 3: Write the implementation**

```tsx
// src/components/shared/QuickAddRow.tsx
import { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { fireAndForget } from '../../lib/fireAndForget';

export function QuickAddRow({ onAdd }: { onAdd: (title: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');

  function submit() {
    const trimmed = title.trim();
    if (!trimmed) return;
    setTitle('');
    fireAndForget(onAdd(trimmed));
  }

  if (!open) {
    return (
      <Button
        variant="ghost"
        className="w-full justify-start rounded-md border border-dashed border-border/70 text-muted-foreground hover:border-primary/40 hover:text-foreground"
        size="sm"
        onClick={() => setOpen(true)}
      >
        + Quick add
      </Button>
    );
  }

  return (
    <Input
      autoFocus
      placeholder="Type a title…"
      value={title}
      onChange={(e) => setTitle(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          submit();
        } else if (e.key === 'Escape') {
          setOpen(false);
          setTitle('');
        }
      }}
      onBlur={() => {
        if (!title.trim()) setOpen(false);
      }}
    />
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- QuickAddRow.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/shared/QuickAddRow.tsx src/components/shared/QuickAddRow.test.tsx
git commit -m "feat: add reusable QuickAddRow inline task-creation control"
```

---

### Task 2: Quick-add in Weekly Plan day columns

**Files:**
- Modify: `src/components/weekly/WeeklyPlanView.tsx`
- Modify: `src/components/weekly/WeeklyPlanView.test.tsx`

**Interfaces:**
- Consumes: `QuickAddRow` (from `../shared/QuickAddRow`), `createTask` (from
  `../../db/repositories/tasks`), `addToWeek`, `setWeeklyDay` (from
  `../../db/repositories/taskMembership`, `setWeeklyDay` already imported),
  `INBOX_PROJECT_ID`, `INBOX_CONTAINER_ID` (from `../../db/inbox`).
- Produces: `DayColumn` now accepts a `weekId: string` prop in addition to
  its existing `day` and `titles` props.

- [ ] **Step 1: Write the failing test**

```tsx
// Add to src/components/weekly/WeeklyPlanView.test.tsx — replace the
// existing two imports at the top with this expanded set, then append the
// new test inside the existing describe block.

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../db/db', async () => {
  const { PlanableDB } = await vi.importActual<typeof import('../../db/db')>('../../db/db');
  return { db: new PlanableDB(`test-weeklyview-${Math.random()}`) };
});

import { WeeklyPlanView } from './WeeklyPlanView';
import { createTask } from '../../db/repositories/tasks';
import { addToWeek, setWeeklyDay } from '../../db/repositories/taskMembership';
import { getCurrentWeekId } from '../../lib/week';
import { INBOX_PROJECT_ID, INBOX_CONTAINER_ID } from '../../db/inbox';

// ...existing two tests unchanged, then:

it('quick-adds a task directly into the clicked day column, in the Inbox project', async () => {
  render(<WeeklyPlanView />);

  const wedSection = screen.getByText('Wed').closest('section')!;
  await userEvent.click(within(wedSection).getByText('+ Quick add'));
  await userEvent.type(within(wedSection).getByPlaceholderText('Type a title…'), 'Quick task{Enter}');

  expect(await within(wedSection).findByText('Quick task')).toBeInTheDocument();

  const { db } = await import('../../db/db');
  const created = await db.tasks.where('title').equals('Quick task').first();
  expect(created?.projectId).toBe(INBOX_PROJECT_ID);
  expect(created?.containerId).toBe(INBOX_CONTAINER_ID);
  expect(created?.weekly).toEqual({ weekId: getCurrentWeekId(), day: 'Wed', repeatWeekly: false });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- WeeklyPlanView.test.tsx`
Expected: FAIL — no "+ Quick add" control exists in `DayColumn` yet.

- [ ] **Step 3: Write the implementation**

```tsx
// src/components/weekly/WeeklyPlanView.tsx
// Add these imports alongside the existing ones at the top of the file:
import { createTask } from '../../db/repositories/tasks';
import { addToWeek, setWeeklyDay } from '../../db/repositories/taskMembership'; // addToWeek is new here
import { INBOX_PROJECT_ID, INBOX_CONTAINER_ID } from '../../db/inbox';
import { QuickAddRow } from '../shared/QuickAddRow';

// Replace the DayColumn function with:
function DayColumn({
  day,
  weekId,
  titles,
}: {
  day: WeekDay;
  weekId: string;
  titles: { id: string; title: string }[];
}) {
  const { setNodeRef } = useDroppable({ id: day });

  async function handleAdd(title: string) {
    const task = await createTask({ title, projectId: INBOX_PROJECT_ID, containerId: INBOX_CONTAINER_ID });
    await addToWeek(task.id, weekId);
    if (day !== 'Unplanned') await setWeeklyDay(task.id, day);
  }

  return (
    <section
      ref={setNodeRef}
      className="flex w-48 shrink-0 flex-col rounded-xl border border-border bg-card shadow-sm"
    >
      <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          <span className={DAY_ACCENT[day]}>
            <span className="block size-2 shrink-0 rounded-full bg-current" />
          </span>
          <h3 className="text-sm font-semibold">{day}</h3>
        </div>
        <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground tabular-nums">
          {titles.length}
        </span>
      </div>
      <ul className="flex flex-col gap-1.5 p-2">
        {titles.map((t) => (
          <DraggableTaskRow key={t.id} id={t.id} title={t.title} />
        ))}
      </ul>
      <div className="p-2 pt-0">
        <QuickAddRow onAdd={handleAdd} />
      </div>
    </section>
  );
}
```

```tsx
// Inside WeeklyPlanView's return, update the COLUMNS.map call to pass weekId:
{COLUMNS.map((day) => (
  <DayColumn
    key={day}
    day={day}
    weekId={weekId}
    titles={tasks.filter((t) => t.weekly?.day === day).map((t) => ({ id: t.id, title: t.title }))}
  />
))}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- WeeklyPlanView.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/weekly/WeeklyPlanView.tsx src/components/weekly/WeeklyPlanView.test.tsx
git commit -m "feat: add quick-add to Weekly Plan day columns"
```

---

### Task 3: Quick-add in Kanban status columns

**Files:**
- Modify: `src/components/kanban/KanbanView.tsx`
- Modify: `src/components/kanban/KanbanView.test.tsx`

**Interfaces:**
- Consumes: `QuickAddRow` (from `../shared/QuickAddRow`), `createTask` (from
  `../../db/repositories/tasks`), `addToKanban` (new import here),
  `setKanbanStatus` (already imported, from
  `../../db/repositories/taskMembership`), `INBOX_PROJECT_ID`,
  `INBOX_CONTAINER_ID` (from `../../db/inbox`).
- Produces: `StatusColumn` unchanged in its prop shape (`status`, `titles`)
  — no new prop needed since Kanban has no equivalent of "week".

- [ ] **Step 1: Write the failing test**

```tsx
// Add to src/components/kanban/KanbanView.test.tsx — replace the top
// imports with this expanded set, then append the new test inside the
// existing describe block.

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../db/db', async () => {
  const { PlanableDB } = await vi.importActual<typeof import('../../db/db')>('../../db/db');
  return { db: new PlanableDB(`test-kanbanview-${Math.random()}`) };
});

import { KanbanView } from './KanbanView';
import { createTask } from '../../db/repositories/tasks';
import { addToKanban, setKanbanStatus } from '../../db/repositories/taskMembership';
import { INBOX_PROJECT_ID, INBOX_CONTAINER_ID } from '../../db/inbox';

// ...existing two tests unchanged, then:

it('quick-adds a task directly into the clicked status column, in the Inbox project', async () => {
  render(<KanbanView />);

  const blockedSection = screen.getByText('Blocked').closest('section')!;
  await userEvent.click(within(blockedSection).getByText('+ Quick add'));
  await userEvent.type(within(blockedSection).getByPlaceholderText('Type a title…'), 'Blocked task{Enter}');

  expect(await within(blockedSection).findByText('Blocked task')).toBeInTheDocument();

  const { db } = await import('../../db/db');
  const created = await db.tasks.where('title').equals('Blocked task').first();
  expect(created?.projectId).toBe(INBOX_PROJECT_ID);
  expect(created?.containerId).toBe(INBOX_CONTAINER_ID);
  expect(created?.kanban).toEqual({ status: 'Blocked' });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- KanbanView.test.tsx`
Expected: FAIL — no "+ Quick add" control exists in `StatusColumn` yet.

- [ ] **Step 3: Write the implementation**

```tsx
// src/components/kanban/KanbanView.tsx
// Add these imports alongside the existing ones at the top of the file:
import { createTask } from '../../db/repositories/tasks';
import { addToKanban, setKanbanStatus } from '../../db/repositories/taskMembership'; // addToKanban is new here
import { INBOX_PROJECT_ID, INBOX_CONTAINER_ID } from '../../db/inbox';
import { QuickAddRow } from '../shared/QuickAddRow';

// Replace the StatusColumn function with:
function StatusColumn({ status, titles }: { status: KanbanStatus; titles: { id: string; title: string }[] }) {
  const { setNodeRef } = useDroppable({ id: status });

  async function handleAdd(title: string) {
    const task = await createTask({ title, projectId: INBOX_PROJECT_ID, containerId: INBOX_CONTAINER_ID });
    await addToKanban(task.id);
    if (status !== 'Todo') await setKanbanStatus(task.id, status);
  }

  return (
    <section
      ref={setNodeRef}
      className="flex w-56 shrink-0 flex-col rounded-xl border border-border bg-card shadow-sm"
    >
      <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          <span className={STATUS_ACCENT[status]}>
            <span className="block size-2 shrink-0 rounded-full bg-current" />
          </span>
          <h3 className="text-sm font-semibold">{status}</h3>
        </div>
        <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground tabular-nums">
          {titles.length}
        </span>
      </div>
      <ul className="flex flex-col gap-1.5 p-2">
        {titles.map((t) => (
          <DraggableCard key={t.id} id={t.id} title={t.title} />
        ))}
      </ul>
      <div className="p-2 pt-0">
        <QuickAddRow onAdd={handleAdd} />
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- KanbanView.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/kanban/KanbanView.tsx src/components/kanban/KanbanView.test.tsx
git commit -m "feat: add quick-add to Kanban status columns"
```

---

### Task 4: `AllTasksView` component

**Files:**
- Create: `src/components/tasks/AllTasksView.tsx`
- Test: `src/components/tasks/AllTasksView.test.tsx`

**Interfaces:**
- Consumes: `db` (from `../../db/db`), `setTaskCompleted` (from
  `../../db/repositories/tasks`), `fireAndForget` (from
  `../../lib/fireAndForget`), `Task` type (from `../../db/schema`),
  `Checkbox` (from `../ui/checkbox`), `Badge` (from `../ui/badge`),
  `TaskDialog` (from `../projects/TaskDialog`).
- Produces: `<AllTasksView />` — no props. Renders every task across every
  project, sorted by title, each row with a completed checkbox, a
  click-to-edit title button, the resolved project name, and
  kanban/weekly membership badges (same badge text as `SearchView`'s
  `TaskResult`: `` `Kanban: ${task.kanban.status}` ``,
  `task.weekly.repeatWeekly ? 'Repeats weekly' : \`Week: ${task.weekly.day}\``).

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/tasks/AllTasksView.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../db/db', async () => {
  const { PlanableDB } = await vi.importActual<typeof import('../../db/db')>('../../db/db');
  return { db: new PlanableDB(`test-alltasks-${Math.random()}`) };
});

import { AllTasksView } from './AllTasksView';
import { createProject } from '../../db/repositories/projects';
import { createContainer } from '../../db/repositories/containers';
import { createTask } from '../../db/repositories/tasks';
import { INBOX_PROJECT_ID, INBOX_CONTAINER_ID } from '../../db/inbox';

describe('AllTasksView', () => {
  it('lists tasks from multiple projects with their resolved project name', async () => {
    const project = await createProject('Alpha');
    const container = await createContainer(project.id, 'Backlog');
    await createTask({ title: 'Alpha task', projectId: project.id, containerId: container.id });
    await createTask({ title: 'Inbox task', projectId: INBOX_PROJECT_ID, containerId: INBOX_CONTAINER_ID });

    render(<AllTasksView />);

    expect(await screen.findByText('Alpha task')).toBeInTheDocument();
    expect(screen.getByText('Inbox task')).toBeInTheDocument();
    expect(screen.getByText('Alpha')).toBeInTheDocument();
  });

  it('toggles a task completed via its checkbox', async () => {
    const task = await createTask({ title: 'Toggle me', projectId: INBOX_PROJECT_ID, containerId: INBOX_CONTAINER_ID });

    render(<AllTasksView />);
    await userEvent.click(await screen.findByLabelText('Toggle completed for Toggle me'));

    const { db } = await import('../../db/db');
    expect((await db.tasks.get(task.id))?.completed).toBe(true);
  });

  it('opens the edit dialog when a task title is clicked', async () => {
    await createTask({ title: 'Editable', projectId: INBOX_PROJECT_ID, containerId: INBOX_CONTAINER_ID });

    render(<AllTasksView />);
    await userEvent.click(await screen.findByText('Editable'));

    expect(await screen.findByText('Edit task')).toBeInTheDocument();
  });

  it('shows an empty state with no tasks', async () => {
    render(<AllTasksView />);
    expect(await screen.findByText('No tasks yet.')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- AllTasksView.test.tsx`
Expected: FAIL — `./AllTasksView` module doesn't exist.

- [ ] **Step 3: Write the implementation**

```tsx
// src/components/tasks/AllTasksView.tsx
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { ListChecks } from 'lucide-react';
import { db } from '../../db/db';
import { setTaskCompleted } from '../../db/repositories/tasks';
import { fireAndForget } from '../../lib/fireAndForget';
import type { Task } from '../../db/schema';
import { Checkbox } from '../ui/checkbox';
import { Badge } from '../ui/badge';
import { TaskDialog } from '../projects/TaskDialog';

export function AllTasksView() {
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const tasks = useLiveQuery(
    () => db.tasks.toArray().then((arr) => arr.sort((a, b) => a.title.localeCompare(b.title))),
    [],
    [],
  );
  const projects = useLiveQuery(() => db.projects.toArray(), [], []);
  const projectById = new Map((projects ?? []).map((p) => [p.id, p]));

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center gap-3">
        <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <ListChecks className="size-4" />
        </div>
        <div>
          <h2 className="text-lg font-semibold tracking-tight">All Tasks</h2>
          <p className="text-sm text-muted-foreground">Every task across every project</p>
        </div>
      </div>
      <ul className="flex flex-col gap-1.5">
        {tasks.map((task) => (
          <li
            key={task.id}
            className="flex items-center gap-2 rounded-xl border border-border/70 bg-card px-3 py-2.5 shadow-sm"
          >
            <Checkbox
              checked={task.completed}
              aria-label={`Toggle completed for ${task.title}`}
              onCheckedChange={(checked) => fireAndForget(setTaskCompleted(task.id, checked))}
            />
            <button
              className={`min-w-0 flex-1 truncate text-left text-sm ${
                task.completed ? 'text-muted-foreground line-through' : 'text-foreground'
              }`}
              onClick={() => setEditingTask(task)}
            >
              {task.title}
            </button>
            {projectById.get(task.projectId) && (
              <span className="shrink-0 text-xs text-muted-foreground">
                {projectById.get(task.projectId)!.name}
              </span>
            )}
            {task.kanban && (
              <Badge variant="secondary" className="shrink-0">
                Kanban: {task.kanban.status}
              </Badge>
            )}
            {task.weekly && (
              <Badge variant="secondary" className="shrink-0">
                {task.weekly.repeatWeekly ? 'Repeats weekly' : `Week: ${task.weekly.day}`}
              </Badge>
            )}
          </li>
        ))}
        {tasks.length === 0 && (
          <li className="py-10 text-center text-sm text-muted-foreground">No tasks yet.</li>
        )}
      </ul>
      {editingTask && (
        <TaskDialog
          mode="edit"
          projectId={editingTask.projectId}
          containerId={editingTask.containerId}
          task={editingTask}
          onClose={() => setEditingTask(null)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- AllTasksView.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/tasks/AllTasksView.tsx src/components/tasks/AllTasksView.test.tsx
git commit -m "feat: add All Tasks view listing every task across all projects"
```

---

### Task 5: Wire "All Tasks" into nav and app shell

**Files:**
- Modify: `src/components/layout/NavTabs.tsx`
- Modify: `src/components/layout/NavTabs.test.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `AllTasksView` (from `../tasks/AllTasksView`, imported in
  `App.tsx`).
- Produces: `ActiveView` (from `NavTabs.tsx`) gains
  `| { kind: 'all-tasks' }`, positioned in the union and in the rendered tab
  order right after `kanban` and before `search`.

- [ ] **Step 1: Write the failing test**

```tsx
// Add to src/components/layout/NavTabs.test.tsx, inside the existing
// describe block (imports are already present in this file):

it('renders an All Tasks tab and calls onSelect', async () => {
  const onSelect = vi.fn();
  render(<NavTabs active={{ kind: 'weekly' }} onSelect={onSelect} />);

  await userEvent.click(await screen.findByText('All Tasks'));
  expect(onSelect).toHaveBeenCalledWith({ kind: 'all-tasks' });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- NavTabs.test.tsx`
Expected: FAIL — no "All Tasks" tab is rendered yet.

- [ ] **Step 3: Write the implementation**

```tsx
// src/components/layout/NavTabs.tsx
// Update the ActiveView union:
export type ActiveView =
  | { kind: 'weekly' }
  | { kind: 'kanban' }
  | { kind: 'all-tasks' }
  | { kind: 'labels' }
  | { kind: 'search' }
  | { kind: 'settings' }
  | { kind: 'project'; projectId: string };

// Update the lucide-react import line to add ListChecks:
import { CalendarDays, CalendarRange, KanbanSquare, ListChecks, Moon, Plus, Search, Settings, Sun, Tags } from 'lucide-react';

// Update the tabs array (inside the component body) to insert 'all-tasks'
// right after 'kanban':
{([
  ['weekly', 'Weekly Plan', CalendarDays] as const,
  ['kanban', 'Kanban', KanbanSquare] as const,
  ['all-tasks', 'All Tasks', ListChecks] as const,
  ['search', 'Search', Search] as const,
  ['labels', 'Labels', Tags] as const,
  ['settings', 'Settings', Settings] as const,
] as const).map(([kind, label, Icon]) => (
  <AppSettingsTab
    key={kind}
    label={label}
    icon={Icon}
    active={isActive({ kind } as ActiveView)}
    onClick={() => onSelect({ kind } as ActiveView)}
  />
))}
```

```tsx
// src/App.tsx
// Add the import:
import { AllTasksView } from './components/tasks/AllTasksView';

// Add the render branch alongside the other active.kind checks:
{active.kind === 'all-tasks' && <AllTasksView />}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS — full suite green, including all tasks/tabs added in this
plan.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/NavTabs.tsx src/components/layout/NavTabs.test.tsx src/App.tsx
git commit -m "feat: wire All Tasks tab into nav and app shell"
```

---

## Final Verification

- [ ] **Run the full test suite**

Run: `npm test`
Expected: PASS — every test file green.

- [ ] **Run the production build**

Run: `npm run build`
Expected: exits 0 (`tsc -b && vite build`).

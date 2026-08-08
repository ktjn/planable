# Quick-Add Columns & All Tasks Tab — Design

**Goal:** Let users capture a task straight into a Weekly Plan day column or a
Kanban status column with a single inline input (no dialog), and add a new
"All Tasks" tab that lists every task across every project in one place.

## 1. Per-column quick-add

**Where:** A new row at the bottom of every `DayColumn`
(`src/components/weekly/WeeklyPlanView.tsx`) and every `StatusColumn`
(`src/components/kanban/KanbanView.tsx`), in the same slot
`ContainerColumn` already uses for its "+ Add task" button.

**Component:** `src/components/shared/QuickAddRow.tsx`

```tsx
function QuickAddRow({ onAdd }: { onAdd: (title: string) => Promise<void> }) {
  // idle state: dashed "+ Quick add" button, same styling as
  // ContainerColumn's AddTaskButton.
  // active state: autofocused text input; Enter (non-empty) calls onAdd
  // then clears the input and stays open for the next entry; Escape or
  // blur-with-empty-value returns to idle.
}
```

This is intentionally generic (`onAdd(title)`) so both views reuse it without
any day/status-specific logic living inside the component.

**Weekly day column** (`onAdd` passed into `QuickAddRow` from `DayColumn`):

```ts
const task = await createTask({
  title,
  projectId: INBOX_PROJECT_ID,
  containerId: INBOX_CONTAINER_ID,
});
await addToWeek(task.id, weekId);
if (day !== 'Unplanned') await setWeeklyDay(task.id, day);
```

`weekId` is the same value `WeeklyPlanView` already computes and passes down
for filtering; `day` is the column's own `WeekDay`.

**Kanban status column** (`onAdd` passed into `QuickAddRow` from `StatusColumn`):

```ts
const task = await createTask({
  title,
  projectId: INBOX_PROJECT_ID,
  containerId: INBOX_CONTAINER_ID,
});
await addToKanban(task.id);
if (status !== 'Todo') await setKanbanStatus(task.id, status);
```

No new repository functions are needed — both flows only compose existing
`createTask`, `addToWeek`, `setWeeklyDay`, `addToKanban`, `setKanbanStatus`
(`src/db/repositories/tasks.ts`, `src/db/repositories/taskMembership.ts`).

Quick-added tasks always land in the Inbox project/container (per product
decision — consistent with how other flows treat uncategorized tasks). Users
can move them to a real project later via the existing task edit dialog.

Calls go through `fireAndForget` (`src/lib/fireAndForget.ts`), matching every
other mutation call site in these two views.

## 2. All Tasks tab

**Nav:** `NavTabs`'s `ActiveView` union gains
`| { kind: 'all-tasks' }`, with a new tab (label "All Tasks", an icon such as
`ListChecks` from `lucide-react`) placed after Kanban and before Search in
the tab order. `App.tsx` renders `<AllTasksView />` for that view kind.

**Component:** `src/components/tasks/AllTasksView.tsx`

- Queries `db.tasks.toArray()` via `useLiveQuery`, sorted by title
  (`.sort((a, b) => a.title.localeCompare(b.title))`), unfiltered — every
  task, every project, completed or not.
- Also queries `db.projects.toArray()` to resolve each task's project name
  for display (same `projectById` map pattern as `SearchView`).
- Each row: a `Checkbox` bound to `task.completed` (calls
  `setTaskCompleted`), the task title (button — click opens `TaskDialog` in
  edit mode, same as `TaskCard`/`SearchView`'s row), the resolved project
  name, and the same kanban/weekly `Badge`s `SearchView`'s `TaskResult`
  already renders.
- Empty state: "No tasks yet" when the list is empty.

This reuses the exact interaction pattern already established by
`TaskCard` (checkbox + click-to-edit) and `SearchView` (cross-project row
with project name + membership badges) — no new interaction patterns, just a
new unfiltered listing.

## Files

- Create: `src/components/shared/QuickAddRow.tsx`,
  `src/components/tasks/AllTasksView.tsx`
- Modify: `src/components/weekly/WeeklyPlanView.tsx` (add `QuickAddRow` to
  `DayColumn`), `src/components/kanban/KanbanView.tsx` (add `QuickAddRow` to
  `StatusColumn`), `src/components/layout/NavTabs.tsx` (new `ActiveView`
  member + tab), `src/App.tsx` (render `AllTasksView`)
- Tests: `QuickAddRow.test.tsx` (or covered inline via
  `WeeklyPlanView.test.tsx`/`KanbanView.test.tsx` additions — creating a task
  via the inline input asserts it appears in the right day/status),
  `AllTasksView.test.tsx` (lists tasks across two different projects, toggles
  completed, opens edit dialog on click)

## Out of scope

- Quick-adding directly into a specific project/container from these two
  views (tasks always go to Inbox, per product decision).
- Filtering, sorting controls, or hiding completed tasks in All Tasks beyond
  the default title sort (explicitly deferred — flat unfiltered list only).
- Description/labels at creation time via quick-add (title only; edit later
  via the dialog for those fields).

# Planable — Core Data Model & View Design

Date: 2026-08-06
Status: Approved

## Context

`plans/Planable-Project-Plan.md` establishes the product vision, tech stack, and
MVP phases for Planable, a local-first personal work planning app (Weekly Plan,
Kanban, Projects). That document left one important ambiguity unresolved: a
Task listed fields for project/container, weekly placement, and kanban status
all at once, while also stating "Weekly planning and Kanban are independent."
This spec resolves that ambiguity and defines the concrete data model and
view behaviors needed before implementation planning.

This spec supersedes the "Tasks" and "Kanban" sections of the original plan
where they conflict; everything else in the original plan (tech stack,
storage, labels, import/export shape, non-goals, phases) still applies.

## Data Model

### Project

- `id`, `name`, `order`
- Has zero or more Containers.
- **Inbox** is a special, pinned pseudo-project: always present, cannot be
  renamed or deleted, provides a single implicit container for projectless
  tasks. It behaves like a project for the purposes of `projectId` /
  `containerId` on a Task, but is excluded from normal project-management
  actions (no delete, no reorder relative to real projects beyond being
  pinned first).

### Container

- `id`, `projectId`, `name`, `order`
- `labels: LabelId[]` — global labels assigned to the Container, rendered
  wherever the Container appears (Project, Weekly, Kanban, All Containers,
  Search), mirroring Task labels.
- `archived: boolean` — independent, reversible archive state.
- `weekly: { weekId: string, day: 'Unplanned' | 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' } | null`
  — optional. Presence means the Container is scheduled on a week's plan.
  Scheduling a Container represents planning time for that work area and does
  **not** change the weekly membership of any of its child Tasks.
- `kanban: { status: 'Todo' | 'Doing' | 'Blocked' | 'Done' } | null`
  — this is the **only** Kanban membership. Containers are the sole
  Kanban-schedulable entity; Tasks never have Kanban membership.
- Created, renamed, reordered, and deleted freely within a project.
- Inbox has one implicit container; the user does not manage it directly.
- Containers do **not** repeat weekly; nothing may auto-insert a Container
  into a future week.

### Task

The central entity. Every task belongs to exactly one project+container
(Inbox counts). Weekly Plan membership is optional and additive; Tasks
have **no Kanban membership** — only Containers appear on the Kanban
board. Task and Container weekly membership are independent of one
another: a Task's Container may be scheduled without scheduling the Task
itself, and vice versa.

- `id`
- `title`
- `description` (markdown)
- `labels: LabelId[]`
- `projectId`, `containerId`
- `completed: boolean`
- `completedDate: number | null` (epoch milliseconds, i.e. `Date.now()`)
  — set when `completed` transitions to `true`, cleared if uncompleted.
  A number rather than a `Date` object so it round-trips through
  `JSON.stringify`/`JSON.parse` without revival logic, needed for the
  plain JSON import/export described below.
- `archived: boolean` — independent, reversible archive state.
- `weekly: { weekId: string, day: 'Unplanned' | 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri', repeatWeekly: boolean } | null`
  — presence means the task is on the current/a week's plan

A task can have `weekly` set or unset independently of its
project/container and of its Container's memberships.

### WeeklyTemplate

- `id`, `title`, `description`, `labels`, `projectId`, `containerId`
- Represents a task definition flagged to repeat every week.
- On week start, each active template spawns a new Task instance with
  `weekly = { weekId: <new week>, day: 'Unplanned', repeatWeekly: true }`.

### Archive

`Container.archived` and `Task.archived` are independent, persistent
flags. Archived entities are hidden from every normal view by default and
remain discoverable through Search (ranked after active matches, marked
clearly).

- A Task is **effectively archived** for visibility whenever its parent
  Container is archived, even if `task.archived === false`. Default views
  hide such Tasks. Search marks them with an "Archived container" badge
  rather than implying the Task itself was archived.
- **Container visibility** `= !container.archived`
- **Task visibility** `= !task.archived && !parentContainer.archived`
- Archiving a Container clears its own `weekly` and `kanban` memberships
  in one update but never mutates its child Tasks' archive flags.
- Archiving a Task clears its `weekly` membership and removes its
  `WeekTemplate` so it cannot recur while archived. Unarchiving restores
  no prior placement.
- The Inbox Container cannot be archived.
- Moving `Container.kanban` to `Done` never completes/archives child Tasks.

### Label

- `id`, `name`, `color` — global, unchanged from original plan.

### Editing conventions

Editing is opened by **double-clicking** an entity's body (Task card,
Container card/header, Weekly rows, All Tasks/All Containers rows, Search
results). A single click never opens an editor. Buttons, checkboxes,
quick-add controls, and explicit drag handles call `stopPropagation()` as
needed. Dragging starts only from an explicit drag handle, never the whole
card surface.

## Views & Flows

### Weekly Plan

Columns: Unplanned, Monday–Friday. The Weekly Plan shows two independent
boards/sections, each scoped to the current `weekId`:

- **Containers** — Containers whose `weekly.weekId` matches the current
  week. Scheduling a Container does not schedule (or unschedule, or copy,
  or mutate) any of its child Tasks.
- **Tasks** — Tasks whose `weekly.weekId` matches the current week,
  exactly as before (including `repeatWeekly` behavior).

Two ways to add a Task to the current week (unchanged):
1. "Add to this week" action on a task card anywhere — sets
   `weekly = { weekId: current, day: 'Unplanned', repeatWeekly: false }`.
2. A picker/drawer within the Weekly Plan view to search all tasks and
   pull one in directly, same effect as above.

Containers are scheduled in the same picker via a separate "Containers"
tab, and from the Project view via an "Add to this week" action / a
"Scheduled: <day>" badge on each Container column. Scheduling a Container
sets `weekly = { weekId: current, day: 'Unplanned' }`.

Dragging a Task between columns only updates `task.weekly.day`. Dragging a
Container between columns only updates `container.weekly.day`. Container
and Task drags are fully independent. Neither drag touches `kanban` or
`completed`, and neither ever updates the other entity type.

### Kanban

Single global board (not per-project): Todo, Doing, Blocked, Done. Pools
**Containers** from all projects (excluding Inbox and archived
Containers). Each card shows its source project, the Container's labels,
its child Task count, an explicit drag handle, and a compact quick-add
for a child Task. Double-clicking a card opens the Container editor.

Tasks have no Kanban membership and no "Add to Kanban" action. There is
no UI path that places a Task directly on the Kanban board.

Two ways to add a Container to Kanban:
1. From the Container editor outside Kanban is not required; the primary
   path is the picker/drawer within the Kanban view, which searches
   Containers.
2. A picker/drawer within the Kanban view — searches non-archived,
   non-scheduled Containers.

New Container Kanban membership defaults to `status: 'Todo'`. Dragging
between columns only updates `container.kanban.status`. It never touches
`weekly`, `completed`, or any child Task state.

### Projects (including Inbox tab)

Container-based board/list per project. This is where tasks are created
and organized. Task cards show small badges when the task has `weekly`
membership (and its labels), so the user can see at a glance that a task
is "live" elsewhere without switching views. Container column headers
show the Container's labels and support double-click editing.

Task creation inside a Container uses a title-only inline quick-add
(`QuickAddRow`); Enter creates the Task in that Container and keeps the
input ready for the next one. Full details are edited afterwards by
double-clicking the created Task.

Inbox appears as a pinned tab before regular project tabs. It is the
default destination for quick-added tasks that aren't assigned a project
at creation time.

## Weekly Rollover

Operates only on `weekly` membership; `kanban` status and `completed` are
untouched by rollover except where a resolution explicitly says so. Task
rollover and Container rollover remain fully independent — resolving one
never affects the other.

For every Container with `weekly.weekId` equal to the closing week, only
two resolutions are offered (a Container is never completed, deleted, or
repeated as a weekly shortcut, and deleting a Container is never an
incidental side effect of rollover):
- **Move to next week** — `container.weekly.weekId` advances, `day` resets
  to `Unplanned`. All child Tasks are preserved untouched.
- **Return to project** — `container.weekly` is cleared (set to `null`).

Archived Containers never appear in rollover, because archiving already
cleared their `weekly` membership. Moving a Container never creates a
template or auto-inserts anything into a future week — Containers cannot
recur regardless of resolution.

For every task with `weekly.weekId` equal to the closing week:
- **Move to next week** — `weekly.weekId` advances, `day` resets to
  `Unplanned` (or is carried over — carrying the same weekday forward is
  acceptable too; implementation detail).
- **Return to project** — `weekly` is cleared (set to `null`). Task keeps
  whatever project/container it already has.
- **Complete** — `completed = true`, `completedDate = now`, `weekly`
  cleared.
- **Delete** — task is deleted entirely. Requires a confirmation step
  since it's destructive.

Tasks with `weekly.repeatWeekly = true` are not manually resolved; instead
a fresh instance is spawned into the new week's Unplanned column
automatically (see WeeklyTemplate above), and the old instance's `weekly`
is cleared.

## Storage & Import/Export

Unchanged from the original plan: IndexedDB via Dexie, no backend, no
auth. JSON export/import includes Projects, Containers (with `labels`,
`archived`, `weekly`, `kanban`), Tasks (with `archived`/`weekly`/
`completedDate` — Tasks no longer carry a `kanban` field), Labels, Weekly
Templates, and Settings. Inbox is implicit and does not need to be
included as a Project record in export — it can be reconstructed on
import.

## Error Handling

- Deleting a Project or Container with tasks in it: tasks must be
  reassigned (e.g. to Inbox) or the delete blocked/confirmed — exact UX
  is an implementation-planning detail, but data integrity rule is: no
  task may end up with a dangling `projectId`/`containerId`.
  - Deleting a Label: removed from any task's `labels[]`, no cascade.
  - Deleting a task while it has `weekly` membership (and possibly a
    `WeekTemplate`): membership and template are discarded along with the
    task.
  - Deleting a Label: removed from any task's and Container's `labels[]`,
    no cascade.

## Testing

- Unit tests around Container Kanban membership transitions (add/remove
  status, drag updates status only, no Task-completion side effect) and
  Task Weekly membership (add/remove, day updates, repeat template).
- Unit tests for archive/unarchive semantics, including membership
  cleanup (Container clears weekly+kanban; Task clears weekly+template)
  and Inbox-archive refusal.
- Unit tests for default-view archive filtering and Search
  active-before-archived ranking.
- Unit tests for weekly rollover resolution paths (all actions), template
  instance spawning, and Container non-recurrence.
- Import/export round-trip test preserving Container labels/archive/
  kanban and Task archive/weekly/completedDate fields.

## Scope / Phases

No change to the original plan's phase boundaries (Phase 1: core
CRUD + views + DnD + IndexedDB + import/export; Phase 2: rollover +
templates + search + shortcuts + settings; Phase 3: PWA/sync/AI/
analytics). The Inbox pseudo-project and independent Kanban/Weekly
membership are part of Phase 1, since they're foundational to the data
model rather than additive features.

## Technology Stack (unchanged, restated for reference)

- **Frontend:** React, TypeScript, Vite, Tailwind CSS, shadcn/ui, Base UI,
  Lucide React
- **Storage:** IndexedDB, Dexie
- **Drag & Drop:** @dnd-kit
- **Deployment:** GitHub Pages (static, no backend, no auth)

## Non-Goals (unchanged)

Collaboration, authentication, comments, attachments, notifications,
time tracking, Gantt charts, sprint management, story points,
server-side storage.

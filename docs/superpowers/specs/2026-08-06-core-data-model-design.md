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
- Created, renamed, reordered, and deleted freely within a project.
- Inbox has one implicit container; the user does not manage it directly.

### Task

The central entity. Every task belongs to exactly one project+container
(Inbox counts). Kanban and Weekly Plan membership are independent,
optional, additive states — not fields that always apply.

- `id`
- `title`
- `description` (markdown)
- `labels: LabelId[]`
- `projectId`, `containerId`
- `completed: boolean`
- `completedDate: Date | null` — set when `completed` transitions to
  `true`, cleared if uncompleted
- `kanban: { status: 'Todo' | 'Doing' | 'Blocked' | 'Done' } | null`
  — presence means the task is on the Kanban board
- `weekly: { weekId: string, day: 'Unplanned' | 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri', repeatWeekly: boolean } | null`
  — presence means the task is on the current/a week's plan

A task can have any combination of `kanban` and `weekly` set or unset,
independent of one another and independent of its project/container.

### WeeklyTemplate

- `id`, `title`, `description`, `labels`, `projectId`, `containerId`
- Represents a task definition flagged to repeat every week.
- On week start, each active template spawns a new Task instance with
  `weekly = { weekId: <new week>, day: 'Unplanned', repeatWeekly: true }`.

### Label

- `id`, `name`, `color` — global, unchanged from original plan.

## Views & Flows

### Weekly Plan

Columns: Unplanned, Monday–Friday. Shows only tasks whose `weekly.weekId`
matches the current week.

Two ways to add a task to the current week:
1. "Add to this week" action on a task card anywhere (Project view or
   Kanban card) — sets `weekly = { weekId: current, day: 'Unplanned', repeatWeekly: false }`.
2. A picker/drawer within the Weekly Plan view to search all tasks and
   pull one in directly, same effect as above.

Dragging a task between columns only updates `weekly.day`. It never
touches `kanban` or `completed`.

### Kanban

Single global board (not per-project): Todo, Doing, Blocked, Done. Pools
tasks from all projects, including Inbox. Each card shows its source
project (or a label) as a small tag for context.

Two ways to add a task to Kanban, matching Weekly Plan:
1. "Add to Kanban" action on a task card.
2. A picker/drawer within the Kanban view.

New Kanban membership defaults to `status: 'Todo'`. Dragging between
columns only updates `kanban.status`. It never touches `weekly` or
`completed`, except: dragging into `Done` also sets `completed = true`
and `completedDate = now` (this is the one intentional cross-field
effect, since "Done" on the Kanban board is the natural signal of
completion).

### Projects (including Inbox tab)

Container-based board/list per project. This is where tasks are created
and organized. Task cards show small badges when the task also has
`kanban` and/or `weekly` membership, so the user can see at a glance that
a task is "live" elsewhere without switching views.

Inbox appears as a pinned tab before regular project tabs. It is the
default destination for quick-added tasks that aren't assigned a project
at creation time.

## Weekly Rollover

Operates only on `weekly` membership; `kanban` status and `completed` are
untouched by rollover except where a resolution explicitly says so.

For every task with `weekly.weekId` equal to the closing week:
- **Move to next week** — `weekly.weekId` advances, `day` resets to
  `Unplanned` (or is carried over — carrying the same weekday forward is
  acceptable too; implementation detail).
- **Return to project** — `weekly` is cleared (set to `null`). Task keeps
  whatever `kanban` state and project/container it already has.
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
auth. JSON export/import includes Projects, Containers, Tasks (with the
new `kanban`/`weekly`/`completedDate` fields), Labels, Weekly Templates,
and Settings. Inbox is implicit and does not need to be included as a
Project record in export — it can be reconstructed on import.

## Error Handling

- Deleting a Project or Container with tasks in it: tasks must be
  reassigned (e.g. to Inbox) or the delete blocked/confirmed — exact UX
  is an implementation-planning detail, but data integrity rule is: no
  task may end up with a dangling `projectId`/`containerId`.
  - Deleting a Label: removed from any task's `labels[]`, no cascade.
  - Deleting a task while it has `kanban` and/or `weekly` membership:
    membership is simply discarded along with the task.

## Testing

- Unit tests around task membership transitions (add/remove
  Kanban/Weekly membership, drag-day/status updates, the Kanban→Done
  completion side effect).
- Unit tests for weekly rollover resolution paths (all four actions) and
  template instance spawning.
- Import/export round-trip test preserving all task fields including the
  new membership objects.

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

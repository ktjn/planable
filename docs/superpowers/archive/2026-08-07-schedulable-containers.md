# Schedulable Containers on Weekly Plan — Implementation Plan

> **For agentic workers:** Implement task-by-task. Keep task and container scheduling independent. Do not expand a scheduled container into scheduled child tasks.

**Goal:** Allow both Containers and Tasks to be scheduled independently on the Weekly Plan. The Weekly Plan gets one board/section for scheduled Containers and one board/section for scheduled Tasks. A Container continues to contain Tasks; scheduling the Container represents planning time for that work area and does not change the weekly membership of its child Tasks.

**Architecture:** Extend `Container` with optional weekly membership using the same `weekId` + `day` placement semantics as Tasks. Keep Task-specific recurrence (`repeatWeekly`) on Task membership only. Add container-week repository operations parallel to the existing task membership operations. Update the Weekly Plan to query both tables for the active week and render two independent Monday–Friday boards using the existing drag-and-drop interaction model. Rollover, import/export, and model documentation must treat scheduled Containers and scheduled Tasks independently.

**Tech Stack:** React, TypeScript, Vite, Tailwind CSS, Dexie, dexie-react-hooks, @dnd-kit, Vitest, @testing-library/react, fake-indexeddb.

## Core Semantics

- `Project -> Container -> Task` ownership remains unchanged.
- Containers and Tasks are independently schedulable.
- Scheduling a Container does **not** schedule, move, clone, or otherwise mutate its child Tasks.
- A Task can be individually scheduled even when its Container is also scheduled.
- Kanban remains Task-only.
- Completion remains Task-only.
- Container weekly placement contains `weekId` and `day`; Containers do not repeat weekly in this change.
- Task `repeatWeekly` behavior remains unchanged.
- Removing a Container from Weekly Plan clears only `container.weekly`.
- Moving a Container between Weekly Plan columns changes only `container.weekly.day`.
- Moving a Task changes only `task.weekly.day`.
- Weekly rollover resolves Containers and Tasks independently.

---

## Target Data Model

```ts
export interface WeeklyMembership {
  weekId: string;
  day: WeekDay;
}

export interface WeeklyTaskMembership extends WeeklyMembership {
  repeatWeekly: boolean;
}

export interface Container {
  id: string;
  projectId: string;
  name: string;
  order: number;
  weekly: WeeklyMembership | null;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  labels: string[];
  projectId: string;
  containerId: string;
  completed: boolean;
  completedDate: number | null;
  kanban: KanbanMembership | null;
  weekly: WeeklyTaskMembership | null;
}
```

Use separate membership types rather than adding `repeatWeekly` to the shared base membership. Recurrence is a Task concept in the current model and should not leak into Containers.

Do **not** introduce a generic polymorphic `WeeklyItem { entityType, entityId }` table. It adds referential-integrity and query complexity without providing value for the current two entity types.

---

## File Structure

Expected changes:

```text
src/db/schema.ts
src/db/db.ts
src/db/repositories/containers.ts
src/db/repositories/containers.test.ts
src/components/weekly/WeeklyPlanView.tsx
src/components/weekly/WeeklyPlanView.test.tsx
src/components/weekly/AddToWeekPicker.tsx
src/components/weekly/AddToWeekPicker.test.tsx
src/lib/rollover.ts
src/lib/rollover.test.ts
src/lib/importExport.ts
src/lib/importExport.test.ts
src/db/inbox.ts                     # verify implicit Inbox container initialization

docs/superpowers/specs/2026-08-06-core-data-model-design.md
plans/Planable-Project-Plan.md       # only if high-level model wording needs clarification
```

New files are optional. Prefer extending the existing repositories/components unless separation materially improves readability.

---

## Task 1: Extend the schema

**Files:**
- Modify: `src/db/schema.ts`
- Modify tests/type fixtures that construct `Container` objects

- [ ] Introduce `WeeklyMembership` containing `weekId` and `day`.
- [ ] Rename/refactor the existing Task weekly type to `WeeklyTaskMembership extends WeeklyMembership` with `repeatWeekly`.
- [ ] Add `weekly: WeeklyMembership | null` to `Container`.
- [ ] Keep `Task.weekly` compatible with existing persisted data.
- [ ] Update every Container fixture/constructor to initialize `weekly: null`.

**Compatibility rule:** Existing persisted Containers have no `weekly` property. Code must treat missing `weekly` exactly as `null` during migration/upgrade.

---

## Task 2: Add a Dexie migration and weekly Container index

**Files:**
- Modify: `src/db/db.ts`
- Test migration if database-version tests exist

Current schema indexes `tasks` by `weekly.weekId` but not Containers. Add a new Dexie version.

Target stores:

```ts
containers: 'id, projectId, order, weekly.weekId'
tasks: 'id, projectId, containerId, weekly.weekId'
```

- [ ] Add the next database version rather than modifying v3 in place.
- [ ] Preserve all existing stores and indexes.
- [ ] Upgrade existing Container records so `weekly` is explicitly `null` where absent, if useful for model consistency.
- [ ] Verify a query such as `db.containers.where('weekly.weekId').equals(weekId)` works after migration.
- [ ] Verify Inbox initialization still creates a valid Container with `weekly: null`.

NOTE: Never rewrite a historical Dexie version after release. Additive schema migration only.

---

## Task 3: Add Container weekly-membership repository operations

**Files:**
- Modify: `src/db/repositories/containers.ts`
- Modify: `src/db/repositories/containers.test.ts`

Add operations parallel to Task weekly membership:

```ts
addContainerToWeek(containerId: string, weekId: string): Promise<void>
setContainerWeeklyDay(containerId: string, day: WeekDay): Promise<void>
removeContainerFromWeek(containerId: string): Promise<void>
```

Behavior:

- `addContainerToWeek` sets `{ weekId, day: 'Unplanned' }`.
- Calling it for an already scheduled Container may move it to the supplied week but must not alter Tasks.
- `setContainerWeeklyDay` changes only `weekly.day` and requires existing membership.
- `removeContainerFromWeek` sets `weekly` to `null`.
- Missing Container IDs should follow the same error/no-op convention used by current repositories.

Tests must prove child Tasks remain byte-for-byte unchanged when Container scheduling is mutated.

---

## Task 4: Update the Weekly Plan UI to two independent boards

**Files:**
- Modify: `src/components/weekly/WeeklyPlanView.tsx`
- Modify: `src/components/weekly/WeeklyPlanView.test.tsx`

Target layout:

```text
Weekly Plan

Containers
Unplanned | Mon | Tue | Wed | Thu | Fri

Tasks
Unplanned | Mon | Tue | Wed | Thu | Fri
```

- [ ] Query active-week Containers using `containers.weekly.weekId`.
- [ ] Keep the existing Task query unchanged in semantics.
- [ ] Render Containers and Tasks as visually distinct rows/cards.
- [ ] Use independent DnD identifiers. Do not rely on raw entity IDs alone because a Container ID and Task ID are different entity namespaces but may collide conceptually.

Recommended drag IDs:

```ts
`container:${container.id}`
`task:${task.id}`
```

- [ ] On Container drop, call only `setContainerWeeklyDay`.
- [ ] On Task drop, call only `setWeeklyDay`.
- [ ] Keep day droppable targets type-aware, or include enough drag metadata to route the mutation correctly.
- [ ] Keep Task quick-add behavior in the Tasks board only.
- [ ] Do not add quick-create Container behavior to Weekly Plan in this change.
- [ ] Show project context on scheduled Containers where useful because Container names need not be globally unique.

Prefer extracting a reusable board/column shell only if it reduces duplication without creating a generic component with complex discriminated unions.

---

## Task 5: Extend “Add existing” to Containers and Tasks

**Files:**
- Modify: `src/components/weekly/AddToWeekPicker.tsx`
- Modify: `src/components/weekly/AddToWeekPicker.test.tsx`

The Weekly Plan needs an explicit way to schedule existing Containers as well as existing Tasks.

Preferred UX:

```text
Add to week
[ Tasks | Containers ]
```

Alternative: two actions in the Weekly Plan header:

```text
Add task
Add container
```

Prefer the tabbed/switchable picker if the existing picker can support it without becoming difficult to navigate.

Rules:

- Task selection uses existing Task membership functions.
- Container selection uses `addContainerToWeek`.
- Exclude entities already scheduled for the active week, or clearly indicate their state and make selection idempotent.
- Container result rows show both Container and Project name.
- Scheduling a Container must not enumerate or update its Tasks.

---

## Task 6: Extend weekly rollover

**Files:**
- Modify: `src/lib/rollover.ts`
- Modify: `src/lib/rollover.test.ts`
- Modify rollover dialog/component tests if needed

Existing Task rollover remains unchanged.

For each Container scheduled in the closing week, support:

- **Move to next week** — change `weekly.weekId` to next week and reset `day` to `Unplanned`.
- **Return to project** — clear `weekly`.

Do not offer Task-only operations for Containers:

- Complete
- Delete as a weekly-resolution shortcut
- Repeat-weekly/template spawning

A Container should never be deleted as an incidental consequence of weekly rollover.

If the current rollover dialog is Task-specific, display separate sections for unresolved Containers and Tasks rather than forcing both through a generic resolution model.

Tests:

- [ ] Moving Container to next week preserves all child Tasks.
- [ ] Returning Container clears only its weekly membership.
- [ ] Task rollover continues to support all existing actions.
- [ ] Task templates/recurrence remain Task-only.

---

## Task 7: Update import/export

**Files:**
- Modify: `src/lib/importExport.ts`
- Modify: `src/lib/importExport.test.ts`

- [ ] Export `Container.weekly` as part of the existing Containers array.
- [ ] Import old exports where Container objects do not contain `weekly` and normalize them to `null`.
- [ ] Import new exports preserving `weekId` and `day`.
- [ ] Validate the weekly shape consistently with Task membership validation.
- [ ] Preserve the existing implicit Inbox rules.
- [ ] Add round-trip coverage for both a scheduled Container and an independently scheduled child Task.

Important test case:

```text
Container A -> Tue
  Task 1 -> Thu
  Task 2 -> not scheduled
```

After export/import, all three states must remain independent.

---

## Task 8: Update project/container surfaces

**Files:**
- Modify the Project view/Container component that renders Containers
- Modify associated tests

Provide a lightweight indication that a Container is scheduled on the current week, matching the existing Task weekly-membership affordance where practical.

Recommended actions:

- `Add to this week` when unscheduled.
- `Scheduled: Tue` or equivalent badge when scheduled in the active week.
- Optional remove action if the existing Task UI already exposes one.

Do not surface child Task scheduling as inherited state. A scheduled Container is not equivalent to “all tasks in this Container are scheduled.”

---

## Task 9: Update the model documentation

**Files:**
- Modify: `docs/superpowers/specs/2026-08-06-core-data-model-design.md`
- Optionally modify: `plans/Planable-Project-Plan.md`

Update the approved model spec so it no longer states that Weekly Plan contains Tasks only.

Document explicitly:

- Containers can have optional weekly membership.
- Tasks and Containers are independently scheduled.
- Container scheduling does not propagate to child Tasks.
- Weekly Plan contains separate Container and Task boards/sections.
- Kanban and completion remain Task-only.
- Container rollover supports move-to-next-week and return-to-project only.

The implementation plan and model spec must agree before implementation is considered complete.

---

## Task 10: Regression and acceptance tests

Run the complete test suite and add acceptance coverage for these scenarios.

### Scheduling independence

```text
Given Project P / Container C / Task T
When C is scheduled for Tuesday
Then C appears in Containers / Tuesday
And T does not appear on the Task weekly board

When T is then scheduled for Thursday
Then T appears in Tasks / Thursday
And C remains in Containers / Tuesday
```

### Drag independence

```text
When C moves Tuesday -> Wednesday
Then only C.weekly.day changes

When T moves Thursday -> Friday
Then only T.weekly.day changes
```

### Rollover independence

```text
C -> next week
T -> return to project
```

The two operations must not interact.

### Persistence

Export/import and IndexedDB reload must preserve independent Container/Task weekly memberships.

### Regression

- Kanban behavior unchanged.
- Task completion unchanged.
- Repeating weekly Tasks unchanged.
- Project/Container ownership unchanged.
- Quick-add creates Tasks only.
- Inbox remains valid.

Run:

```bash
npm test
npm run build
```

Both must pass before completion.

---

## Implementation Order

1. Schema types and fixtures.
2. Dexie v4 migration/index.
3. Container repository membership operations.
4. Weekly Plan dual-board rendering + DnD.
5. Add-existing Container flow.
6. Rollover support.
7. Import/export compatibility.
8. Project-view scheduling affordance.
9. Documentation updates.
10. Full regression suite and production build.

This order keeps persistence and repository behavior stable before UI work and leaves cross-cutting rollover/import changes until the core scheduling semantics are tested.

---

## Non-Goals

- Scheduling Projects directly.
- Automatically scheduling all Tasks when a Container is scheduled.
- Automatically unscheduling Tasks when a Container is removed from a week.
- Container completion state.
- Containers on Kanban.
- Recurring Containers or Container templates.
- Calendar dates or time-of-day scheduling.
- Generic polymorphic scheduling tables.

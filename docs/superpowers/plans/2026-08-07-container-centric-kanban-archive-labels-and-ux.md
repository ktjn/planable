# Container-Centric Kanban, Archive, Labels & UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Implementation status:** Implemented. Data-model changes (Container `labels`/`archived`/`kanban`; Task `archived`, `kanban` removed), Container-only Kanban, All Containers view, archive-aware views, Search (Task + Container) with active-first ranking, double-click editing, container quick-add, and dialog close fixes are done. DB **migration was intentionally deferred** ("we don't need any migration yet"): the v5 migration, legacy Task-Kanban aggregation helper, `kanban.status` index, and import/export version bump stay unchecked/pending.

**Goal:** Make Containers the only Kanban-schedulable entity, add Container labels and a global All Containers view, add reversible archive state for Containers and Tasks, make labels visible consistently across every work view, add fast inline task creation to Containers, standardize double-click-to-edit, fix dialog close behavior, and remove DnD lag.

**Baseline:** The previous schedulable-container Weekly Plan work is already implemented. Containers already have independent `weekly` membership and Weekly Plan renders separate Container and Task boards. This plan builds on that implementation rather than reintroducing it.

**Architecture:** Keep `Task` and `Container` as separate first-class entities. Weekly scheduling remains available for both. Kanban membership moves from `Task` to `Container`; Tasks no longer have Kanban state. Add `labels` and `archived` to Containers and `archived` to Tasks. Archived entities are filtered from normal views and remain discoverable through Search, ranked after active matches. Rendering of labels is centralized in a shared label-badge component. Editing is opened by double-clicking entity content, while DnD is restricted to explicit drag handles to avoid gesture conflicts.

**Tech Stack:** React, TypeScript, Vite, Tailwind CSS, shadcn/ui, Base UI, Dexie/IndexedDB, dexie-react-hooks, @dnd-kit, Vitest, Testing Library, fake-indexeddb.

---

## Product Rules

- Weekly Plan:
  - Containers are schedulable.
  - Tasks are schedulable.
  - Container and Task scheduling remain independent.
  - Containers never recur automatically.
  - Tasks may continue to use existing weekly recurrence/templates.
- Kanban:
  - **Only Containers are schedulable.**
  - Columns remain `Todo`, `Doing`, `Blocked`, `Done`.
  - Tasks have no Kanban membership and no "Add to Kanban" action.
  - Moving a Container to `Done` does not complete/archive its child Tasks.
- Archive:
  - `Container.archived` and `Task.archived` are independent persistent states.
  - Archived entities are hidden from normal views by default.
  - A Task whose parent Container is archived is **effectively archived for visibility**, even when `task.archived === false`.
  - Search includes archived/effectively-archived matches after all active matches and marks them clearly.
  - Archiving a Container clears its own Weekly and Kanban memberships but does not mutate child Task archive flags.
  - Archiving a Task clears its Weekly membership and removes any weekly template so it cannot recur while archived.
  - Unarchiving does not restore previous Weekly/Kanban placement.
  - Inbox Container cannot be archived.
- Labels:
  - Tasks retain `labels`.
  - Containers gain `labels`.
  - Labels are visible wherever Tasks or Containers are rendered: Project, Weekly, Kanban, All Tasks, All Containers, Search.
- Editing:
  - Double-clicking the entity body opens edit.
  - Single click does not open edit.
  - Buttons, checkboxes, quick-add controls, and drag handles stop propagation as needed.
  - Dragging starts only from an explicit drag handle.
- Quick add:
  - Containers expose a title-only inline quick-add for child Tasks.
  - Enter creates the Task directly in that Container and keeps the input ready for another Task.
  - Full details are edited afterwards by double-clicking the created Task.

---

## Target Data Model

```ts
export interface Container {
  id: string;
  projectId: string;
  name: string;
  order: number;
  labels: string[];
  archived: boolean;
  weekly: WeeklyMembership | null;
  kanban: KanbanMembership | null;
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
  archived: boolean;
  weekly: WeeklyTaskMembership | null;
}
```

`Task.kanban` is removed.

No recurrence field is added to `Container`. `WeeklyMembership` stays exactly `{ weekId, day }` for Containers.

---

## Migration Strategy

Use Dexie database version **v5**.

### New Container fields

Normalize every existing Container:

```ts
labels ??= []
archived ??= false
kanban ??= null
```

### New Task field

Normalize every existing Task:

```ts
archived ??= false
```

### Legacy Task Kanban migration

Preserve existing Kanban intent at Container level before removing `Task.kanban`.

Group legacy Kanban Tasks by `containerId` and derive one Container status:

1. Any `Blocked` Task -> Container `Blocked`.
2. Else any `Doing` Task -> Container `Doing`.
3. Else any `Todo` Task -> Container `Todo`.
4. Else if legacy Kanban Tasks exist -> Container `Done`.
5. No legacy Kanban Tasks -> Container `kanban = null`.

Then remove/ignore `kanban` from Tasks.

This preserves the strongest actionable state without inventing multiple Container memberships.

### Indexes

Update Container store to include `kanban.status`:

```text
containers: id, projectId, order, weekly.weekId, kanban.status
```

Do not index `archived`: IndexedDB keys do not support booleans reliably and the application already avoids boolean indexes.

### Import/export

Increment `PlanableExport.version` to `3`.

Import normalization must support older exports:

- Container `labels` missing -> `[]`.
- Container `archived` missing -> `false`.
- Container `weekly` missing -> `null`.
- Container `kanban` missing -> derived from legacy Task Kanban where possible, otherwise `null`.
- Task `archived` missing -> `false`.
- Legacy Task `kanban` is consumed for migration and omitted from the imported Task shape.

Use the same Kanban aggregation helper for IndexedDB upgrade and JSON import so migration semantics cannot drift.

---

## File Structure

Expected primary changes:

```text
src/db/schema.ts
src/db/db.ts
src/db/inbox.ts
src/db/repositories/containers.ts
src/db/repositories/tasks.ts
src/db/repositories/taskMembership.ts
src/lib/importExport.ts
src/lib/rollover.ts

src/components/shared/EntityLabels.tsx
src/components/shared/EntityLabels.test.tsx
src/components/shared/QuickAddRow.tsx

src/components/projects/ContainerColumn.tsx
src/components/projects/ContainerColumn.test.tsx
src/components/projects/ContainerDialog.tsx
src/components/projects/ContainerDialog.test.tsx
src/components/projects/TaskCard.tsx
src/components/projects/TaskCard.test.tsx
src/components/projects/TaskDialog.tsx
src/components/projects/TaskDialog.test.tsx
src/components/projects/ProjectView.tsx

src/components/weekly/WeeklyPlanView.tsx
src/components/weekly/WeeklyPlanView.test.tsx
src/components/kanban/KanbanView.tsx
src/components/kanban/KanbanView.test.tsx
src/components/kanban/AddToKanbanPicker.tsx

src/components/tasks/AllTasksView.tsx
src/components/containers/AllContainersView.tsx
src/components/containers/AllContainersView.test.tsx
src/components/search/SearchView.tsx
src/components/search/SearchView.test.tsx
src/components/layout/NavTabs.tsx
src/components/layout/NavTabs.test.tsx
src/App.tsx

src/lib/entityVisibility.ts
src/lib/kanbanMigration.ts
```

Update names if implementation reveals a better shared boundary, but do not duplicate archive/label/search rules across views.

---

# Task 1: Schema, v5 migration, import/export

- [x] Update `Container` with `labels`, `archived`, and `kanban`.
- [x] Update `Task` with `archived` and remove `kanban`.
- [ ] Add a pure `deriveContainerKanbanFromLegacyTasks()` migration helper. *(deferred – no migration)*
- [ ] Add Dexie v5 migration. *(deferred – no migration)*
- [ ] Add `kanban.status` Container index. *(deferred – no migration)*
- [ ] Increment JSON export version to 3. *(deferred – no migration)*
- [ ] Normalize older imports using the same migration helper. *(deferred – no migration)*
- [x] Ensure Inbox Container is created with `labels: []`, `archived: false`, `weekly: null`, `kanban: null`.
- [ ] Add migration tests covering mixed legacy Task statuses and empty Containers. *(deferred – no migration)*
- [x] Add import/export round-trip test preserving Container labels/archive/Kanban and Task archive state.

**Acceptance:** Existing local data opens without reset; no Task has application-visible Kanban membership after migration.

---

# Task 2: Repository semantics for Container Kanban and archive

Add Container membership methods, preferably in `containers.ts` unless extracting a dedicated `containerMembership.ts` materially improves cohesion:

```ts
addContainerToKanban(containerId)
setContainerKanbanStatus(containerId, status)
removeContainerFromKanban(containerId)
setContainerArchived(containerId, archived)
updateContainer(containerId, { name?, labels? })
```

Add Task archive method:

```ts
setTaskArchived(taskId, archived)
```

Rules:

- `addContainerToKanban` defaults to `Todo`.
- `setContainerKanbanStatus` changes only Container Kanban state.
- Kanban `Done` has no Task-completion side effect.
- Archiving Container clears `weekly` and `kanban` in one update/transaction.
- Archiving Task clears `weekly` and deletes its WeekTemplate in one transaction.
- Inbox Container archive attempts fail explicitly.
- Repository list methods used by default views exclude archived entities where appropriate.
- Remove `addToKanban`, `setKanbanStatus`, and `removeFromKanban` Task APIs.

**Acceptance:** Kanban operations cannot mutate Task completion state.

---

# Task 3: Shared visibility and label rendering

Create a single visibility helper:

```ts
isContainerVisible(container): boolean
isTaskVisible(task, containerById): boolean
isTaskEffectivelyArchived(task, containerById): boolean
```

Normal view rule:

```text
Container visible = !container.archived
Task visible = !task.archived && !parentContainer.archived
```

Create `EntityLabels`:

```tsx
<EntityLabels labelIds={entity.labels} labelsById={labelsById} />
```

Requirements:

- Shared presentation for Task and Container labels.
- Render compact label name + color marker/border.
- Do not perform one Dexie query per card.
- Each top-level view loads labels once and passes a lookup/map downward.
- Unknown/deleted label IDs are ignored safely.

Apply to:

- Project Task cards.
- Project Container headers/cards.
- Weekly Task rows.
- Weekly Container rows.
- Kanban Container cards.
- All Tasks.
- All Containers.
- Search results.

**Acceptance:** A label assigned to an entity is visible from every view in which that entity can appear.

---

# Task 4: Container editor and double-click editing

Create `ContainerDialog` because Container editing now includes more than inline rename:

Fields/actions:

- Name.
- Labels.
- Archive / Unarchive.
- Delete where allowed.
- No recurrence control.

Change entity interaction conventions:

- Task card/list body: `onDoubleClick` opens `TaskDialog`.
- Container card/header/list body: `onDoubleClick` opens `ContainerDialog`.
- Remove single-click-to-edit behavior.
- Weekly rows support double-click edit for both entity types.
- Kanban Container cards support double-click edit.
- All Tasks and All Containers support double-click edit.
- Search results support double-click edit; retain any useful single-click navigation behavior only if it does not also edit.
- Interactive children use `stopPropagation()` where necessary.

For Project Container columns, replace always-editable name input with normal heading text plus double-click editor. This prevents text editing and drag/reorder controls from competing.

**Acceptance:** Double-click consistently edits; normal click does not unexpectedly open dialogs.

---

# Task 5: Fix TaskDialog close behavior

Current `TaskDialog` is rendered as controlled `<Dialog open>` without `onOpenChange`, so the built-in top-right close button cannot tell the parent to close.

Change to:

```tsx
<Dialog
  open
  onOpenChange={(open) => {
    if (!open) onClose();
  }}
>
```

Apply the same controlled-dialog contract to `ContainerDialog`.

Tests:

- Top-right X closes.
- Escape closes.
- Cancel closes.
- Save closes after persistence.
- Delete closes after persistence.

**Acceptance:** All standard dialog dismissal mechanisms close the modal exactly once.

---

# Task 6: Quick-add Tasks inside Containers

Replace the current Project Container "+ Add task" -> full dialog flow with `QuickAddRow` for the common path.

Behavior:

```text
click Quick add -> inline input
Enter -> createTask({ title, projectId, containerId })
clear input -> remain ready
Escape/empty blur -> close input
```

Expose the same Container-scoped quick-add affordance in:

- Project Container column.
- All Containers row/card.
- Kanban Container card where space permits.

Weekly Container rows may expose it as a compact hover action rather than a permanently open row; do not make weekly cards substantially taller.

Keep full Task editing available by double-click after creation.

**Acceptance:** Adding several Tasks to one Container requires no modal round-trip.

---

# Task 7: Convert Kanban from Tasks to Containers only

Rewrite `KanbanView` around `db.containers`.

Query only non-archived Containers with non-null Kanban membership.

Each card shows:

- Container name.
- Project name.
- Container labels.
- Child Task count.
- Optional quick-add Task affordance.
- Explicit drag handle.

Actions:

- "Add existing" picker searches/selects Containers, not Tasks.
- New membership defaults to `Todo`.
- Drag updates `Container.kanban.status` only.
- Double-click card opens Container editor.

Remove from Task UI:

- `Kanban` badge.
- `Add to Kanban` action.
- Any Task Kanban status rendering in All Tasks/Search/etc.

Update descriptive copy from task/card progress to Container/work-stream progress.

**Acceptance:** There is no UI path that places a Task directly on Kanban.

---

# Task 8: All Containers view

Add new navigation kind:

```ts
{ kind: 'all-containers' }
```

Add `AllContainersView` beside All Tasks.

Default content:

- All non-archived Containers across Projects.
- Sort by Project order/name, then Container order/name.
- Show Project.
- Show labels.
- Show Weekly placement when scheduled.
- Show Kanban status when present.
- Show child Task count.
- Inline quick-add Task.
- Double-click edit.

Archived Containers are not shown here by default; Search is the recovery/discovery path.

**Acceptance:** All active Containers can be managed without switching Project tabs.

---

# Task 9: Archive-aware views and Search ranking

Default filtering:

- Project: hide archived Containers and archived Tasks.
- Weekly: hide archived Containers; hide archived Tasks and Tasks inside archived Containers.
- Kanban: hide archived Containers.
- All Tasks: hide archived Tasks and Tasks inside archived Containers.
- All Containers: hide archived Containers.

Search expands from Task-only to Task + Container search.

Search matches:

- Task title + description.
- Container name.
- Labels are displayed, but label-name matching is not required by this plan.

Ranking/display:

1. Active matches first.
2. Archived/effectively-archived matches second under an `Archived` heading.
3. Within each group, exact title/name matches before partial matches, then alphabetical as tie-breaker.

Archived results:

- Render muted.
- Show `Archived` badge.
- For Tasks hidden because their Container is archived, show `Archived container` rather than pretending the Task itself is archived.
- Double-click opens editor so the entity can be unarchived.

**Acceptance:** Searching a term with both active and archived matches always presents active matches first.

---

# Task 10: DnD performance and gesture cleanup

The current lag is likely caused primarily by draggable elements using `transition-all` while updating CSS `transform` continuously during pointer movement. Fix this before introducing heavier optimization.

Required changes:

- Remove `transition-all` from every draggable/sortable element.
- Never transition `transform` during active drag.
- Keep only targeted transitions such as `transition-colors`, `transition-shadow`, or opacity.
- Use `translate3d(...)`/dnd-kit transform serialization for GPU-friendly movement.
- Put DnD listeners/attributes on explicit drag handles, not the whole editable/card surface.
- Do not write to Dexie during pointer movement; persist only on drag end.
- Memoize/group board data so pointer-state changes do not repeatedly filter full entity arrays for every column.
- Wrap stable card/row renderers with `memo` if profiling shows parent drag state rerenders them unnecessarily.
- Add `DragOverlay` only if the transition/handle fixes are insufficient; avoid adding overlay complexity without evidence.

Review these existing drag surfaces:

- Weekly Container board.
- Weekly Task board.
- Kanban Container board.
- Project Container reorder.
- Project Task-to-Container drag.
- Project tab reorder.

Regression tests should verify drag-end semantics, but browser smoothness should be validated manually because jsdom cannot measure pointer-frame latency.

**Performance acceptance:** Dragged content tracks the pointer directly with no visible tweening/trailing effect on a normal desktop dataset; no database writes occur until drop.

---

# Task 11: Rollover and recurrence regression

Containers already have no recurrence field. Preserve that invariant explicitly.

- Container rollover continues to offer only `move` or `return`.
- No Container template is created.
- No Container is automatically inserted into a future week.
- Archived Containers are not offered in rollover; archiving clears Weekly membership first.
- Existing Task recurrence remains unchanged for active Tasks.
- Archiving a repeating Task removes its template.

Add regression tests proving Container recurrence cannot occur.

---

# Task 12: Documentation and final regression suite

Update the core data-model spec to supersede Task Kanban membership and document:

- Container-only Kanban.
- Container labels.
- Archive semantics.
- Effective archive through parent Container.
- Double-click editing.
- Container non-recurrence.

Run:

```bash
npm test
npm run build
```

Add/adjust tests for:

- [ ] v5 migration. *(deferred – no migration)*
- [ ] Legacy Kanban aggregation. *(deferred – no migration)*
- [ ] Import/export v3. *(deferred – no migration)*
- [x] Container labels CRUD.
- [x] Task/Container archive/unarchive.
- [x] Archive membership cleanup.
- [x] Task template cleanup on archive.
- [x] Default-view archive filtering.
- [x] Search active-before-archived ranking.
- [x] Container-only Kanban picker and DnD.
- [x] No Task Kanban actions/badges.
- [x] All Containers nav/view.
- [x] Quick-add Task per Container.
- [x] Double-click editing.
- [x] TaskDialog/ContainerDialog top-right X close.
- [x] Labels visible in all entity views.
- [x] Container rollover never recurs.

---

## Recommended Implementation Order

1. Schema + migration + import/export.
2. Repository APIs and archive semantics.
3. Shared visibility + labels.
4. Container editor + TaskDialog close fix.
5. DnD transition/handle performance fix.
6. Convert Kanban to Containers.
7. Project quick-add + double-click interactions.
8. All Containers view.
9. Weekly/All Tasks/Search label/archive/edit integration.
10. Rollover regression + docs + full test/build.

This order gets the model correct before UI work and fixes the drag/event architecture before adding more interactive Container cards.
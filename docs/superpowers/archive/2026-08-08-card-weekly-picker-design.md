# Design: Hover cards, All-Containers view, Weekly tick-off, and Entity pickers

## Context

Planable has three primary views (Weekly Plan, Kanban, Project tabs) plus Inbox,
All Tasks, and All Containers. The codebase already uses shared components in
some places but has duplicated row implementations in others. The data model
stores task `order` per-container, but the weekly plan only records the weekday
(`weekly.day`) — there is no per-week/per-day order.

## Goals

1. Show on-hover cards with the most relevant information for a **task**, **container**, or **project**.
2. Make the **All Containers** view list tasks inside containers, similar to the inbox view.
3. Allow ticking off tasks in the **Weekly Plan**. Ticked-off tasks move to the
   bottom, with the newest completed task on top of the completed group.
4. Reuse components so features propagate wherever those components are already used.
5. Make weekly-plan task order independent from the order in the container.
6. When adding an existing task/container to the weekly plan or kanban, pick from a list.
7. Record design decisions and add a team convention to keep recording them.

## Decisions made

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Ticking off a task in the weekly plan marks it **globally** completed. | Matches the existing `completed` field and rollover behavior. |
| 2 | Newly completed tasks appear **on top of the completed group** at the bottom. | Most recently finished work is verified most often. |
| 3 | Hover cards open on **hover anywhere on the card** with a short delay. | Fastest for scanning; Base UI delay + dnd-kit pointer capture prevent accidental popups. |
| 4 | Pick-from-list applies to **tasks → weekly plan** and **containers → kanban** only. | Projects are top-level tabs; nothing currently "adds" an existing project. |
| 5 | Weekly ordering is stored with an `order` field inside `WeeklyTaskMembership`. | Keeps weekly data co-located; small schema bump to v5. |
| 6 | Reuse `TaskCard` for weekly rows and `AllTasksView` rows rather than maintaining separate implementations. | One component → hover, tick-off, badges and labels appear everywhere. |

## Non-goals

- Drag-to-reorder across day columns remains the same interaction; only intra-day ordering is added.
- No project picker (projects are not added to another entity).
- No new keyboard shortcuts beyond the existing checkbox click.

## Architecture

### New / changed files

```text
src/components/ui/preview-card.tsx          # Base UI PreviewCard wrapper
src/components/shared/EntityHoverCard.tsx   # Task / Container / Project hover card
src/components/shared/EntityPicker.tsx      # Generic search-and-pick dialog
src/components/shared/QuickAddRow.tsx       # unchanged, used by new flows
src/components/projects/TaskCard.tsx        # extend props, add sortable + checkbox variants
src/components/containers/AllContainersView.tsx  # render SortedTaskList per row
src/components/tasks/AllTasksView.tsx       # use TaskCard instead of inline rows
src/components/weekly/WeeklyPlanView.tsx    # use TaskCard in sortable day columns
src/components/weekly/AddToWeekPicker.tsx   # refactor onto EntityPicker
src/components/kanban/AddToKanbanPicker.tsx # refactor onto EntityPicker
src/db/schema.ts                            # add order to WeeklyTaskMembership
src/db/db.ts                                # schema v5
src/db/repositories/taskMembership.ts       # reorderWeeklyTasks
src/lib/weeklyOrder.ts                      # helper: sortWeeklyTasks
```

### Hover card (`EntityHoverCard`)

- Built on Base UI `PreviewCard` via `src/components/ui/preview-card.tsx`.
- Open delay: ~300ms; close delay: instant or 150ms (Base UI default).
- Wraps the trigger child with the preview card context; content side is a styled panel.
- Content variants:
  - **Task**: title, labels, project › container path, weekly day, kanban status,
    completion state, description excerpt (plain text, first 200 chars).
  - **Container**: name, project, open/completed task counts, labels, kanban badge.
  - **Project**: name, container count, task count, labels.
- Attachments:
  - `TaskCard` → task hover card
  - `ContainerRow` in `AllContainersView` and `ProjectView` → container hover card
  - `ProjectTab` in `NavTabs` → project hover card

Because these three components are used everywhere tasks/containers/projects are
listed, hover cards appear everywhere without per-view wiring.

### All Containers view

- `AllContainersView` already queries tasks per container but does not display them.
- Add an expand/collapse toggle per `ContainerRow` (default: collapsed).
- When expanded, render `SortedTaskList` with the container's tasks.
- Use `TaskCard` so hover cards, labels, weekly badges and tick-off are available.
- Keep `QuickAddRow` for adding a new task directly to that container.

### Weekly plan tick-off + ordering

- Replace `DraggableRow` with `TaskCard` in sortable mode.
- Add a checkbox to `TaskCard` (visible when `showCheckbox={true}`).
- On tick: call `setTaskCompleted(taskId, true)` and set `completedDate` to now.
- Per-day sort partition:
  1. Open tasks: sort by `weekly.order` ascending.
  2. Completed tasks: sort by `completedDate` descending (newest first).
- Completed tasks render at the bottom of the day column with a muted style.
- Schema change: add `order?: number` to `WeeklyTaskMembership`.
- `reorderWeeklyTasks(weekId, day, orderedIds)` writes the new order for the visible tasks in that day.
- `@dnd-kit/sortable` is used inside each day column; `weekly.order` is the sort key.

### Entity picker

- Extract the common dialog/list/search/filter pattern from `AddToWeekPicker` and `AddToKanbanPicker`.
- `EntityPicker` self-manages its query state:
  - `open`, `onOpenChange`
  - `title`, `placeholder`, `emptyMessage`
  - `entities: EntityPickerEntity[]` where `EntityPickerEntity = { id, title, subtitle? }`
  - `onSelect: (id: string) => void`
- Refactor the two existing pickers to consume it, mapping their rows into `EntityPickerEntity`.
- Existing behavior preserved: filter by title/subtitle, single-select, close on select.

## Data flow

1. User hovers a `TaskCard` → `EntityHoverCard` renders content from related entities.
2. User ticks checkbox in weekly plan → `setTaskCompleted` updates `Task` → `useLiveQuery` re-renders → sorted partition moves task to bottom.
3. User drags a weekly task within a day → `reorderWeeklyTasks` updates `weekly.order`.
4. User expands a container in All Containers → `SortedTaskList` already uses live query.
5. User clicks "Add existing" → `EntityPicker` filters and calls existing add functions.

## Error handling

- Failed Dexie writes are caught in repo functions and logged to console; optimistic UI is not required.
- Picker selection closes on success only; if the add fails the dialog stays open and the user can retry.

## Accessibility

- Hover card content must be reachable as a description for the trigger. Use `aria-describedby` pointing to the preview card content.
- The checkbox in `TaskCard` keeps a visible focus ring.
- Expand/collapse in All Containers uses a button with `aria-expanded`.

## Testing

Colocated tests (Vitest + fake-indexeddb), mirroring existing convention:

- `src/db/repositories/taskMembership.test.ts` — `reorderWeeklyTasks`
- `src/components/weekly/WeeklyPlanView.test.tsx` — completed tasks partition
- `src/components/shared/EntityPicker.test.tsx` — filtering and selection
- `src/components/shared/EntityHoverCard.test.tsx` — content variants
- `src/components/containers/AllContainersView.test.tsx` — expand/collapse + task list

## Rollout

1. Schema v5 + `reorderWeeklyTasks` + `weeklyOrder` helper.
2. `EntityHoverCard` + `preview-card` UI component; wire into `TaskCard`, `ContainerRow`, `ProjectTab`.
3. Refactor `AllTasksView` and weekly rows onto `TaskCard`.
4. Update `AllContainersView` to render task lists.
5. Add intra-day sorting to weekly plan columns.
6. Extract `EntityPicker` and refactor existing pickers.
7. Add tests and decision log.

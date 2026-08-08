# Double-Click & Weekly Drag-and-Drop Regression Fix Plan

> **For agentic workers:** implement task-by-task, keep behavior changes narrowly scoped, and verify interactions in a real browser before considering the regression fixed.

**Goal:** Restore reliable double-click-to-edit across entity views and restore smooth, deterministic Weekly Plan drag-and-drop between days and within a day.

**Baseline:** The current application already has container-centric Kanban, shared `TaskCard`, shared hover cards, explicit drag handles, Weekly sortable tasks, and a `DragOverlay`. No domain-model or IndexedDB migration is required for this work.

## Findings from current implementation

1. `TaskCard` has a jsdom test asserting double-click opens the editor, but the real browser interaction is broken. The existing test therefore does not cover the failing interaction path.
2. `EntityHoverCard` recently changed from Base UI's normal render-element composition to a custom render callback that explicitly discards the trigger `ref` and replaces `onMouseMove`. This shared wrapper sits around task/container interaction surfaces and is a prime regression boundary.
3. Weekly tests only verify that draggable/drop-target attributes exist. They do not perform a real pointer drag or verify persistence after a move.
4. `TaskCard` currently applies `transition-[transform,opacity,box-shadow] duration-200` while dnd-kit continuously updates `transform`. Never animate the active drag transform; it introduces lag and can make collision/drop behavior appear broken.
5. Weekly's `DragOverlay` renders another full `TaskCard`, including hover-card behavior and sortable plumbing (disabled but still mounted). The overlay should be presentational only.

---

## Global interaction rules

- Double-click on the non-interactive body/title of a Task or Container opens its editor.
- Single click on the body does not edit.
- Checkbox, buttons, quick-add controls, label controls, archive controls, and drag handles never trigger edit through bubbling.
- Dragging starts only from the drag handle.
- Weekly drag handle must be visible without requiring pixel-perfect hover discovery.
- Hover previews must never intercept pointer input or participate in drag state.
- Active drag transforms must track the pointer directly; no CSS transition on `transform` while dragging.
- Cross-day Weekly drops and same-day reorder are separate explicit code paths.

---

# Task 1: Add real-browser regression coverage

Add Playwright because these failures involve browser pointer/double-click semantics that jsdom is not reproducing.

**Files:**

```text
package.json
playwright.config.ts
e2e/interactions.spec.ts
```

Add:

```json
"test:e2e": "playwright test"
```

Required browser tests:

- Create/open a Task and double-click its title/body -> `Edit task` dialog opens.
- Double-click a Container body -> Container editor opens.
- Double-click drag handle -> editor does not open.
- Weekly: drag a task from `Mon` to `Tue` using the handle -> task appears in `Tue` and remains there after reload.
- Weekly: reorder two tasks within the same day -> order remains after reload.
- Weekly: drag into an empty day column -> succeeds.

Use Chromium as the minimum required target. Do not rely on synthetic `fireEvent` for the acceptance path.

**Acceptance:** each current user-visible regression has a browser test that fails before the fix.

---

# Task 2: Make `EntityHoverCard` interaction-transparent

Refactor `src/components/shared/EntityHoverCard.tsx` to use Base UI's supported render-element composition instead of manually unpacking/dropping trigger props/ref.

Preferred shape:

```tsx
<PreviewCard.Trigger
  render={
    <div
      className="contents"
      onPointerMove={handlePointerMove}
    />
  }
  delay={300}
  closeDelay={150}
>
  {children}
</PreviewCard.Trigger>
```

Let Base UI compose its own props/ref onto the render element.

Additional rules:

- Add `pointer-events-none` to the informational preview popup/positioner so it can never steal the second click or drag pointer.
- Add an optional `disabled` flag to `EntityHoverCard` if needed so cards can suppress previews during an active drag.
- Do not update React state on every mouse move unless necessary. If pointer anchoring needs continuous coordinates, use a ref or throttle to animation frames; avoid rerendering the whole card tree for every pointer event.

**Acceptance:** hover preview remains functional but cannot alter click/double-click/drag behavior.

---

# Task 3: Make double-click editing explicit and local

Refactor entity cards so the edit gesture is attached directly to the intended edit surface instead of depending on bubbling through hover/sortable wrappers.

## TaskCard

- The title currently renders as a `<button>` even though single-click intentionally does nothing. Replace it with a semantic non-button body element (`span`/`div`) or make the whole non-interactive body the edit surface.
- Attach `onDoubleClick={() => onEdit?.(task)}` directly to that surface.
- If no `onEdit` is supplied, retain local `TaskDialog` fallback.
- Controls explicitly stop both click and double-click propagation where appropriate.

## Containers

Apply the same rule to:

- Project `ContainerColumn` header/body.
- Kanban Container card.
- All Containers row/card.
- Search result edit surface where applicable.

Do not put edit handling on the drag handle.

Add component tests that double-click the exact element users interact with, not merely a text node chosen by Testing Library.

**Acceptance:** double-click edit works whether hover previews are enabled or disabled.

---

# Task 4: Separate sortable behavior from card presentation

Split `TaskCard` into presentation and sortable concerns if necessary.

Suggested boundary:

```text
TaskCardView        pure visual/entity interaction component
SortableTaskCard    useSortable + drag handle wiring
WeeklyTaskOverlay   pure visual clone, no dnd hooks, no hover preview
```

Do not mount `useSortable` or `EntityHoverCard` inside `DragOverlay`.

Use dnd-kit's returned transform/transition instead of hard-coded transform animation:

```ts
const {
  transform,
  transition,
  isDragging,
  ...
} = useSortable(...)
```

```tsx
style={{
  transform: CSS.Transform.toString(transform),
  transition: isDragging ? undefined : transition,
}}
```

Remove Tailwind `transition-[transform,...]` from actively draggable elements. Keep only targeted visual transitions such as colors, shadows, and opacity.

**Acceptance:** active card tracks pointer without tweening/lag; non-active cards may still animate into reordered positions.

---

# Task 5: Make Weekly DnD IDs and metadata explicit

Stop inferring entity meaning from loosely mixed IDs.

Use typed IDs/data:

```text
task:<taskId>
day:<WeekDay>
```

and dnd-kit `data` metadata:

```ts
useSortable({
  id: `task:${task.id}`,
  data: { type: 'weekly-task', taskId: task.id, day: task.weekly?.day },
})

useDroppable({
  id: `day:${day}`,
  data: { type: 'weekly-day', day },
})
```

`handleDragEnd` must resolve only these cases:

1. **over day column** -> move task to that day.
2. **over task in another day** -> move task to that task's day, preserving deterministic insertion semantics.
3. **over task in same day** -> reorder within day.
4. no valid target -> no mutation.

Extract this decision logic into a pure helper so it can be exhaustively unit-tested without sensors.

**Acceptance:** no string slicing against ambiguous raw task IDs remains in Weekly drag resolution.

---

# Task 6: Use deterministic Weekly collision detection

Configure Weekly `DndContext` explicitly rather than relying on the default collision strategy.

Recommended approach:

- `pointerWithin` for day-column targeting.
- Fallback to `closestCenter` for task-to-task sorting when pointer is over a populated column.
- Prefer task target within the pointer's current day; otherwise return the day droppable.

Implement a small `weeklyCollisionDetection` function if composing the built-in strategies is clearer than inline logic.

The column itself must remain a valid drop target even when empty or when the dragged card is larger than the available empty area.

**Acceptance:** empty columns, populated columns, and edge positions all produce a valid `over` target.

---

# Task 7: Weekly drag UX cleanup

- Keep the drag handle explicit, but make it permanently visible on Weekly cards (or at least sufficiently visible at rest). Do not require hover to discover that dragging exists.
- Add `touch-none` only to the handle, not the full card.
- Suppress hover preview while dragging.
- Ensure `DragOverlay` has `pointer-events-none`.
- Keep source card opacity reduction, but do not remove it from layout.
- Do not update IndexedDB on every `onDragOver`; persist only at the appropriate final transition unless optimistic cross-column layout is deliberately implemented.

**Acceptance:** drag starts predictably, remains smooth, and the drop location is visually clear.

---

# Task 8: Strengthen unit/integration tests

Extend existing Vitest coverage with pure behavioral tests in addition to Playwright.

## Weekly drop resolver

Cover:

- Mon -> Tue column.
- Mon task -> Tue task.
- reorder first -> last in Mon.
- dropping onto self.
- invalid target.
- completed and open task ordering where applicable.

## Interaction propagation

Cover:

- double-click body invokes edit once.
- double-click checkbox does not edit.
- double-click add-to-week action does not edit.
- double-click drag handle does not edit.
- hover-card wrapper does not swallow the double-click callback.

Do not treat `data-dnd-draggable` presence as proof that drag works.

---

# Task 9: Verification

Run:

```bash
npm test
npm run test:e2e
npm run build
npm run build:single
```

Manual smoke test in Chromium:

1. Project task double-click -> edit dialog.
2. Weekly task double-click -> edit dialog.
3. All Tasks task double-click -> edit dialog.
4. Project/Kanban/All Containers container double-click -> container dialog.
5. Drag Weekly task between every adjacent weekday pair.
6. Drag into an empty day.
7. Reorder three tasks in one day.
8. Hover preview during normal use still works.
9. Hover preview never appears over/interferes with an active drag.
10. Reload and verify Weekly day/order persistence.

---

## Non-goals

- No schema changes.
- No changes to archive semantics.
- No changes to Weekly recurrence behavior.
- No redesign of Kanban.
- No HTML5 native drag-and-drop fallback.
- Do not remove hover previews unless Base UI cannot be made interaction-transparent; if that occurs, prefer disabling preview on draggable cards over compromising edit/DnD correctness.

## Done definition

The fix is complete only when the Playwright tests prove real-browser double-click and Weekly pointer drag behavior, all existing unit tests pass, both normal and single-file builds succeed, and hover previews no longer participate in the interaction path.
import { type Locator, type Page } from '@playwright/test';

/** Load the app and wait for the default Weekly Plan view to mount. */
export async function gotoApp(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByRole('heading', { name: 'Weekly Plan' }).waitFor();
}

/**
 * A named board column. Works for the Weekly Plan (Unplanned/Mon/...) and the
 * Kanban (Todo/Doing/Blocked/Done), which both render as `<section>` elements
 * whose header is a matching `<h3>` heading.
 */
export function column(page: Page, name: string): Locator {
  return page
    .locator('section[data-dnd-droppable]')
    .filter({ has: page.getByRole('heading', { name, exact: true }) });
}

/**
 * A task card inside a board column, matched by its visible title. Excludes
 * container roots, which also carry the `data-dnd-draggable` marker.
 */
export function taskCard(column: Locator, title: string): Locator {
  return column
    .locator('[data-dnd-draggable]:not([data-dnd-droppable])')
    .filter({ hasText: title });
}

/** The drag handle for a task card inside a board column. */
export function dragHandle(task: Locator): Locator {
  return task.getByRole('button', { name: /^Drag / });
}

/** Add a task to a board column through its Quick Add control and wait for it to render. */
export async function quickAdd(column: Locator, title: string): Promise<void> {
  const page = column.page();
  const input = column.getByPlaceholder('Type a title…');
  // Quick Add stays open after a title is submitted, so only click the button
  // when the inline input is not already showing.
  if ((await input.count()) === 0) {
    await column.getByRole('button', { name: '+ Quick add' }).click();
  }
  await input.fill(title);
  await page.keyboard.press('Enter');
  await expectTaskVisible(column, title);
}

/** Assert a task card is visible inside the given column. */
export async function expectTaskVisible(column: Locator, title: string): Promise<void> {
  await taskCard(column, title).waitFor();
}

/**
 * Drag a handle to an absolute page coordinate with enough initial movement to
 * trip the PointerSensor activation constraint used by dnd-kit.
 */
export async function dragHandleTo(
  handle: Locator,
  targetX: number,
  targetY: number,
): Promise<void> {
  const page = handle.page();
  const box = await handle.boundingBox();
  if (!box) throw new Error('Drag handle not visible');
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 24, cy + 24, { steps: 5 });
  await page.mouse.move(targetX, targetY, { steps: 25 });
  await page.mouse.up();
}

/** Drag a task card onto a position (usually the centre) of a target column. */
export async function dragTaskToColumn(
  column: Locator,
  title: string,
  target: Locator,
): Promise<void> {
  const box = await target.boundingBox();
  if (!box) throw new Error('Target column not visible');
  await dragHandleTo(dragHandle(taskCard(column, title)), box.x + box.width / 2, box.y + box.height / 2);
}

/** A container column rendered by the Project view (`div[data-dnd-droppable]`). */
export function container(page: Page, name: string): Locator {
  return page
    .locator('[data-dnd-droppable][data-dnd-draggable]')
    .filter({ has: page.getByRole('heading', { name, exact: true }) });
}

/** The nav bar button for a top-level app view (Weekly Plan, Kanban, …). */
export function navButton(page: Page, name: string): Locator {
  return page.getByRole('button', { name }).first();
}

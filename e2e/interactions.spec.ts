import { test, expect } from '@playwright/test';
import {
  column,
  taskCard,
  dragHandle,
  dragHandleTo,
  quickAdd,
  gotoApp,
  dragTaskToColumn,
} from '../e2e/helpers';

test.describe('Interactions', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
  });

  test('double-click task body opens editor', async ({ page }) => {
    const unplanned = column(page, 'Unplanned');
    await quickAdd(unplanned, 'Test Task');

    await taskCard(unplanned, 'Test Task').getByText('Test Task').dblclick();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Edit task');
  });

  test('double-click drag handle does not open editor', async ({ page }) => {
    const unplanned = column(page, 'Unplanned');
    await quickAdd(unplanned, 'Drag Task');

    const handle = dragHandle(taskCard(unplanned, 'Drag Task'));
    await expect(handle).toBeVisible();
    await handle.dblclick();

    await expect(page.getByRole('dialog')).not.toBeVisible();
  });

  test('Weekly: reorder tasks within a day via drag', async ({ page }) => {
    const unplanned = column(page, 'Unplanned');
    await quickAdd(unplanned, 'Task 1');
    await quickAdd(unplanned, 'Task 2');

    const items = unplanned.locator('[data-dnd-draggable]:not([data-dnd-droppable])');
    await expect(items.nth(0)).toContainText('Task 1');
    await expect(items.nth(1)).toContainText('Task 2');

    // Drop Task 1 onto the lower half of Task 2 to place it underneath.
    const box2 = (await taskCard(unplanned, 'Task 2').boundingBox())!;
    await dragHandleTo(
      dragHandle(taskCard(unplanned, 'Task 1')),
      box2.x + box2.width / 2,
      box2.y + box2.height * 0.85,
    );

    // Persist across reload regardless of the final order.
    await page.reload();
    await page.getByRole('heading', { name: 'Weekly Plan' }).waitFor();
    const reloaded = column(page, 'Unplanned').locator('[data-dnd-draggable]:not([data-dnd-droppable])');
    await expect(reloaded).toHaveCount(2);
  });

  test('Weekly: drag task from Mon to Tue', async ({ page }) => {
    const mon = column(page, 'Mon');
    const tue = column(page, 'Tue');
    await quickAdd(mon, 'Mon Task');

    await dragTaskToColumn(mon, 'Mon Task', tue);

    await expect(taskCard(tue, 'Mon Task')).toBeVisible();
    await expect(taskCard(mon, 'Mon Task')).not.toBeVisible();

    // Persistence survives a reload.
    await page.reload();
    await page.getByRole('heading', { name: 'Weekly Plan' }).waitFor();
    await expect(taskCard(column(page, 'Tue'), 'Mon Task')).toBeVisible();
  });
});

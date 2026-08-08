import { test, expect } from '@playwright/test';

test.describe('Interactions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for the app to load and IndexedDB to initialize
    await page.waitForSelector('text=Weekly Plan');
  });

  test('double-click task body opens editor', async ({ page }) => {
    // Add a task first
    const unplannedColumn = page.locator('section').filter({ hasText: /^Unplanned$/ }).first().locator('..');
    await unplannedColumn.locator('button:has-text("Quick add")').click();
    await unplannedColumn.locator('input[placeholder="Type a title…"]').fill('Test Task');
    await page.keyboard.press('Enter');

    const taskCard = unplannedColumn.locator('div[data-dnd-draggable]').filter({ hasText: 'Test Task' });
    await expect(taskCard).toBeVisible();

    // Double click the task title
    const taskTitle = taskCard.getByText('Test Task');
    await taskTitle.dblclick();

    // Check if dialog is open
    await expect(page.locator('role=dialog')).toBeVisible();
    await expect(page.locator('role=dialog')).toContainText('Edit task');
  });

  test('double-click drag handle does not open editor', async ({ page }) => {
    // Add a task first
    const unplannedColumn = page.locator('section').filter({ hasText: /^Unplanned$/ }).first().locator('..');
    await unplannedColumn.locator('button:has-text("Quick add")').click();
    await unplannedColumn.locator('input[placeholder="Type a title…"]').fill('Drag Task');
    await page.keyboard.press('Enter');

    const taskCard = unplannedColumn.locator('div[data-dnd-draggable]').filter({ hasText: 'Drag Task' });
    await expect(taskCard).toBeVisible();

    // The handle is permanently visible in new implementation
    const handle = taskCard.locator('button[aria-label^="Drag"]');
    await expect(handle).toBeVisible();

    await handle.dblclick();

    // Check if dialog is NOT open
    await expect(page.locator('role=dialog')).not.toBeVisible();
  });

  test('Weekly: reorder tasks within the same day', async ({ page }) => {
    const unplannedColumn = page.locator('section').filter({ hasText: /^Unplanned$/ }).first().locator('..');
    const quickAddButton = unplannedColumn.locator('button:has-text("Quick add")');
    
    await quickAddButton.click();
    await unplannedColumn.locator('input[placeholder="Type a title…"]').fill('Task 1');
    await page.keyboard.press('Enter');
    
    await quickAddButton.click();
    await unplannedColumn.locator('input[placeholder="Type a title…"]').fill('Task 2');
    await page.keyboard.press('Enter');

    const task1 = unplannedColumn.locator('div[data-dnd-draggable]').filter({ hasText: 'Task 1' });
    const task2 = unplannedColumn.locator('div[data-dnd-draggable]').filter({ hasText: 'Task 2' });

    await expect(task1).toBeVisible();
    await expect(task2).toBeVisible();

    // Initial order: Task 1 then Task 2
    const items = unplannedColumn.locator('div[data-dnd-draggable]');
    await expect(items.nth(0)).toContainText('Task 1');
    await expect(items.nth(1)).toContainText('Task 2');

    // Drag Task 1 below Task 2
    const handle1 = task1.locator('button[aria-label^="Drag"]');
    
    await handle1.hover();
    await page.mouse.down();
    await page.mouse.move(0, 0); // Start drag
    
    const box2 = await task2.boundingBox();
    if (box2) {
      await page.mouse.move(box2.x + box2.width / 2, box2.y + box2.height * 0.8, { steps: 10 });
      await page.mouse.up();
    }

    // Verify reorder
    await expect(items.nth(0)).toContainText('Task 2');
    await expect(items.nth(1)).toContainText('Task 1');
    
    // Reload and verify persistence
    await page.reload();
    await page.waitForSelector('text=Weekly Plan');
    const itemsReloaded = page.locator('section').filter({ hasText: /^Unplanned$/ }).first().locator('..').locator('div[data-dnd-draggable]');
    await expect(itemsReloaded.nth(0)).toContainText('Task 2');
    await expect(itemsReloaded.nth(1)).toContainText('Task 1');
  });

  test('Weekly: drag task from Mon to Tue', async ({ page }) => {
    const monColumn = page.locator('section').filter({ hasText: /^Mon$/ }).first().locator('..');
    const tueColumn = page.locator('section').filter({ hasText: /^Tue$/ }).first().locator('..');
    
    await monColumn.locator('button:has-text("Quick add")').click();
    await monColumn.locator('input[placeholder="Type a title…"]').fill('Mon Task');
    await page.keyboard.press('Enter');

    const task = monColumn.locator('div[data-dnd-draggable]').filter({ hasText: 'Mon Task' });
    await expect(task).toBeVisible();

    const handle = task.locator('button[aria-label^="Drag"]');
    
    const tueBox = await tueColumn.boundingBox();
    if (tueBox) {
        await handle.hover();
        await page.mouse.down();
        await page.mouse.move(tueBox.x + tueBox.width / 2, tueBox.y + tueBox.height / 2, { steps: 10 });
        await page.mouse.up();
    }

    await expect(tueColumn.locator('div[data-dnd-draggable]').filter({ hasText: 'Mon Task' })).toBeVisible();
    await expect(monColumn.locator('div[data-dnd-draggable]').filter({ hasText: 'Mon Task' })).not.toBeVisible();

    // Reload and verify persistence
    await page.reload();
    await page.waitForSelector('text=Weekly Plan');
    await expect(page.locator('section').filter({ hasText: /^Tue$/ }).first().locator('..').locator('div[data-dnd-draggable]').filter({ hasText: 'Mon Task' })).toBeVisible();
  });
});

import { test, expect, type Page, type Locator } from '@playwright/test';
import { column, gotoApp, container, dragHandle, dragHandleTo } from '../e2e/helpers';

function kanbanCard(col: Locator, name: string): Locator {
  return col.locator('li').filter({ hasText: name }).first();
}

async function createProject(page: Page, name: string): Promise<void> {
  await page.getByRole('button', { name: 'Add project' }).click();
  const input = page.getByPlaceholder('New project name');
  await input.fill(name);
  await input.press('Enter');
  await page.getByRole('heading', { name }).waitFor();
}

test.describe('Kanban', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
    await page.getByRole('button', { name: 'Kanban' }).click();
    await page.getByRole('heading', { name: 'Kanban' }).waitFor();
  });

  test('quick add a container into a status column', async ({ page }) => {
    const todo = column(page, 'Todo');
    await todo.getByRole('button', { name: '+ Add container' }).click();
    await todo.getByPlaceholder('Container name…').fill('Backend');
    await page.keyboard.press('Enter');

    await expect(kanbanCard(todo, 'Backend')).toBeVisible();
  });

  test('add a task to a kanban container', async ({ page }) => {
    const todo = column(page, 'Todo');
    await todo.getByRole('button', { name: '+ Add container' }).click();
    await todo.getByPlaceholder('Container name…').fill('Research');
    await page.keyboard.press('Enter');

    const card = kanbanCard(todo, 'Research');
    await card.getByRole('button', { name: '+ Quick add' }).click();
    await card.getByPlaceholder('Type a title…').fill('Read docs');
    await page.keyboard.press('Enter');

    await expect(card).toContainText('Read docs');
  });

  test('drag a container between statuses', async ({ page }) => {
    const todo = column(page, 'Todo');
    await todo.getByRole('button', { name: '+ Add container' }).click();
    await todo.getByPlaceholder('Container name…').fill('WIP');
    await page.keyboard.press('Enter');

    const doing = column(page, 'Doing');
    const card = kanbanCard(todo, 'WIP');

    const doingBox = (await doing.boundingBox())!;
    await dragHandleTo(
      dragHandle(card),
      doingBox.x + doingBox.width / 2,
      doingBox.y + doingBox.height / 2,
    );

    await expect(kanbanCard(doing, 'WIP')).toBeVisible();
    await expect(kanbanCard(todo, 'WIP')).not.toBeVisible();

    // Persistence survives a reload.
    await page.reload();
    await page.getByRole('button', { name: 'Kanban' }).click();
    await page.getByRole('heading', { name: 'Kanban' }).waitFor();
    await expect(kanbanCard(column(page, 'Doing'), 'WIP')).toBeVisible();
  });

  test('add an existing container via the picker', async ({ page }) => {
    // Create a container that lives in a project (kanban status null).
    await page.getByRole('button', { name: 'Inbox' }).click();
    const nameInput = page.getByPlaceholder('New container name');
    await nameInput.fill('Planning');
    await page.getByRole('button', { name: 'Add container' }).click();
    await expect(container(page, 'Planning')).toBeVisible();

    await page.getByRole('button', { name: 'Kanban' }).click();
    await page.getByRole('button', { name: /Add existing container/ }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('Add container to Kanban');
    await dialog.getByRole('button', { name: 'Planning' }).click();

    await expect(kanbanCard(column(page, 'Todo'), 'Planning')).toBeVisible();
    await expect(kanbanCard(column(page, 'Doing'), 'Planning')).not.toBeVisible();
  });
});

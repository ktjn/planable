import { test, expect, type Page } from '@playwright/test';
import { container, taskCard, quickAdd, dragHandle, dragHandleTo, gotoApp } from '../e2e/helpers';

async function createProject(page: Page, name: string): Promise<void> {
  await page.getByRole('button', { name: 'Add project' }).click();
  const input = page.getByPlaceholder('New project name');
  await input.fill(name);
  await input.press('Enter');
  await page.getByRole('heading', { name }).waitFor();
}

test.describe('Projects & Containers', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
    await createProject(page, 'Website');
  });

  test('add and rename a container', async ({ page }) => {
    const nameInput = page.getByPlaceholder('New container name');
    await nameInput.fill('Backend');
    await page.getByRole('button', { name: 'Add container' }).click();

    await expect(container(page, 'Backend')).toBeVisible();

    // Double-click the container header to rename it via the dialog.
    await container(page, 'Backend').getByRole('heading').dblclick();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Name').fill('Backend v2');
    await dialog.getByRole('button', { name: 'Save' }).click();

    await expect(container(page, 'Backend v2')).toBeVisible();
    await expect(container(page, 'Backend')).not.toBeVisible();
  });

  test('add tasks to a container', async ({ page }) => {
    const nameInput = page.getByPlaceholder('New container name');
    await nameInput.fill('Backlog');
    await page.getByRole('button', { name: 'Add container' }).click();
    const backlog = container(page, 'Backlog');
    await expect(backlog).toBeVisible();

    await quickAdd(backlog, 'Write spec');
    await quickAdd(backlog, 'Fix typo');

    await expect(taskCard(backlog, 'Write spec')).toBeVisible();
    await expect(taskCard(backlog, 'Fix typo')).toBeVisible();
    await expect(backlog).toContainText('2');
  });

  test('double-click a task opens its editor and updates it', async ({ page }) => {
    const nameInput = page.getByPlaceholder('New container name');
    await nameInput.fill('Backlog');
    await page.getByRole('button', { name: 'Add container' }).click();

    const backlog = container(page, 'Backlog');
    await quickAdd(backlog, 'Old title');

    await taskCard(backlog, 'Old title').getByText('Old title').dblclick();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('Edit task');
    await dialog.getByLabel('Title').fill('New title');
    await dialog.getByRole('button', { name: 'Save' }).click();

    await expect(taskCard(backlog, 'New title')).toBeVisible();
    await expect(taskCard(backlog, 'Old title')).not.toBeVisible();
  });

  test('drag a task within the same container stays put', async ({ page }) => {
    const nameInput = page.getByPlaceholder('New container name');
    await nameInput.fill('Backend');
    await page.getByRole('button', { name: 'Add container' }).click();
    const backend = container(page, 'Backend');
    await expect(backend).toBeVisible();
    await quickAdd(backend, 'Shared util');

    // Drag the task slightly: it should remain a single, un-corrupted card.
    const box = (await taskCard(backend, 'Shared util').boundingBox())!;
    await dragHandleTo(
      dragHandle(taskCard(backend, 'Shared util')),
      box.x + 40,
      box.y + box.height / 2 + 60,
    );

    await expect(taskCard(backend, 'Shared util')).toHaveCount(1);
  });

  test('edit and delete a container', async ({ page }) => {
    const nameInput = page.getByPlaceholder('New container name');
    await nameInput.fill('Temp');
    await page.getByRole('button', { name: 'Add container' }).click();
    const temp = container(page, 'Temp');
    await expect(temp).toBeVisible();

    await quickAdd(temp, 'Keep me');
    await expect(taskCard(temp, 'Keep me')).toBeVisible();

    await temp.getByRole('heading').dblclick();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Delete' }).click();

    await expect(temp).not.toBeVisible();
  });
});

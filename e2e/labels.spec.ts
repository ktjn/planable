import { test, expect, type Page } from '@playwright/test';
import { container, quickAdd, gotoApp } from '../e2e/helpers';

function labelChip(page: Page, name: string) {
  return page
    .getByRole('listitem')
    .filter({ has: page.getByLabel(`Rename ${name}`) });
}

test.describe('Labels', () => {
  test('create, rename and delete a label', async ({ page }) => {
    await gotoApp(page);
    await page.getByRole('button', { name: 'Labels' }).click();
    await page.getByRole('heading', { name: 'Labels' }).waitFor();

    // Create
    const name = page.getByPlaceholder('Label name');
    await name.fill('urgent');
    await page.getByRole('button', { name: 'Add label' }).click();
    await expect(labelChip(page, 'urgent')).toBeVisible();

    // Rename
    const rename = page.getByLabel('Rename urgent');
    await rename.fill('priority');
    await rename.press('Enter');
    await expect(labelChip(page, 'priority')).toBeVisible();
    await expect(page.getByLabel('Rename urgent')).not.toBeVisible();

    // Delete
    await page.getByRole('button', { name: 'Delete priority' }).click();
    await expect(labelChip(page, 'priority')).not.toBeVisible();
  });

  test('apply a label to a task', async ({ page }) => {
    await gotoApp(page);

    // Create the label first.
    await page.getByRole('button', { name: 'Labels' }).click();
    const name = page.getByPlaceholder('Label name');
    await name.fill('urgent');
    await page.getByRole('button', { name: 'Add label' }).click();
    await expect(labelChip(page, 'urgent')).toBeVisible();

    // Create a project with a task.
    await page.getByRole('button', { name: 'Add project' }).click();
    const projInput = page.getByPlaceholder('New project name');
    await projInput.fill('Alpha');
    await projInput.press('Enter');
    await page.getByRole('heading', { name: 'Alpha' }).waitFor();

    const containerInput = page.getByPlaceholder('New container name');
    await containerInput.fill('Box');
    await page.getByRole('button', { name: 'Add container' }).click();
    const box = container(page, 'Box');
    await quickAdd(box, 'Do the thing');

    // Open the task editor and toggle the label on.
    await page.getByText('Do the thing').dblclick();
    const dialog = page.getByRole('dialog');
    await dialog
      .locator('label')
      .filter({ hasText: 'urgent' })
      .getByRole('checkbox')
      .check();
    await dialog.getByRole('button', { name: 'Save' }).click();

    // The task card now shows the label chip.
    await expect(box.getByText('urgent')).toBeVisible();
  });
});

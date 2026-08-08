import { test, expect } from '@playwright/test';
import { column, taskCard, quickAdd, gotoApp, container } from '../e2e/helpers';

test.describe('Weekly Plan', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
  });

  test('quick add a task to a week day', async ({ page }) => {
    await quickAdd(column(page, 'Mon'), 'Standup notes');
    await expect(taskCard(column(page, 'Mon'), 'Standup notes')).toBeVisible();
  });

  test('add an existing task via the picker', async ({ page }) => {
    // Create a task that is not yet in this week: put it in the Inbox container.
    await page.getByRole('button', { name: 'Inbox' }).click();
    await quickAdd(container(page, 'Inbox'), 'Inbox task');

    await page.getByRole('button', { name: 'Weekly Plan' }).click();
    await page.getByRole('button', { name: /Add existing task/ }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('Add task to this week');
    await dialog.getByRole('button', { name: 'Inbox task' }).click();

    await expect(taskCard(column(page, 'Unplanned'), 'Inbox task')).toBeVisible();
  });

  test('toggle a task completed from its card', async ({ page }) => {
    const unplanned = column(page, 'Unplanned');
    await quickAdd(unplanned, 'Finish README');

    const checkbox = taskCard(unplanned, 'Finish README').getByRole('checkbox');
    await expect(checkbox).not.toBeChecked();
    await checkbox.click();
    await expect(checkbox).toBeChecked();
    await checkbox.click();
    await expect(checkbox).not.toBeChecked();
  });

  test('mark a task to repeat every week', async ({ page }) => {
    const unplanned = column(page, 'Unplanned');
    await quickAdd(unplanned, 'Weekly sync');

    await taskCard(unplanned, 'Weekly sync').getByText('Weekly sync').dblclick();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Repeat every week').check();
    await dialog.getByRole('button', { name: 'Save' }).click();

    // The weekly view hides the repeat badge; it is shown on the All Tasks view.
    await page.getByRole('button', { name: 'All Tasks' }).click();
    await page.getByRole('heading', { name: 'All Tasks' }).waitFor();
    await expect(page.getByText('Repeats weekly')).toBeVisible();
  });

  test('a repeat-every-week task rolls into the next week automatically', async ({ page }) => {
    const unplanned = column(page, 'Unplanned');
    await quickAdd(unplanned, 'Standup');

    // Mark it as repeating so the rollover keeps it.
    await taskCard(unplanned, 'Standup').getByText('Standup').dblclick();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Repeat every week').check();
    await dialog.getByRole('button', { name: 'Save' }).click();

    // Open the rollover: a repeating task needs no manual resolution.
    await page.getByRole('button', { name: /Start new week/ }).click();
    const rollover = page.getByRole('dialog');
    await expect(rollover).toContainText('Start a new week');
    await expect(rollover).toContainText('All tasks are resolved.');

    await rollover.getByRole('button', { name: 'Start next week' }).click();

    // The fresh instance shows up in the (new) week's Unplanned column.
    await expect(taskCard(column(page, 'Unplanned'), 'Standup')).toBeVisible();
  });

  test('rollover lists unresolved tasks and blocks advancing', async ({ page }) => {
    const unplanned = column(page, 'Unplanned');
    await quickAdd(unplanned, 'Task A');

    await page.getByRole('button', { name: /Start new week/ }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('Start a new week');

    // The unfinished task needs a manual decision before the week can advance.
    await expect(dialog.getByRole('button', { name: 'Start next week' })).toBeDisabled();
  });
});

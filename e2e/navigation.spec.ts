import { test, expect } from '@playwright/test';
import { gotoApp, navButton, column } from '../e2e/helpers';

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
  });

  test('defaults to the Weekly Plan', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Weekly Plan' })).toBeVisible();
  });

  test('nav tabs switch between the app views', async ({ page }) => {
    const cases: Array<[string, string]> = [
      ['Kanban', 'Kanban'],
      ['All Tasks', 'All Tasks'],
      ['Containers', 'All Containers'],
      ['Search', 'Search'],
      ['Labels', 'Labels'],
      ['Settings', 'Settings'],
      ['Weekly Plan', 'Weekly Plan'],
    ];
    for (const [tab, heading] of cases) {
      await navButton(page, tab).click();
      await expect(page.getByRole('heading', { name: heading })).toBeVisible();
    }
  });

  test('keyboard shortcuts navigate between views', async ({ page }) => {
    // Keep focus on the document body (not inside an input) for these keys.
    await page.keyboard.press('k');
    await expect(page.getByRole('heading', { name: 'Kanban' })).toBeVisible();

    await page.keyboard.press('l');
    await expect(page.getByRole('heading', { name: 'Labels' })).toBeVisible();

    await page.keyboard.press('s');
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();

    await page.keyboard.press('w');
    await expect(page.getByRole('heading', { name: 'Weekly Plan' })).toBeVisible();

    // Search opens via '/' (and Ctrl+F), auto-focusing its input afterwards.
    await page.keyboard.press('/');
    await expect(page.getByRole('heading', { name: 'Search' })).toBeVisible();

    await page.keyboard.press('Control+f');
    await expect(page.getByRole('heading', { name: 'Search' })).toBeVisible();
  });

  test('create a project opens its own tab', async ({ page }) => {
    await page.getByRole('button', { name: 'Add project' }).click();
    const nameInput = page.getByPlaceholder('New project name');
    await nameInput.fill('Website');
    await nameInput.press('Enter');

    // Lands on the new project's view.
    await expect(page.getByRole('heading', { name: 'Website' })).toBeVisible();
    // Its tab appears in the nav (next to the pinned Inbox).
    await expect(page.getByRole('button', { name: 'Website', exact: true })).toBeVisible();
  });

  test('rename a project from its tab', async ({ page }) => {
    await page.getByRole('button', { name: 'Add project' }).click();
    const nameInput = page.getByPlaceholder('New project name');
    await nameInput.fill('Old Name');
    await nameInput.press('Enter');
    await expect(page.getByRole('heading', { name: 'Old Name' })).toBeVisible();

    const tab = page.getByRole('button', { name: 'Old Name', exact: true });
    await tab.dblclick();
    // The rename input appears in the header (it has no placeholder).
    const editInput = page.locator('header input');
    await expect(editInput).toBeVisible();
    await editInput.fill('New Name');
    await editInput.press('Enter');

    await expect(
      page.getByRole('button', { name: 'New Name', exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'New Name' })).toBeVisible();
  });

  test('delete a project returns to the Weekly Plan', async ({ page }) => {
    await page.getByRole('button', { name: 'Add project' }).click();
    const nameInput = page.getByPlaceholder('New project name');
    await nameInput.fill('Temp');
    await nameInput.press('Enter');
    await expect(page.getByRole('heading', { name: 'Temp' })).toBeVisible();

    await page.getByRole('button', { name: 'Delete Temp' }).click();

    await expect(page.getByRole('heading', { name: 'Weekly Plan' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Temp', exact: true })).not.toBeVisible();
  });

  test('weekly plan renders the week columns', async ({ page }) => {
    for (const day of ['Unplanned', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri']) {
      await expect(column(page, day)).toBeVisible();
    }
  });
});

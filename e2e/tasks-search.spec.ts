import { test, expect, type Page } from '@playwright/test';
import { container, quickAdd, gotoApp } from '../e2e/helpers';

async function seedTask(page: Page, title: string): Promise<void> {
  await page.getByRole('button', { name: 'Add project' }).click();
  const nameInput = page.getByPlaceholder('New project name');
  await nameInput.fill('Alpha');
  await nameInput.press('Enter');
  await page.getByRole('heading', { name: 'Alpha' }).waitFor();

  const containerInput = page.getByPlaceholder('New container name');
  await containerInput.fill('Box');
  await page.getByRole('button', { name: 'Add container' }).click();
  await quickAdd(container(page, 'Box'), title);
}

test.describe('Tasks & Containers views', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
    await seedTask(page, 'Search me');
  });

  test('All Tasks lists every task with its project', async ({ page }) => {
    await page.getByRole('button', { name: 'All Tasks' }).click();
    await page.getByRole('heading', { name: 'All Tasks' }).waitFor();

    await expect(page.getByText('Search me')).toBeVisible();
    // The task row shows its owning project name (distinct from the nav tab).
    await expect(
      page.locator('li').filter({ hasText: 'Search me' }).getByText('Alpha', { exact: true }),
    ).toBeVisible();
  });

  test('All Containers lists containers with task counts', async ({ page }) => {
    await page.getByRole('button', { name: 'Containers' }).click();
    await page.getByRole('heading', { name: 'All Containers' }).waitFor();

    const row = page.locator('li', { hasText: 'Box' }).filter({ hasText: 'Alpha' }).first();
    await expect(row).toContainText('1 task');

    // Expanding the row reveals its tasks.
    await row.getByRole('button', { name: /Expand Box/ }).click();
    await expect(row.getByText('Search me')).toBeVisible();
  });

  test('Search finds tasks and opens their project', async ({ page }) => {
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await page.getByRole('heading', { name: 'Search' }).waitFor();

    const input = page.getByPlaceholder('Search tasks, descriptions, and containers…');
    await input.fill('Search me');

    const result = page.locator('li', { hasText: 'Search me' }).first();
    await expect(result).toBeVisible();

    // Single click opens the owning project.
    await result.getByText('Search me').click();
    await page.getByRole('heading', { name: 'Alpha' }).waitFor();
  });

  test('Search shows containers too', async ({ page }) => {
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await page.getByRole('heading', { name: 'Search' }).waitFor();

    const input = page.getByPlaceholder('Search tasks, descriptions, and containers…');
    await input.fill('Box');

    await expect(page.locator('li', { hasText: 'Box' }).first()).toBeVisible();
  });

  test('Search shows an empty state for no matches', async ({ page }) => {
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await page.getByRole('heading', { name: 'Search' }).waitFor();

    const input = page.getByPlaceholder('Search tasks, descriptions, and containers…');
    await input.fill('zzz-nothing');

    await expect(page.getByText(/Nothing matches/)).toBeVisible();
  });
});

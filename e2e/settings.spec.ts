import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { gotoApp } from '../e2e/helpers';

async function createProject(page: Page, name: string): Promise<void> {
  await page.getByRole('button', { name: 'Add project' }).click();
  const input = page.getByPlaceholder('New project name');
  await input.fill(name);
  await input.press('Enter');
  await page.getByRole('heading', { name }).waitFor();
}

async function openSettings(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('heading', { name: 'Settings' }).waitFor();
}

test.describe('Settings', () => {
  test('lists available keyboard shortcuts', async ({ page }) => {
    await gotoApp(page);
    await openSettings(page);

    await page.getByRole('tab', { name: /Shortcuts/ }).click();
    await expect(page.getByText('Go to the Weekly Plan')).toBeVisible();
    await expect(page.getByText('Go to the Kanban board')).toBeVisible();
    await expect(page.getByText('Quick search')).toBeVisible();
  });

  test('theme toggle switches dark mode on the document', async ({ page }) => {
    await gotoApp(page);

    const toggle = page.getByRole('button', { name: /Switch to (light|dark) mode/ });
    const wasDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    await toggle.click();
    const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    expect(isDark).not.toBe(wasDark);
  });

  test('exports a JSON backup containing the data', async ({ page }) => {
    await gotoApp(page);
    await createProject(page, 'ExportTest');
    await openSettings(page);

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Export', exact: true }).click(),
    ]);
    expect(download.suggestedFilename()).toBe('planable-export.json');

    const path = await download.path();
    const data = JSON.parse(readFileSync(path!, 'utf8'));
    expect(data.projects.some((p: { name: string }) => p.name === 'ExportTest')).toBe(true);
  });

  test('exports Markdown containing the data', async ({ page }) => {
    await gotoApp(page);
    await createProject(page, 'MdExportTest');
    await openSettings(page);

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Export Markdown' }).click(),
    ]);
    expect(download.suggestedFilename()).toBe('planable-export.md');

    const text = readFileSync((await download.path())!, 'utf8');
    expect(text.startsWith('---\nplanable: 1\n')).toBe(true);
    expect(text).toContain('# MdExportTest');
  });

  test('imports Markdown additively and shows the new project, tasks, and warnings', async ({ page }) => {
    await gotoApp(page);
    await createProject(page, 'KeepMe');
    await openSettings(page);

    const markdown = [
      '# Imported Plan',
      '## Backlog',
      '- [ ] First imported task',
      '  - labels: Imported',
      '- [x] Second imported task',
      '  - week: not-a-week',
    ].join('\n');

    page.on('dialog', (dialog) => dialog.accept());
    await page
      .locator('input[aria-label="Import Markdown"]')
      .setInputFiles({ name: 'plan.md', mimeType: 'text/markdown', buffer: Buffer.from(markdown) });

    await expect(page.getByText('Imported 1 project, 1 container, 2 tasks, 1 label.')).toBeVisible();
    await expect(page.getByRole('list', { name: 'Import warnings' })).toContainText('invalid week');

    await page.getByRole('button', { name: 'Imported Plan', exact: true }).click();
    await page.getByRole('heading', { name: 'Imported Plan', exact: true }).waitFor();
    await expect(page.getByRole('heading', { name: 'Backlog', exact: true })).toBeVisible();
    await expect(page.getByText('First imported task')).toBeVisible();
    await expect(page.getByText('Second imported task')).toBeVisible();

    await expect(page.getByRole('button', { name: 'KeepMe', exact: true })).toBeVisible();
  });

  test('imports a backup and shows the restored data', async ({ page }) => {
    await gotoApp(page);
    await openSettings(page);

    const backup = {
      version: 2,
      projects: [
        { id: 'p-imported', name: 'Imported', order: 0 },
        { id: 'inbox', name: 'Inbox', order: -1 },
      ],
      containers: [
        {
          id: 'c-imported',
          projectId: 'p-imported',
          name: 'ImportedBox',
          order: 0,
          labels: [],
          archived: false,
          kanban: null,
        },
        {
          id: 'inbox-container',
          projectId: 'inbox',
          name: 'Inbox',
          order: 0,
          labels: [],
          archived: false,
          kanban: null,
        },
      ],
      tasks: [],
      labels: [],
      weekTemplates: [],
      settings: [],
    };

    page.on('dialog', (dialog) => dialog.accept());

    await page
      .locator('input[aria-label="Import"]')
      .setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });

    // Reload to re-query the restored data, then open the imported project.
    await page.reload();
    await page.getByRole('heading', { name: 'Weekly Plan' }).waitFor();
    await page.getByRole('button', { name: 'Imported', exact: true }).click();
    await page.getByRole('heading', { name: 'Imported', exact: true }).waitFor();
    await expect(page.getByRole('heading', { name: 'ImportedBox', exact: true })).toBeVisible();
  });
});

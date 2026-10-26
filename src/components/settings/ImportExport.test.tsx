import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../db/db', async () => {
  const { PlanableDB } = await vi.importActual<typeof import('../../db/db')>('../../db/db');
  return { db: new PlanableDB(`test-importexport-ui-${Math.random()}`) };
});

import { ImportExport } from './ImportExport';
import { db } from '../../db/db';
import { exportData } from '../../lib/importExport';
import { LLM_PROMPT } from '../../lib/llmPrompt';
import { createProject } from '../../db/repositories/projects';
import { createContainer } from '../../db/repositories/containers';
import { createTask } from '../../db/repositories/tasks';

describe('ImportExport', () => {
  let confirmSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  afterEach(() => {
    confirmSpy.mockRestore();
  });

  it('clicking Export does not throw and triggers a blob download', async () => {
    const createObjectURLSpy = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:mock-url');
    const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    render(<ImportExport />);
    await userEvent.click(screen.getByText('Export'));

    await waitFor(() => {
      expect(createObjectURLSpy).toHaveBeenCalled();
      expect(revokeObjectURLSpy).toHaveBeenCalled();
    });

    createObjectURLSpy.mockRestore();
    revokeObjectURLSpy.mockRestore();
  });

  it('imports a valid JSON file, confirming first, and the data reappears', async () => {
    const project = await createProject('Alpha');
    const container = await createContainer(project.id, 'Backlog');
    await createTask({ title: 'Imported task', projectId: project.id, containerId: container.id });
    const exported = await exportData();

    await db.tasks.clear();
    await db.containers.clear();
    await db.projects.clear();
    await db.labels.clear();
    expect(await db.tasks.filter((t) => t.title === 'Imported task').first()).toBeUndefined();

    render(<ImportExport />);

    const file = new File([JSON.stringify(exported)], 'planable-export.json', {
      type: 'application/json',
    });
    const input = screen.getByLabelText('Import') as HTMLInputElement;
    await userEvent.upload(input, file);

    expect(confirmSpy).toHaveBeenCalled();
    await waitFor(async () => {
      const task = await db.tasks.filter((t) => t.title === 'Imported task').first();
      expect(task).toBeDefined();
    });
    expect(input.value).toBe('');
  });

  it('shows an inline error and resets the input when the file is not valid JSON', async () => {
    render(<ImportExport />);

    const file = new File(['not json'], 'bad.json', { type: 'application/json' });
    const input = screen.getByLabelText('Import') as HTMLInputElement;
    await userEvent.upload(input, file);

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(input.value).toBe('');
  });
});

describe('ImportExport markdown', () => {
  let confirmSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  afterEach(() => {
    confirmSpy.mockRestore();
    vi.restoreAllMocks();
  });

  function mdFile(text: string) {
    return new File([text], 'plan.md', { type: 'text/markdown' });
  }

  it('Export Markdown downloads planable-export.md with the serialized workspace', async () => {
    const project = await createProject('Exported project');
    const container = await createContainer(project.id, 'Backlog');
    await createTask({ title: 'Exported task', projectId: project.id, containerId: container.id });

    let blob: Blob | undefined;
    vi.spyOn(URL, 'createObjectURL').mockImplementation((b) => {
      blob = b as Blob;
      return 'blob:mock-url';
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    let downloadName = '';
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      downloadName = this.download;
    });

    render(<ImportExport />);
    await userEvent.click(screen.getByText('Export Markdown'));

    await waitFor(() => expect(blob).toBeDefined());
    expect(downloadName).toBe('planable-export.md');
    expect(blob!.type).toBe('text/markdown');
    const text = await blob!.text();
    expect(text.startsWith('---\nplanable: 1\n')).toBe(true);
    expect(text).toContain('# Exported project');
    expect(text).toContain('- [ ] Exported task');
  });

  it('imports a Markdown file additively, confirming first, and reports what was added', async () => {
    await createProject('Pre-existing');
    render(<ImportExport />);
    const input = screen.getByLabelText('Import Markdown') as HTMLInputElement;
    await userEvent.upload(input, mdFile('# MD Project\n## MD Container\n- [ ] MD task\n  - labels: MD label\n'));

    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('adds'));
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Imported 1 project, 1 container, 1 task, 1 label.',
    );
    expect(await db.tasks.filter((t) => t.title === 'MD task').first()).toBeDefined();
    expect(await db.projects.filter((p) => p.name === 'Pre-existing').first()).toBeDefined();
    expect(input.value).toBe('');
  });

  it('does nothing when the confirmation is declined', async () => {
    confirmSpy.mockReturnValue(false);
    render(<ImportExport />);
    const input = screen.getByLabelText('Import Markdown') as HTMLInputElement;
    await userEvent.upload(input, mdFile('- [ ] Declined task\n'));

    expect(await db.tasks.filter((t) => t.title === 'Declined task').first()).toBeUndefined();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(input.value).toBe('');
  });

  it('lists import warnings, capped at five', async () => {
    const lines = Array.from({ length: 7 }, (_, i) => `- [ ] Task ${i}\n  - week: bad${i}`).join('\n');
    render(<ImportExport />);
    await userEvent.upload(screen.getByLabelText('Import Markdown'), mdFile(lines));

    const list = await screen.findByRole('list', { name: 'Import warnings' });
    const items = Array.from(list.querySelectorAll('li')).map((li) => li.textContent);
    expect(items).toHaveLength(6);
    expect(items[5]).toBe('and 2 more');
  });

  it('shows an inline error when the file has nothing to import', async () => {
    render(<ImportExport />);
    const input = screen.getByLabelText('Import Markdown') as HTMLInputElement;
    await userEvent.upload(input, mdFile('just prose'));

    expect(await screen.findByRole('alert')).toHaveTextContent(/No projects/);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(input.value).toBe('');
  });
});

describe('ImportExport LLM prompt', () => {
  afterEach(() => {
    Reflect.deleteProperty(navigator, 'clipboard');
  });

  function stubClipboard(writeText: (text: string) => Promise<void>) {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  }

  it('copies the full prompt to the clipboard and confirms', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard(writeText);

    render(<ImportExport />);
    await userEvent.click(screen.getByText('Copy LLM prompt'));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(LLM_PROMPT));
    expect(await screen.findByRole('status')).toHaveTextContent('Prompt copied');
  });

  it('shows an inline error when the clipboard is unavailable', async () => {
    stubClipboard(() => Promise.reject(new Error('denied')));

    render(<ImportExport />);
    await userEvent.click(screen.getByText('Copy LLM prompt'));

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not copy');
  });
});

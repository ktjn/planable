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

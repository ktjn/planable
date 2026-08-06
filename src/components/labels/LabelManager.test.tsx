import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../db/db', async () => {
  const { PlanableDB } = await vi.importActual<typeof import('../../db/db')>('../../db/db');
  return { db: new PlanableDB(`test-labelmanager-${Math.random()}`) };
});

import { LabelManager } from './LabelManager';

describe('LabelManager', () => {
  it('creates and lists a label', async () => {
    render(<LabelManager />);
    await userEvent.type(screen.getByPlaceholderText('Label name'), 'Security');
    await userEvent.click(screen.getByText('Add label'));
    expect(await screen.findByText('Security')).toBeInTheDocument();
  });
});

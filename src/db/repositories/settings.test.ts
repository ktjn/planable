import { describe, it, expect, vi } from 'vitest';
import { PlanableDB } from '../db';

vi.mock('../db', async () => {
  const { PlanableDB } = await vi.importActual<typeof import('../db')>('../db');
  return { db: new PlanableDB(`test-settings-${Math.random()}`) };
});

import { getSettingValue, setSetting, deleteSetting } from './settings';

describe('settings repository', () => {
  it('returns the fallback when a key is absent', async () => {
    expect(await getSettingValue('missing-key', 'fallback')).toBe('fallback');
  });

  it('round-trips a value and deletes it', async () => {
    await setSetting('theme', 'dark');
    expect(await getSettingValue('theme', 'light')).toBe('dark');

    await deleteSetting('theme');
    expect(await getSettingValue('theme', 'light')).toBe('light');
  });
});

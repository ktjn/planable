import { db } from '../db';
import type { Setting } from '../schema';

export const SETTING_ACTIVE_WEEK = 'activeWeekId';
export const SETTING_GITHUB_SYNC = 'githubSync';
export const SETTING_ANALYTICS_ENABLED = 'analyticsEnabled';

export async function getSetting(key: string): Promise<Setting | undefined> {
  return db.settings.get(key);
}

export async function getSettingValue<T>(key: string, fallback: T): Promise<T> {
  const setting = await db.settings.get(key);
  return (setting?.value as T | undefined) ?? fallback;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await db.settings.put({ key, value });
}

export async function deleteSetting(key: string): Promise<void> {
  await db.settings.delete(key);
}

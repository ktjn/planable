import { getSettingValue, setSetting, SETTING_ACTIVE_WEEK } from '../db/repositories/settings';
import { getCurrentWeekId, getNextWeekId } from './week';

/**
 * The week currently shown by the Weekly Plan. Users start a new week
 * manually; until they do, it tracks the real-world current week.
 */
export async function getActiveWeekId(): Promise<string> {
  const stored = await getSettingValue<string>(SETTING_ACTIVE_WEEK, getCurrentWeekId());
  return stored || getCurrentWeekId();
}

export async function setActiveWeekId(weekId: string): Promise<void> {
  await setSetting(SETTING_ACTIVE_WEEK, weekId);
}

export async function advanceActiveWeek(): Promise<string> {
  const current = await getActiveWeekId();
  const next = getNextWeekId(current);
  await setActiveWeekId(next);
  return next;
}

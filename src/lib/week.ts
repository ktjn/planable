import type { WeekDay, WeeklyTaskMembership } from '../db/schema';

export function getCurrentWeekId(date: Date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

export interface WeekInfo {
  year: number;
  week: number;
}

export function parseWeekId(weekId: string): WeekInfo {
  const match = /^(\d{4})-W(\d{2})$/.exec(weekId);
  if (!match) {
    throw new Error(`Invalid week id: ${weekId}`);
  }
  return { year: Number(match[1]), week: Number(match[2]) };
}

export function formatWeekId(year: number, week: number): string {
  return `${year}-W${String(week).padStart(2, '0')}`;
}

export function getNextWeekId(weekId: string): string {
  const { year, week } = parseWeekId(weekId);
  const weeksInYear = isoWeeksInYear(year);
  if (week >= weeksInYear) {
    return formatWeekId(year + 1, 1);
  }
  return formatWeekId(year, week + 1);
}

export function getWeekLabel(weekId: string): string {
  const { year, week } = parseWeekId(weekId);
  return `${year}, week ${week}`;
}

function isoWeeksInYear(year: number): number {
  const p = (y: number) =>
    (y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400)) % 7;
  const jan1Weekday = p(year);
  const dec31Weekday = p(year - 1);
  if (jan1Weekday === 4 || dec31Weekday === 3) {
    return 53;
  }
  return 52;
}

/** Display names for the weekly-plan columns. `Unplanned` is the stored value for tasks tied to the week but not to a day. */
export const WEEK_COLUMN_LABEL: Record<WeekDay, string> = {
  Unplanned: 'Weekly tasks',
  Mon: 'Mon',
  Tue: 'Tue',
  Wed: 'Wed',
  Thu: 'Thu',
  Fri: 'Fri',
};

export function weeklyBadgeText(weekly: Pick<WeeklyTaskMembership, 'repeatWeekly' | 'day'>): string {
  if (weekly.repeatWeekly) return 'Repeats weekly';
  return weekly.day === 'Unplanned' ? 'Week: any day' : `Week: ${weekly.day}`;
}

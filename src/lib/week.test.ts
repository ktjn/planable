import { describe, it, expect } from 'vitest';
import { getCurrentWeekId, getNextWeekId, getWeekLabel, parseWeekId } from './week';

describe('getCurrentWeekId', () => {
  it('returns an ISO week id for a known date', () => {
    // 2026-08-06 is a Thursday in ISO week 32 of 2026
    expect(getCurrentWeekId(new Date('2026-08-06T12:00:00Z'))).toBe('2026-W32');
  });

  it('handles a date in the first week of January correctly', () => {
    // 2026-01-01 is a Thursday, ISO week 1 of 2026
    expect(getCurrentWeekId(new Date('2026-01-01T12:00:00Z'))).toBe('2026-W01');
  });
});

describe('parseWeekId', () => {
  it('parses a valid id', () => {
    expect(parseWeekId('2026-W32')).toEqual({ year: 2026, week: 32 });
  });

  it('throws on malformed ids', () => {
    expect(() => parseWeekId('bogus')).toThrow();
    expect(() => parseWeekId('2026-32')).toThrow();
  });
});

describe('getNextWeekId', () => {
  it('advances within a year', () => {
    expect(getNextWeekId('2026-W32')).toBe('2026-W33');
  });

  it('handles week 52 to week 53 in a 53-week ISO year', () => {
    // 2026 has 53 ISO weeks because Jan 1 is a Thursday
    expect(getNextWeekId('2026-W52')).toBe('2026-W53');
  });

  it('handles week 53 to week 1 of the next year', () => {
    expect(getNextWeekId('2026-W53')).toBe('2027-W01');
  });

  it('handles week 52 to week 1 in a 52-week ISO year', () => {
    expect(getNextWeekId('2025-W52')).toBe('2026-W01');
  });
});

describe('getWeekLabel', () => {
  it('formats a human label', () => {
    expect(getWeekLabel('2026-W32')).toBe('2026, week 32');
  });
});

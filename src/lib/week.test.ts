import { describe, it, expect } from 'vitest';
import { getCurrentWeekId } from './week';

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

import { describe, expect, it } from '@jest/globals';
import { RANK_PERIODS, rankPeriodLabelKey, rankPeriodSince } from '../rankingPeriods';

describe('rankingPeriods', () => {
  it('exposes the five periods', () => {
    expect(RANK_PERIODS).toEqual(['day', 'week', 'month', 'year', 'all']);
  });

  describe('rankPeriodSince', () => {
    const now = new Date(2026, 9, 16, 15, 30);

    it('returns null for the all-time period', () => {
      expect(rankPeriodSince('all', now)).toBeNull();
    });

    it('returns the start of the current day', () => {
      const day = rankPeriodSince('day', now);
      expect(day).not.toBeNull();
      expect(new Date(day as string).getHours()).toBe(0);
      expect(new Date(day as string).getMinutes()).toBe(0);
    });

    it('returns the monday of the current week', () => {
      const since = rankPeriodSince('week', now);
      const week = new Date(since as string);
      expect(week.getDay()).toBe(1);
      expect(week.getHours()).toBe(0);
    });

    it('returns the first day of the month', () => {
      const since = rankPeriodSince('month', now);
      const month = new Date(since as string);
      expect(month.getMonth()).toBe(9);
      expect(month.getDate()).toBe(1);
    });

    it('returns the first day of the year', () => {
      const since = rankPeriodSince('year', now);
      const year = new Date(since as string);
      expect(year.getMonth()).toBe(0);
      expect(year.getDate()).toBe(1);
    });
  });

  describe('rankPeriodLabelKey', () => {
    it('maps every period to a translation key', () => {
      for (const period of RANK_PERIODS) {
        expect(rankPeriodLabelKey(period)).toMatch(/^progress\.period_/);
      }
    });
  });
});

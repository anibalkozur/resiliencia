import { describe, expect, it } from '@jest/globals';
import { daysBetween, todayISO } from '../src';

describe('dates', () => {
  describe('todayISO', () => {
    it('returns the yyyy-mm-dd slice of a date', () => {
      expect(todayISO(new Date('2024-01-10T12:00:00Z'))).toBe('2024-01-10');
      expect(todayISO(new Date('2024-12-31T23:59:59Z'))).toBe('2024-12-31');
    });
  });

  describe('daysBetween', () => {
    it('counts whole days between two ISO dates', () => {
      expect(daysBetween('2024-01-01', '2024-01-10')).toBe(9);
      expect(daysBetween('2024-01-10', '2024-01-10')).toBe(0);
      expect(daysBetween('2024-01-10', '2024-01-09')).toBe(-1);
      expect(daysBetween('2024-01-10', '2024-01-15')).toBe(5);
      expect(daysBetween('2024-02-28', '2024-03-01')).toBe(2);
    });
  });
});

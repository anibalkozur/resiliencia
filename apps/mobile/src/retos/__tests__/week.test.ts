import { describe, expect, it } from '@jest/globals';
import { buildNextTraining, buildWeek } from '../week';
import { buildChallenge } from '../service';

const MONDAY = new Date(2026, 8, 7); // 2026-09-07 (lunes)
const FOUR_DAYS = [1, 3, 5, 6]; // lun, mié, vie, sáb

describe('buildWeek', () => {
  it('builds exactly 7 days starting on monday', () => {
    const week = buildWeek('mantener', FOUR_DAYS, MONDAY);
    expect(week).toHaveLength(7);
    expect(week[0].date).toBe('2026-09-07');
    expect(week[6].date).toBe('2026-09-13');
  });

  it('marks the selected training days', () => {
    const week = buildWeek('mantener', FOUR_DAYS, MONDAY);
    const training = week.filter((d) => d.isTraining).map((d) => d.dayOfWeek);
    expect(training).toEqual([1, 3, 5, 6]);
    expect(week[4].isTraining).toBe(true);
    expect(week[1].isTraining).toBe(false);
  });

  it('respects an arbitrary day selection', () => {
    const week = buildWeek('mantener', [0, 2], MONDAY);
    const training = week.filter((d) => d.isTraining).map((d) => d.dayOfWeek);
    expect(training).toEqual([2, 0]);
  });

  it('marks every day as rest for an empty selection', () => {
    expect(buildWeek('mantener', [], MONDAY).some((d) => d.isTraining)).toBe(false);
  });

  it('marks exactly one day as today', () => {
    const week = buildWeek('mantener', FOUR_DAYS, MONDAY);
    expect(week.filter((d) => d.isToday)).toHaveLength(1);
    expect(week[0].isToday).toBe(true);
  });

  it('leaves rest days without an exercise', () => {
    const week = buildWeek('mantener', FOUR_DAYS, MONDAY);
    for (const day of week.filter((d) => !d.isTraining)) {
      expect(day.exerciseId).toBeNull();
      expect(day.target).toBeNull();
    }
  });

  it('assigns the deterministic challenge to each training day', () => {
    const week = buildWeek('mantener', FOUR_DAYS, MONDAY);
    for (const day of week.filter((d) => d.isTraining)) {
      const challenge = buildChallenge(day.date, 'mantener');
      expect(day.exerciseId).toBe(challenge.exerciseId);
      expect(day.target).toBe(challenge.target);
    }
  });
});

describe('buildNextTraining', () => {
  it('returns tomorrow when the next day is a training day', () => {
    const tuesday = new Date(2026, 8, 8);
    const next = buildNextTraining('mantener', FOUR_DAYS, tuesday);
    expect(next?.date).toBe('2026-09-09');
    expect(next?.isTraining).toBe(true);
  });

  it('returns the next selected day even if it is not tomorrow', () => {
    const next = buildNextTraining('mantener', [1, 4], new Date(2026, 8, 8));
    expect(next?.date).toBe('2026-09-10'); // jueves
  });

  it('crosses into next week when no selected day remains', () => {
    const next = buildNextTraining('mantener', FOUR_DAYS, new Date(2026, 8, 13));
    expect(next?.date).toBe('2026-09-14');
  });

  it('returns null when there is nothing scheduled', () => {
    expect(buildNextTraining('mantener', [], new Date(2026, 8, 7))).toBeNull();
  });
});

import { describe, expect, it } from '@jest/globals';
import { buildWeek } from '../week';
import { buildChallenge } from '../service';

const MONDAY = new Date(2026, 8, 7); // 2026-09-07 (lunes)

describe('buildWeek', () => {
  it('builds exactly 7 days starting on monday', () => {
    const week = buildWeek('mantener', 4, MONDAY);
    expect(week).toHaveLength(7);
    expect(week[0].date).toBe('2026-09-07');
    expect(week[6].date).toBe('2026-09-13');
  });

  it('marks the training days evenly spread across the week', () => {
    const week = buildWeek('mantener', 4, MONDAY);
    const training = week.filter((d) => d.isTraining).map((d) => d.dayOfWeek);
    expect(training).toHaveLength(4);
    expect(training).toEqual([1, 3, 5, 6]);
    expect(week[4].isTraining).toBe(true);
    expect(week[1].isTraining).toBe(false);
  });

  it('clamps daysPerWeek to the available window', () => {
    expect(buildWeek('mantener', 2, MONDAY).filter((d) => d.isTraining)).toHaveLength(2);
    expect(buildWeek('mantener', 6, MONDAY).filter((d) => d.isTraining)).toHaveLength(6);
  });

  it('marks exactly one day as today', () => {
    const week = buildWeek('mantener', 4, MONDAY);
    expect(week.filter((d) => d.isToday)).toHaveLength(1);
    expect(week.find((d) => d.isToday)?.date).toBe('2026-09-07');
  });

  it('maps training days to the deterministic challenge of that date', () => {
    const goal = 'ganar_musculo';
    const week = buildWeek(goal, 4, MONDAY);
    for (const day of week.filter((d) => d.isTraining)) {
      const challenge = buildChallenge(day.date, goal);
      expect(day.exerciseId).toBe(challenge.exerciseId);
      expect(day.target).toBe(challenge.target);
    }
  });

  it('leaves rest days without an exercise', () => {
    const week = buildWeek('mantener', 3, MONDAY);
    for (const day of week.filter((d) => !d.isTraining)) {
      expect(day.exerciseId).toBeNull();
      expect(day.target).toBeNull();
    }
  });
});

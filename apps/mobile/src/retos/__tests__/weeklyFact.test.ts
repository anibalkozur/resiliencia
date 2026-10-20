import { describe, expect, it } from '@jest/globals';
import { WEEKLY_FACT_IDS, isoWeek, weeklyFact } from '../weeklyFact';

describe('isoWeek', () => {
  it('returns 1 for the first ISO week of 2026', () => {
    // 2026-01-01 es jueves: cae en la semana ISO 1.
    expect(isoWeek(new Date('2026-01-01T12:00:00'))).toBe(1);
  });

  it('rolls over to the next year at the correct boundary', () => {
    // 2027-01-01 es viernes: pertenece a la semana ISO 53 de 2026.
    expect(isoWeek(new Date('2027-01-01T12:00:00'))).toBe(53);
  });

  it('keeps the same week for consecutive days', () => {
    expect(isoWeek(new Date('2026-03-09T12:00:00'))).toBe(isoWeek(new Date('2026-03-15T12:00:00')));
  });
});

describe('weeklyFact', () => {
  it('always returns an id from the curated list', () => {
    const fact = weeklyFact(new Date('2026-05-20T12:00:00'));
    expect(WEEKLY_FACT_IDS).toContain(fact.key);
  });

  it('returns the same fact for any day of the same week', () => {
    const monday = weeklyFact(new Date('2026-05-18T12:00:00'));
    const sunday = weeklyFact(new Date('2026-05-24T12:00:00'));
    expect(sunday.key).toBe(monday.key);
  });

  it('changes the fact the following week', () => {
    const thisWeek = weeklyFact(new Date('2026-05-18T12:00:00'));
    const nextWeek = weeklyFact(new Date('2026-05-25T12:00:00'));
    expect(nextWeek.key).not.toBe(thisWeek.key);
  });

  it('builds the i18n keys from the id', () => {
    const fact = weeklyFact(new Date('2026-05-18T12:00:00'));
    expect(fact.titleKey).toBe(`weekly.${fact.key}.title`);
    expect(fact.bodyKey).toBe(`weekly.${fact.key}.body`);
  });
});

import { describe, expect, it } from '@jest/globals';
import { buildHistory, unitForExercise } from '../history';
import type { FreeSession } from '../freeSessions';

function session(partial: Partial<FreeSession>): FreeSession {
  return {
    date: '2026-10-01',
    exerciseId: 'sentadillas',
    value: 20,
    target: 20,
    ranked: false,
    seriesOk: true,
    ...partial,
  };
}

describe('unitForExercise', () => {
  it('returns seconds for isometric exercises', () => {
    expect(unitForExercise('plancha')).toBe('seconds');
  });

  it('defaults to reps for rep exercises and unknown ids', () => {
    expect(unitForExercise('sentadillas')).toBe('reps');
    expect(unitForExercise('desconocido')).toBe('reps');
  });
});

describe('buildHistory', () => {
  it('merges daily challenges and free sessions sorted by date desc', () => {
    const result = buildHistory(
      [session({ date: '2026-10-02', clientOpId: 'a' })],
      [{ date: '2026-10-05', exerciseId: 'flexiones', value: 12, target: 12, unit: 'reps' }],
    );
    expect(result.map((e) => e.date)).toEqual(['2026-10-05', '2026-10-02']);
    expect(result[0].source).toBe('retos');
    expect(result[1].source).toBe('libre');
  });

  it('keeps the daily value, target and unit', () => {
    const [entry] = buildHistory(
      [],
      [{ date: '2026-10-05', exerciseId: 'plancha', value: 40, target: 30, unit: 'seconds' }],
    );
    expect(entry).toMatchObject({
      key: 'reto:2026-10-05',
      value: 40,
      target: 30,
      unit: 'seconds',
      source: 'retos',
    });
  });

  it('resolves the unit of free sessions from the catalog', () => {
    const [entry] = buildHistory([session({ exerciseId: 'plancha' })], []);
    expect(entry.unit).toBe('seconds');
  });

  it('uses the clientOpId as key when present and flags ranked sessions', () => {
    const [entry] = buildHistory([session({ clientOpId: 'op-1', ranked: true })], []);
    expect(entry.key).toBe('libre:op-1');
    expect(entry.ranked).toBe(true);
  });

  it('keeps daily entries before free ones on the same date', () => {
    const result = buildHistory(
      [session({ date: '2026-10-05' })],
      [{ date: '2026-10-05', exerciseId: 'flexiones', value: 12, target: 12, unit: 'reps' }],
    );
    expect(result.map((e) => e.source)).toEqual(['retos', 'libre']);
  });

  it('returns an empty list when there is no activity', () => {
    expect(buildHistory([], [])).toEqual([]);
  });
});

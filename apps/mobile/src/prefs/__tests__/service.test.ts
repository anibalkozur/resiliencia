import { describe, expect, it } from '@jest/globals';
import { MemoryRepo } from '../../repo/memoryRepo';
import { DEFAULT_PREFS, getPrefs, normalizePrefs, savePrefs } from '../service';

describe('normalizePrefs', () => {
  it('returns defaults for empty input', () => {
    expect(normalizePrefs(undefined)).toEqual(DEFAULT_PREFS);
  });

  it('keeps valid training days sorted and deduplicated', () => {
    expect(normalizePrefs({ trainingDays: [5, 1, 1, 3] }).trainingDays).toEqual([1, 3, 5]);
  });

  it('drops out-of-range and non-integer days', () => {
    expect(normalizePrefs({ trainingDays: [7, -1, 2.5, 0, 6] }).trainingDays).toEqual([0, 6]);
  });

  it('falls back to the default week when no valid days are provided', () => {
    expect(normalizePrefs({ trainingDays: [] }).trainingDays).toEqual(DEFAULT_PREFS.trainingDays);
    expect(normalizePrefs({ trainingDays: [9] }).trainingDays).toEqual(DEFAULT_PREFS.trainingDays);
  });

  it('migrates the legacy daysPerWeek preference', () => {
    expect(normalizePrefs({ daysPerWeek: 2 } as never).trainingDays).toEqual([1, 4]);
    expect(normalizePrefs({ daysPerWeek: 6 } as never).trainingDays).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('prefers explicit training days over the legacy preference', () => {
    expect(normalizePrefs({ trainingDays: [0, 2], daysPerWeek: 6 } as never).trainingDays).toEqual([
      0, 2,
    ]);
  });

  it('falls back to defaults for unknown goal or language', () => {
    expect(normalizePrefs({ goal: 'otro' as never }).goal).toBe(DEFAULT_PREFS.goal);
    expect(normalizePrefs({ language: 'xx' as never }).language).toBe(DEFAULT_PREFS.language);
  });
});

describe('prefs roundtrip', () => {
  it('returns defaults when nothing is stored', async () => {
    const repo = new MemoryRepo();
    expect(await getPrefs(repo)).toEqual(DEFAULT_PREFS);
  });

  it('persists and reads prefs through the repo', async () => {
    const repo = new MemoryRepo();
    const saved = await savePrefs(repo, {
      goal: 'perder_grasa',
      trainingDays: [1, 2, 4],
      language: 'en',
    });
    expect(saved.goal).toBe('perder_grasa');
    expect(saved.trainingDays).toEqual([1, 2, 4]);
    expect(await getPrefs(repo)).toEqual(saved);
  });
});

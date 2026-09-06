import { describe, expect, it } from '@jest/globals';
import { MemoryRepo } from '../../repo/memoryRepo';
import { DEFAULT_PREFS, MAX_DAYS, MIN_DAYS, getPrefs, normalizePrefs, savePrefs } from '../service';

describe('normalizePrefs', () => {
  it('returns defaults for empty input', () => {
    expect(normalizePrefs(undefined)).toEqual(DEFAULT_PREFS);
  });

  it('clamps daysPerWeek to the allowed range', () => {
    expect(normalizePrefs({ daysPerWeek: 1 }).daysPerWeek).toBe(MIN_DAYS);
    expect(normalizePrefs({ daysPerWeek: 9 }).daysPerWeek).toBe(MAX_DAYS);
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
      daysPerWeek: 5,
      language: 'en',
    });
    expect(saved.goal).toBe('perder_grasa');
    expect(await getPrefs(repo)).toEqual(saved);
  });
});

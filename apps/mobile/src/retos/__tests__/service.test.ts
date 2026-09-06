import { describe, expect, it } from '@jest/globals';
import { MemoryRepo } from '../../repo/memoryRepo';
import { buildChallenge, getTodayChallenge, todayKey } from '../service';

describe('buildChallenge', () => {
  it('assigns a deterministic exercise and target per date', () => {
    const a = buildChallenge('2026-09-06');
    const b = buildChallenge('2026-09-07');
    expect(a.exerciseId).not.toBe(b.exerciseId);
    expect(a.target).toBeGreaterThan(0);
  });
});

describe('todayKey', () => {
  it('matches the YYYY-MM-DD format', () => {
    expect(todayKey()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('getTodayChallenge', () => {
  it('creates and persists a challenge for a new day', async () => {
    const repo = new MemoryRepo();
    const challenge = await getTodayChallenge(repo);
    expect(challenge.date).toBe(todayKey());
    expect(await repo.getSetting(`reto:${challenge.date}`)).not.toBeNull();
  });

  it('returns the same challenge for the same day', async () => {
    const repo = new MemoryRepo();
    const first = await getTodayChallenge(repo);
    const second = await getTodayChallenge(repo);
    expect(second).toEqual(first);
  });
});

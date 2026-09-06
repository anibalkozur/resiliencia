import { describe, expect, it } from '@jest/globals';
import { MemoryRepo } from '../../repo/memoryRepo';
import { buildChallenge, getTodayChallenge, todayKey } from '../service';
import { savePrefs } from '../../prefs/service';
import { GOAL_EXERCISE_ORDER } from '../catalog';

function localDate(day: number): string {
  const d = new Date(2026, 8, day);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dayStr = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dayStr}`;
}

describe('buildChallenge', () => {
  it('assigns a deterministic exercise and target per date', () => {
    const a = buildChallenge(localDate(6));
    const b = buildChallenge(localDate(7));
    expect(a.exerciseId).not.toBe(b.exerciseId);
    expect(a.target).toBeGreaterThan(0);
  });

  it('follows the goal-specific exercise order', () => {
    const goal = 'perder_grasa';
    const day = 6;
    const expected = GOAL_EXERCISE_ORDER[goal][day % GOAL_EXERCISE_ORDER[goal].length];
    expect(buildChallenge(localDate(day), goal).exerciseId).toBe(expected);
  });

  it('applies a bigger target multiplier for fat loss', () => {
    const base = buildChallenge(localDate(6), 'mantener');
    const fatLoss = buildChallenge(localDate(6), 'perder_grasa');
    expect(fatLoss.target).toBe(Math.round(base.target * 1.2));
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

  it('builds today challenge according to the saved goal', async () => {
    const repo = new MemoryRepo();
    await savePrefs(repo, { goal: 'ganar_musculo' });
    const challenge = await getTodayChallenge(repo);
    const order = GOAL_EXERCISE_ORDER.ganar_musculo;
    expect(order).toContain(challenge.exerciseId);
  });
});

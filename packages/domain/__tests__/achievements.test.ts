import { describe, expect, it, jest } from '@jest/globals';
import { ACHIEVEMENTS, freshState, totalReps, unlockAchievements } from '../src';
import type { GameState } from '../src';

function stateWith(overrides: Partial<GameState>): GameState {
  const state = freshState();
  if (overrides.history) state.history = overrides.history;
  if (overrides.streak) state.streak = { ...overrides.streak };
  if (overrides.xp !== undefined) state.xp = overrides.xp;
  if (overrides.hadComeback !== undefined) state.hadComeback = overrides.hadComeback;
  if (overrides.unlocked) state.unlocked = [...overrides.unlocked];
  return state;
}

function onlyUnlocked(state: GameState, ...codes: string[]): GameState {
  return stateWith({ unlocked: codes });
}

describe('ACHIEVEMENTS', () => {
  it('matches the code, order and names of app.html', () => {
    expect(ACHIEVEMENTS.map((a) => a.code)).toEqual([
      'first_workout',
      'streak_3',
      'streak_7',
      'streak_30',
      'reps_100',
      'reps_1000',
      'level_5',
      'comeback',
    ]);
    expect(ACHIEVEMENTS.map((a) => a.name)).toEqual([
      'Primer paso',
      '3 días',
      '7 días',
      '30 días',
      '100 reps',
      '1.000 reps',
      'Nivel 5',
      'Volviste',
    ]);
  });

  describe('first_workout', () => {
    it('requires at least one completed workout', () => {
      const test = (s: GameState) => {
        const achievement = ACHIEVEMENTS.find((a) => a.code === 'first_workout');
        return achievement?.test(s) ?? false;
      };
      expect(test(freshState())).toBe(false);
      expect(
        test(
          stateWith({
            history: [{ date: '2024-01-10', day: 1, targets: {}, totalReps: 3, felt: null }],
          }),
        ),
      ).toBe(true);
    });
  });

  describe('streak_3 / streak_7 / streak_30', () => {
    it('unlocks at best 3, 7 and 30 respectively', () => {
      const unlocksAt = (code: string, best: number) =>
        ACHIEVEMENTS.find((a) => a.code === code)?.test(
          stateWith({ streak: { current: 0, best, lastDate: null } }),
        ) ?? false;
      expect(unlocksAt('streak_3', 2)).toBe(false);
      expect(unlocksAt('streak_3', 3)).toBe(true);
      expect(unlocksAt('streak_7', 6)).toBe(false);
      expect(unlocksAt('streak_7', 7)).toBe(true);
      expect(unlocksAt('streak_30', 29)).toBe(false);
      expect(unlocksAt('streak_30', 30)).toBe(true);
    });
  });

  describe('reps_100 / reps_1000', () => {
    it('unlocks at 100 and 1000 total reps', () => {
      const at = (code: string, total: number) =>
        ACHIEVEMENTS.find((a) => a.code === code)?.test(
          stateWith({
            history: [{ date: '2024-01-10', day: 1, targets: {}, totalReps: total, felt: null }],
          }),
        ) ?? false;
      expect(at('reps_100', 99)).toBe(false);
      expect(at('reps_100', 100)).toBe(true);
      expect(at('reps_1000', 999)).toBe(false);
      expect(at('reps_1000', 1000)).toBe(true);
    });
  });

  describe('level_5', () => {
    it('unlocks at xp 360 (level >= 5)', () => {
      const at = (xp: number) =>
        ACHIEVEMENTS.find((a) => a.code === 'level_5')?.test(stateWith({ xp })) ?? false;
      expect(at(359)).toBe(false);
      expect(at(360)).toBe(true);
    });
  });

  describe('comeback', () => {
    it('requires hadComeback to be true', () => {
      const test = (s: GameState) =>
        ACHIEVEMENTS.find((a) => a.code === 'comeback')?.test(s) ?? false;
      expect(test(stateWith({ hadComeback: false }))).toBe(false);
      expect(test(stateWith({ hadComeback: true }))).toBe(true);
    });
  });
});

describe('totalReps', () => {
  it('sums totalReps across the whole history', () => {
    const state = stateWith({
      history: [
        { date: '2024-01-08', day: 1, targets: {}, totalReps: 30, felt: null },
        { date: '2024-01-09', day: 2, targets: {}, totalReps: 40, felt: null },
        { date: '2024-01-10', day: 3, targets: {}, totalReps: 50, felt: null },
      ],
    });
    expect(totalReps(state)).toBe(120);
  });

  it('returns 0 for a fresh state', () => {
    expect(totalReps(freshState())).toBe(0);
  });
});

describe('unlockAchievements', () => {
  it('unlocks nothing and returns [] for a fresh state', () => {
    const state = freshState();
    expect(unlockAchievements(state)).toEqual([]);
    expect(state.unlocked).toEqual([]);
  });

  it('unlocks first_workout and returns it once', () => {
    const state = stateWith({
      history: [{ date: '2024-01-10', day: 1, targets: {}, totalReps: 3, felt: null }],
    });
    const newly = unlockAchievements(state);
    expect(newly.map((a) => a.code)).toEqual(['first_workout']);
    expect(state.unlocked).toEqual(['first_workout']);
    expect(unlockAchievements(state)).toEqual([]);
  });

  it('unlocks in app.html order when several conditions hold at once', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-10T12:00:00Z'));
    try {
      const state = onlyUnlocked(freshState(), 'first_workout');
      state.xp = 360;
      state.streak = { current: 7, best: 7, lastDate: '2024-01-10' };
      state.history = [{ date: '2024-01-10', day: 1, targets: {}, totalReps: 100, felt: null }];
      state.hadComeback = true;
      const newly = unlockAchievements(state);
      expect(newly.map((a) => a.code)).toEqual([
        'streak_3',
        'streak_7',
        'reps_100',
        'level_5',
        'comeback',
      ]);
      expect(state.unlocked).toEqual([
        'first_workout',
        'streak_3',
        'streak_7',
        'reps_100',
        'level_5',
        'comeback',
      ]);
    } finally {
      jest.useRealTimers();
    }
  });
});

import { describe, expect, it, jest } from '@jest/globals';
import { finishWorkout, freshState, ProgressionEngine } from '../src';
import type { Challenge } from '../src';

const NOW = '2024-01-10T12:00:00Z';

function challenge(
  day = 1,
  targets: Record<string, number> = { pushups: 10, squats: 10, situps: 10 },
): Challenge {
  return { day, targets, isComeback: false };
}

describe('finishWorkout', () => {
  it('records the entry, applies streak, grants xp = 10 + totalReps and unlocks achievements', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(NOW));
    try {
      const state = freshState();
      const result = finishWorkout(state, challenge());

      expect(result.xpGain).toBe(40);
      expect(result.entry).toEqual({
        date: '2024-01-10',
        day: 1,
        targets: { pushups: 10, squats: 10, situps: 10 },
        totalReps: 30,
        felt: null,
      });
      expect(state.xp).toBe(40);
      expect(state.history).toHaveLength(1);
      expect(state.streak).toEqual({ current: 1, best: 1, lastDate: '2024-01-10' });
      expect(result.newlyUnlocked.map((a) => a.code)).toEqual(['first_workout']);
      expect(state.unlocked).toEqual(['first_workout']);
    } finally {
      jest.useRealTimers();
    }
  });

  it('grants xp = 10 + totalReps and unlocks all matching rep and level achievements', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(NOW));
    try {
      const state = freshState();
      const result = finishWorkout(state, challenge(1, { pushups: 1000 }));

      expect(result.xpGain).toBe(1010);
      expect(state.xp).toBe(1010);
      expect(state.history[0].totalReps).toBe(1000);
      expect(result.newlyUnlocked.map((a) => a.code)).toEqual([
        'first_workout',
        'reps_100',
        'reps_1000',
        'level_5',
      ]);
    } finally {
      jest.useRealTimers();
    }
  });

  it('increments an existing streak through finishWorkout', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(NOW));
    try {
      const state = freshState();
      state.streak = { current: 5, best: 5, lastDate: '2024-01-09' };
      const result = finishWorkout(state, challenge());

      expect(state.streak).toEqual({ current: 6, best: 6, lastDate: '2024-01-10' });
      expect(result.newlyUnlocked.map((a) => a.code)).toEqual(['first_workout', 'streak_3']);
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not re-unlock achievements on a second workout the same day', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(NOW));
    try {
      const state = freshState();
      finishWorkout(state, challenge());
      const second = finishWorkout(state, challenge());

      expect(second.newlyUnlocked).toEqual([]);
      expect(state.unlocked).toEqual(['first_workout']);
      expect(state.streak).toEqual({ current: 1, best: 1, lastDate: '2024-01-10' });
    } finally {
      jest.useRealTimers();
    }
  });

  it('feeds ProgressionEngine.nextChallenge into finishWorkout (day 1 = 1 rep each)', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(NOW));
    try {
      const state = freshState();
      const result = finishWorkout(state, ProgressionEngine.nextChallenge(state));

      expect(result.entry.day).toBe(1);
      expect(result.entry.totalReps).toBe(3);
      expect(result.xpGain).toBe(13);
      expect(state.xp).toBe(13);
    } finally {
      jest.useRealTimers();
    }
  });
});

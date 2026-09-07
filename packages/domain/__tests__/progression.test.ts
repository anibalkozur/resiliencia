import { describe, expect, it, jest } from '@jest/globals';
import { freshState, ProgressionEngine } from '../src';
import type { GameState, HistoryEntry } from '../src';

const NOW = '2024-01-10T12:00:00Z';

function entry(date: string, day: number, targets: Record<string, number>): HistoryEntry {
  const totalReps = Object.values(targets).reduce((a, b) => a + b, 0);
  return { date, day, targets, totalReps, felt: null };
}

function stateWithHistory(history: HistoryEntry[], exercises: Record<string, number>): GameState {
  const state = freshState();
  state.profile.exercises = exercises;
  state.history = history;
  return state;
}

describe('ProgressionEngine.nextChallenge', () => {
  it('returns day 1 with the base targets for a fresh state', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(NOW));
    try {
      const state = freshState();
      const challenge = ProgressionEngine.nextChallenge(state);
      expect(challenge).toEqual({
        day: 1,
        targets: { pushups: 1, squats: 1, situps: 1 },
        isComeback: false,
      });
      expect(state.hadComeback).toBe(false);
    } finally {
      jest.useRealTimers();
    }
  });

  it('follows linear +1/day progression (day 3 from 2 base days)', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(NOW));
    try {
      const state = stateWithHistory(
        [
          entry('2024-01-08', 1, { pushups: 1, squats: 1, situps: 1 }),
          entry('2024-01-09', 2, { pushups: 2, squats: 2, situps: 2 }),
        ],
        { pushups: 1, squats: 1, situps: 1 },
      );
      const challenge = ProgressionEngine.nextChallenge(state);
      expect(challenge).toEqual({
        day: 3,
        targets: { pushups: 3, squats: 3, situps: 3 },
        isComeback: false,
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it('uses day = history.length + 1 and scales every exercise (day 6)', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(NOW));
    try {
      const history = [
        entry('2024-01-05', 1, { pushups: 2, squats: 3, situps: 4 }),
        entry('2024-01-06', 2, { pushups: 3, squats: 4, situps: 5 }),
        entry('2024-01-07', 3, { pushups: 4, squats: 5, situps: 6 }),
        entry('2024-01-08', 4, { pushups: 5, squats: 6, situps: 7 }),
        entry('2024-01-09', 5, { pushups: 5, squats: 6, situps: 7 }),
      ];
      const state = stateWithHistory(history, { pushups: 2, squats: 3, situps: 4 });
      const challenge = ProgressionEngine.nextChallenge(state);
      expect(challenge.day).toBe(6);
      expect(challenge.targets).toEqual({ pushups: 7, squats: 8, situps: 9 });
    } finally {
      jest.useRealTimers();
    }
  });

  describe('comeback', () => {
    it('applies the 0.7 multiplier after 7+ days and flags hadComeback', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date(NOW));
      try {
        const state = stateWithHistory(
          [entry('2024-01-03', 1, { pushups: 10, squats: 10, situps: 10 })],
          { pushups: 10, squats: 10, situps: 10 },
        );
        const challenge = ProgressionEngine.nextChallenge(state);
        expect(challenge.isComeback).toBe(true);
        expect(state.hadComeback).toBe(true);
        expect(challenge.day).toBe(2);
        expect(challenge.targets).toEqual({ pushups: 8, squats: 8, situps: 8 });
      } finally {
        jest.useRealTimers();
      }
    });

    it('applies the 0.5 multiplier after 14+ days', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date(NOW));
      try {
        const state = stateWithHistory(
          [entry('2023-12-27', 1, { pushups: 10, squats: 10, situps: 10 })],
          { pushups: 10, squats: 10, situps: 10 },
        );
        const challenge = ProgressionEngine.nextChallenge(state);
        expect(challenge.isComeback).toBe(true);
        expect(state.hadComeback).toBe(true);
        expect(challenge.targets).toEqual({ pushups: 6, squats: 6, situps: 6 });
      } finally {
        jest.useRealTimers();
      }
    });

    it('does not flag hadComeback before 7 days', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date(NOW));
      try {
        const state = stateWithHistory(
          [entry('2024-01-09', 1, { pushups: 1, squats: 1, situps: 1 })],
          { pushups: 1, squats: 1, situps: 1 },
        );
        const challenge = ProgressionEngine.nextChallenge(state);
        expect(challenge.isComeback).toBe(false);
        expect(state.hadComeback).toBe(false);
      } finally {
        jest.useRealTimers();
      }
    });
  });

  describe('SafetyEngine cap', () => {
    it('caps the daily growth at last + 3', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date(NOW));
      try {
        const state = stateWithHistory(
          [entry('2024-01-09', 1, { pushups: 1, squats: 1, situps: 1 })],
          { pushups: 20, squats: 20, situps: 20 },
        );
        const challenge = ProgressionEngine.nextChallenge(state);
        expect(challenge.day).toBe(2);
        expect(challenge.targets).toEqual({ pushups: 4, squats: 4, situps: 4 });
        expect(challenge.isComeback).toBe(false);
      } finally {
        jest.useRealTimers();
      }
    });

    it('floors the result at 1 (Math.max(1, val))', () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date(NOW));
      try {
        const state = freshState();
        state.profile.exercises = { pushups: 0, squats: 0, situps: 0 };
        const challenge = ProgressionEngine.nextChallenge(state);
        expect(challenge.targets).toEqual({ pushups: 1, squats: 1, situps: 1 });
      } finally {
        jest.useRealTimers();
      }
    });
  });
});

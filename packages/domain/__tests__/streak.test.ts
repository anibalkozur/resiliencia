import { describe, expect, it, jest } from '@jest/globals';
import { applyStreak, freshState } from '../src';
import type { GameState } from '../src';

const NOW = '2024-01-10T12:00:00Z';

function stateWith(streak: { current: number; best: number; lastDate: string | null }): GameState {
  const state = freshState();
  state.streak = { ...streak };
  return state;
}

describe('applyStreak', () => {
  it('starts the streak at 1 when there is no lastDate', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(NOW));
    try {
      const state = stateWith({ current: 0, best: 0, lastDate: null });
      applyStreak(state);
      expect(state.streak).toEqual({ current: 1, best: 1, lastDate: '2024-01-10' });
    } finally {
      jest.useRealTimers();
    }
  });

  it('increments the streak when the last workout was yesterday', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(NOW));
    try {
      const state = stateWith({ current: 3, best: 2, lastDate: '2024-01-09' });
      applyStreak(state);
      expect(state.streak).toEqual({ current: 4, best: 4, lastDate: '2024-01-10' });
    } finally {
      jest.useRealTimers();
    }
  });

  it('keeps the streak unchanged when called again the same day', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(NOW));
    try {
      const state = stateWith({ current: 4, best: 4, lastDate: '2024-01-10' });
      applyStreak(state);
      expect(state.streak).toEqual({ current: 4, best: 4, lastDate: '2024-01-10' });
    } finally {
      jest.useRealTimers();
    }
  });

  it('resets the streak to 1 when there is a gap of more than one day', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(NOW));
    try {
      const state = stateWith({ current: 12, best: 12, lastDate: '2024-01-08' });
      applyStreak(state);
      expect(state.streak.current).toBe(1);
      expect(state.streak.lastDate).toBe('2024-01-10');
    } finally {
      jest.useRealTimers();
    }
  });

  it('never decreases the best streak', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(NOW));
    try {
      const state = stateWith({ current: 12, best: 30, lastDate: '2024-01-03' });
      applyStreak(state);
      expect(state.streak).toEqual({ current: 1, best: 30, lastDate: '2024-01-10' });
    } finally {
      jest.useRealTimers();
    }
  });
});

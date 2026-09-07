import { applyStreak } from './streak';
import { unlockAchievements } from './achievements';
import { todayISO } from './dates';
import type { Achievement } from './achievements';
import type { Challenge } from './progression';
import type { GameState, HistoryEntry } from './types';

export interface WorkoutResult {
  xpGain: number;
  newlyUnlocked: Achievement[];
  entry: HistoryEntry;
}

export function finishWorkout(state: GameState, challenge: Challenge): WorkoutResult {
  const totalReps = Object.values(challenge.targets).reduce((a, b) => a + b, 0);
  const entry: HistoryEntry = {
    date: todayISO(),
    day: challenge.day,
    targets: challenge.targets,
    totalReps,
    felt: null,
  };
  state.history.push(entry);
  applyStreak(state);
  const xpGain = 10 + totalReps;
  state.xp += xpGain;
  const newlyUnlocked = unlockAchievements(state);
  return { xpGain, newlyUnlocked, entry };
}

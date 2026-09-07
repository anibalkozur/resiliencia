import type { GameState } from './types';

export function freshState(): GameState {
  return {
    onboarded: false,
    profile: {
      name: '',
      mode: 'home',
      experience: 'beginner',
      goal: 'habit',
      exercises: { pushups: 1, squats: 1, situps: 1 },
    },
    xp: 0,
    streak: { current: 0, best: 0, lastDate: null },
    history: [], // {date, day, targets, totalReps, felt}
    unlocked: [],
    hadComeback: false,
  };
}

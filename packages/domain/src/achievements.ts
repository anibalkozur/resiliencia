import { levelForXp } from './level';
import type { GameState } from './types';

export interface Achievement {
  code: string;
  name: string;
  test: (s: GameState) => boolean;
}

export function totalReps(s: GameState): number {
  return s.history.reduce((a, h) => a + h.totalReps, 0);
}

export const ACHIEVEMENTS: Achievement[] = [
  { code: 'first_workout', name: 'Primer paso', test: (s) => s.history.length >= 1 },
  { code: 'streak_3', name: '3 días', test: (s) => s.streak.best >= 3 },
  { code: 'streak_7', name: '7 días', test: (s) => s.streak.best >= 7 },
  { code: 'streak_30', name: '30 días', test: (s) => s.streak.best >= 30 },
  { code: 'reps_100', name: '100 reps', test: (s) => totalReps(s) >= 100 },
  { code: 'reps_1000', name: '1.000 reps', test: (s) => totalReps(s) >= 1000 },
  { code: 'level_5', name: 'Nivel 5', test: (s) => levelForXp(s.xp) >= 5 },
  { code: 'comeback', name: 'Volviste', test: (s) => s.hadComeback === true },
];

export function unlockAchievements(state: GameState): Achievement[] {
  const before = new Set(state.unlocked);
  ACHIEVEMENTS.forEach((a) => {
    if (!state.unlocked.includes(a.code) && a.test(state)) state.unlocked.push(a.code);
  });
  return ACHIEVEMENTS.filter((a) => !before.has(a.code) && state.unlocked.includes(a.code));
}

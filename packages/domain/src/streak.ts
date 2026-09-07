import { daysBetween, todayISO } from './dates';
import type { GameState } from './types';

export function applyStreak(state: GameState): void {
  const last = state.streak.lastDate;
  if (!last) {
    state.streak.current = 1;
  } else {
    const gap = daysBetween(last, todayISO());
    if (gap === 1) state.streak.current += 1;
    else if (gap === 0) {
      /* mismo día, no cambia */
    } else state.streak.current = 1; // se rompió, reinicia (descansos planificados: fuera de MVP)
  }
  state.streak.lastDate = todayISO();
  state.streak.best = Math.max(state.streak.best, state.streak.current);
}

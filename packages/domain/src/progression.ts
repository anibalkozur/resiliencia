import { daysBetween, todayISO } from './dates';
import type { GameState } from './types';

export interface Challenge {
  day: number;
  targets: Record<string, number>;
  isComeback: boolean;
}

/* ---------- ProgressionEngine (desacoplado de UI) ---------- */
export const ProgressionEngine = {
  // Genera el reto del día según perfil + historial. Progresión lineal
  // simple con techo de incremento (SafetyEngine) y readaptación tras
  // inactividad prolongada.
  nextChallenge(state: GameState): Challenge {
    const base = state.profile.exercises; // {pushups:1, squats:1, situps:1}
    const daysSinceLast = state.history.length
      ? daysBetween(state.history[state.history.length - 1].date, todayISO())
      : 0;

    let mult = 1;
    if (daysSinceLast >= 14) {
      mult = 0.5;
      state.hadComeback = true;
    } // readaptación fuerte
    else if (daysSinceLast >= 7) {
      mult = 0.7;
      state.hadComeback = true;
    } // readaptación moderada

    const day = state.history.length + 1;
    const raw: Record<string, number> = {};
    for (const ex in base) {
      let val = base[ex] + (day - 1); // progresión lineal +1/día
      val = Math.round(val * mult);
      // SafetyEngine: tope de incremento diario respecto a la última sesión real
      const last = state.history.length
        ? state.history[state.history.length - 1].targets[ex]
        : base[ex];
      const maxAllowed = last + 3; // no permitir saltos absurdos
      val = Math.min(val, maxAllowed);
      raw[ex] = Math.max(1, val);
    }
    return { day, targets: raw, isComeback: mult < 1 };
  },
};

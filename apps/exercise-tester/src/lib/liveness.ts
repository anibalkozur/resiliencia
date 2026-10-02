// Prueba de vida anti-video: los mismos criterios que camera-verification.html
// (LIVENESS_MIN/MAX_MS, LIVENESS_FRAMES=5, LIVENESS_HOLD_MS=2000).
// Se dispara una vez por sesión, en un momento aleatorio, solo si la evidencia
// lo exige (unit=seconds o target>5).

import { INDICES } from './pose';
import type { Pt } from './pose';
import type { ExerciseConfig } from './exercises';

export const LIVENESS_MIN_MS = 4000;
export const LIVENESS_MAX_MS = 13000;
export const LIVENESS_FRAMES = 5;
export const LIVENESS_HOLD_MS = 2000;
/** Margen sobre el hombro para considerar la mano levantada (producción: 0.05). */
export const RAISE_SHOULDER_MARGIN = 0.05;
export const RAISE_MIN_FRAMES = 4;

/** La evidencia exige prueba de vida si el objetivo es >5 o el ejercicio es por segundos. */
/**
 * Misma regla que camera-verification.html:768:
 * `targetUnit === 'seconds' || targetVal > 5`. Importa `unit` y no `kind`
 * para no divergir del motor cuando un ejercicio cambie de categoría.
 */
export function livenessRequired(cfg: ExerciseConfig): boolean {
  return cfg.unit === 'seconds' || cfg.target > 5;
}

/** Agenda un disparo único aleatorio entre 4 y 13 s. */
export function scheduleLiveness(
  state: { scheduledAt: number | null; passed: boolean },
  now: number,
): { scheduledAt: number | null; passed: boolean } {
  if (state.passed || state.scheduledAt !== null) return state;
  return {
    scheduledAt: now + LIVENESS_MIN_MS + Math.random() * (LIVENESS_MAX_MS - LIVENESS_MIN_MS),
    passed: false,
  };
}

export function livenessDue(
  state: { scheduledAt: number | null; passed: boolean },
  now: number,
): boolean {
  if (state.passed) return false;
  if (state.scheduledAt === null) return false;
  return now >= state.scheduledAt;
}

/**
 * Tipo 'hand': alguna muñeca 5% del alto del frame por encima del HOMBRO
 * correspondiente, 5 cuadros seguidos (camera-verification.html:980-984).
 */
export function handUp(lms: Pt[]): boolean {
  const lw = lms[INDICES.leftWrist];
  const rw = lms[INDICES.rightWrist];
  const ls = lms[INDICES.leftShoulder];
  const rs = lms[INDICES.rightShoulder];
  const rUp = rw && rs && (rw.visibility ?? 0) > 0.5 && rw.y < rs.y - RAISE_SHOULDER_MARGIN;
  const lUp = lw && ls && (lw.visibility ?? 0) > 0.5 && lw.y < ls.y - RAISE_SHOULDER_MARGIN;
  return Boolean(rUp || lUp);
}

/** Tipo 'hand': confirma si el streak llegó a los 5 cuadros exigidos. */
export function handLivenessOk(lms: Pt[], streak: number): boolean {
  return streak >= LIVENESS_FRAMES && handUp(lms);
}

/** Actualiza el streak de mano cuando la liveness está activa. */
export function handStreak(streak: number, active: boolean, lms: Pt[]): number {
  if (!active) return 0;
  if (!handUp(lms)) return 0;
  return streak + 1;
}

export type LivenessUi = 'inactivo' | 'pendiente' | 'mano' | 'hold' | 'ok' | 'fallo';

export function livenessUi(
  cfg: ExerciseConfig,
  required: boolean,
  passed: boolean,
  active: boolean,
  holdMs: number,
): LivenessUi {
  if (!required) return 'inactivo';
  if (passed) return 'ok';
  if (active) return cfg.liveness === 'hold' ? 'hold' : 'mano';
  return 'pendiente';
}

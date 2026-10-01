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
export const RAISE_NOSE_MARGIN = 0.06;
export const RAISE_MIN_FRAMES = 4;

/** La evidencia exige prueba de vida si el objetivo es >5 o el ejercicio es por segundos. */
export function livenessRequired(cfg: ExerciseConfig): boolean {
  return cfg.kind === 'isometrico' || cfg.target > 5;
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

/** Tipo 'hand': alguna muñeca 6% del alto del frame por encima de la nariz, 5 frames seguidos. */
export function handLivenessOk(lms: Pt[], streak: number): boolean {
  if (streak < LIVENESS_FRAMES) return false;
  const nose = lms[INDICES.nose];
  if (!nose) return false;
  if (nose.y < 0.05 || nose.y > 0.95) return false;
  const lw = lms[INDICES.leftWrist];
  const rw = lms[INDICES.rightWrist];
  const lwOk = lw !== undefined && (lw.visibility ?? 0) > 0.5 && lw.y < nose.y - RAISE_NOSE_MARGIN;
  const rwOk = rw !== undefined && (rw.visibility ?? 0) > 0.5 && rw.y < nose.y - RAISE_NOSE_MARGIN;
  return lwOk || rwOk;
}

/** Actualiza el streak de mano cuando la liveness está activa. */
export function handStreak(streak: number, active: boolean, lms: Pt[]): number {
  if (!active) return 0;
  const nose = lms[INDICES.nose];
  const lw = lms[INDICES.leftWrist];
  const rw = lms[INDICES.rightWrist];
  if (!nose || nose.y < 0.05 || nose.y > 0.95) return 0;
  const ok =
    (lw !== undefined && (lw.visibility ?? 0) > 0.5 && lw.y < nose.y - RAISE_NOSE_MARGIN) ||
    (rw !== undefined && (rw.visibility ?? 0) > 0.5 && rw.y < nose.y - RAISE_NOSE_MARGIN);
  if (!ok) return 0;
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

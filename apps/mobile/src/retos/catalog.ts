import type { Goal } from '../prefs/types';
import type { Exercise } from './types';
import type { TranslationKey } from '../i18n/translations';

export function exerciseNameKey(id: string): TranslationKey {
  return `exercise.${id}.name` as TranslationKey;
}

export function exerciseDescKey(id: string): TranslationKey {
  return `exercise.${id}.desc` as TranslationKey;
}

export const EXERCISES: Exercise[] = [
  { id: 'sentadillas', unit: 'reps', tier: 'free' },
  { id: 'flexiones', unit: 'reps', tier: 'free' },
  { id: 'abdominales', unit: 'reps', tier: 'free' },
  { id: 'plancha', unit: 'seconds', tier: 'premium' },
  { id: 'zancadas', unit: 'reps', tier: 'premium' },
  { id: 'puente_gluteo', unit: 'reps', tier: 'premium' },
  { id: 'mountain_climbers', unit: 'seconds', tier: 'premium' },
  { id: 'sentadilla_isometrica', unit: 'seconds', tier: 'premium' },
  { id: 'fondos_silla', unit: 'reps', tier: 'premium' },
];

export const DEFAULT_TARGETS: Record<string, number> = {
  sentadillas: 20,
  flexiones: 10,
  abdominales: 15,
  plancha: 30,
  zancadas: 24,
  puente_gluteo: 15,
  mountain_climbers: 30,
  sentadilla_isometrica: 25,
  fondos_silla: 12,
};

// Cadencia (segundos máximos entre repes) para ejercicios por repeticiones.
// Los ejercicios por tiempo/cuenta (plancha, mountain_climbers,
// sentadilla_isometrica) no la usan: la cámara solo la aplica en modo reps.
// Todos son 6 s; la repe en la que sale la prueba de vida amplía la cadencia a
// 12 s (6 + 6 extra) para dar la señal y completar la repetición.
export const REP_CADENCE: Record<string, number> = {
  sentadillas: 6,
  flexiones: 6,
  abdominales: 6,
  zancadas: 6,
  puente_gluteo: 6,
  fondos_silla: 6,
};

// Fallback cuando un ejercicio por repes no está en REP_CADENCE. Alineado con
// el default de la cámara (CADENCE_SEC) y con chat.ts.
export const DEFAULT_CADENCE_SEC = 6;

export const FREE_EXERCISE_ORDER: string[] = ['sentadillas', 'flexiones', 'abdominales'];

export const FEATURE_DATE = '2026-09-28';

export const GOAL_EXERCISE_ORDER: Record<Goal, string[]> = {
  perder_grasa: [
    'sentadillas',
    'mountain_climbers',
    'plancha',
    'zancadas',
    'flexiones',
    'sentadilla_isometrica',
    'puente_gluteo',
  ],
  ganar_musculo: [
    'flexiones',
    'sentadillas',
    'zancadas',
    'puente_gluteo',
    'plancha',
    'sentadilla_isometrica',
    'mountain_climbers',
  ],
  mantener: [
    'sentadillas',
    'plancha',
    'flexiones',
    'zancadas',
    'puente_gluteo',
    'mountain_climbers',
    'sentadilla_isometrica',
  ],
};

export const GOAL_TARGET_MULTIPLIER: Record<Goal, number> = {
  perder_grasa: 1.2,
  ganar_musculo: 1.1,
  mantener: 1,
};

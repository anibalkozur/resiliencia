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
  { id: 'sentadillas', unit: 'reps' },
  { id: 'flexiones', unit: 'reps' },
  { id: 'plancha', unit: 'seconds' },
  { id: 'zancadas', unit: 'reps' },
  { id: 'puente_gluteo', unit: 'reps' },
  { id: 'mountain_climbers', unit: 'seconds' },
  { id: 'sentadilla_isometrica', unit: 'seconds' },
];

export const DEFAULT_TARGETS: Record<string, number> = {
  sentadillas: 20,
  flexiones: 10,
  plancha: 30,
  zancadas: 24,
  puente_gluteo: 15,
  mountain_climbers: 30,
  sentadilla_isometrica: 25,
};

export const REP_CADENCE: Record<string, number> = {
  sentadillas: 5,
  flexiones: 5,
};

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

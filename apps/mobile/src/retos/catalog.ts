import type { Goal } from '../prefs/types';
import type { Exercise } from './types';

export const EXERCISES: Exercise[] = [
  { id: 'sentadillas', name: 'Sentadillas', unit: 'reps' },
  { id: 'plancha', name: 'Plancha', unit: 'seconds' },
  { id: 'flexiones', name: 'Flexiones', unit: 'reps' },
];

export const DEFAULT_TARGETS: Record<string, number> = {
  sentadillas: 20,
  plancha: 30,
  flexiones: 10,
};

export const GOAL_EXERCISE_ORDER: Record<Goal, string[]> = {
  perder_grasa: ['sentadillas', 'plancha', 'flexiones'],
  ganar_musculo: ['flexiones', 'sentadillas', 'plancha'],
  mantener: ['sentadillas', 'plancha', 'flexiones'],
};

export const GOAL_TARGET_MULTIPLIER: Record<Goal, number> = {
  perder_grasa: 1.2,
  ganar_musculo: 1.1,
  mantener: 1,
};

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

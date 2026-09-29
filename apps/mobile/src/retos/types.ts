import type { Goal } from '../prefs/types';

export interface Exercise {
  id: string;
  unit: 'reps' | 'seconds';
  /** free = parte del pool base; premium = requiere suscripción. Fail-closed. */
  tier: 'free' | 'premium';
}

export interface DailyChallenge {
  date: string;
  exerciseId: string;
  target: number;
  /** Goal used when this challenge was generated; absent only in legacy local data. */
  goal?: Goal;
}

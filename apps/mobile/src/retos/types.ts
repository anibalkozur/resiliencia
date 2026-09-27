import type { Goal } from '../prefs/types';

export interface Exercise {
  id: string;
  unit: 'reps' | 'seconds';
}

export interface DailyChallenge {
  date: string;
  exerciseId: string;
  target: number;
  /** Goal used when this challenge was generated; absent only in legacy local data. */
  goal?: Goal;
}

export interface Exercise {
  id: string;
  unit: 'reps' | 'seconds';
}

export interface DailyChallenge {
  date: string;
  exerciseId: string;
  target: number;
}

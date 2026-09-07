export type TrainingMode = 'home' | 'gym' | 'both';
export type Experience = 'beginner' | 'returning' | 'active';
export type Goal = 'habit' | 'strength' | 'endurance';

export interface Profile {
  name: string;
  mode: TrainingMode;
  experience: Experience;
  goal: Goal;
  exercises: Record<string, number>;
}

export interface StreakState {
  current: number;
  best: number;
  lastDate: string | null;
}

export interface HistoryEntry {
  date: string;
  day: number;
  targets: Record<string, number>;
  totalReps: number;
  felt: null;
}

export interface GameState {
  onboarded: boolean;
  profile: Profile;
  xp: number;
  streak: StreakState;
  history: HistoryEntry[];
  unlocked: string[];
  hadComeback: boolean;
}

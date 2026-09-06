export type Goal = 'perder_grasa' | 'ganar_musculo' | 'mantener';
export type Language = 'es' | 'en' | 'pt';

export interface UserPrefs {
  goal: Goal;
  daysPerWeek: number;
  language: Language;
}

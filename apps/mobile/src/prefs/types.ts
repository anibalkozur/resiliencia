export type Goal =
  'perder_grasa' | 'ganar_musculo' | 'crear_habito' | 'sentirme_mejor' | 'mantener';
export type Language = 'es' | 'en' | 'pt';

export interface UserPrefs {
  goal: Goal;
  /** Días de entrenamiento elegidos por el usuario (0=domingo … 6=sábado). */
  trainingDays: number[];
  language: Language;
  /** El usuario permite aparecer en el ranking público. */
  showInRanking: boolean;
}

export interface UserSport {
  sport: string;
  years: number;
  daysPerWeek: number;
}

export type VisualModel = 'mujer' | 'hombre';

export type ExperienceLevel = 'nunca_entrene' | 'principiante' | 'intermedio' | 'avanzado';

export interface UserProfile {
  id: string;
  nickname: string;
  createdAt: string;
  age?: number;
  weight?: number;
  height?: number;
  visualModel?: VisualModel;
  experienceLevel?: ExperienceLevel;
  sports?: UserSport[];
  waistCm?: number;
}

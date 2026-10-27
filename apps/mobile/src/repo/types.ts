export interface UserSport {
  sport: string;
  years: number;
  daysPerWeek: number;
}

export type VisualModel = 'mujer' | 'hombre';

export interface UserProfile {
  id: string;
  nickname: string;
  createdAt: string;
  age?: number;
  weight?: number;
  height?: number;
  visualModel?: VisualModel;
  sports?: UserSport[];
  waistCm?: number;
}

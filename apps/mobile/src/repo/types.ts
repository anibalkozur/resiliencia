export interface UserSport {
  sport: string;
  years: number;
  daysPerWeek: number;
}

export interface UserProfile {
  id: string;
  nickname: string;
  createdAt: string;
  age?: number;
  weight?: number;
  height?: number;
  sports?: UserSport[];
  waistCm?: number;
}

import type { IRepo, UserProfile, UserSport } from '../repo';
import type { Goal } from '../prefs/types';

export const AGE_MIN = 13;
export const AGE_MAX = 100;
export const WEIGHT_MIN = 30;
export const WEIGHT_MAX = 300;
export const HEIGHT_MIN = 100;
export const HEIGHT_MAX = 250;
export const WAIST_MIN = 40;
export const WAIST_MAX = 250;
export const YEARS_MIN = 0;
export const YEARS_MAX = 40;
export const SPORT_DAYS_MIN = 1;
export const SPORT_DAYS_MAX = 7;
export const WHTR_THRESHOLD = 0.5;
export const WHTR_BORDER = 0.02;
export const MUSCLE_CEILING_BMI = 30;

export const SPORT_CATALOG = [
  'natacion',
  'correr',
  'bici',
  'futbol',
  'gimnasio',
  'crossfit',
  'yoga',
  'artes_marciales',
  'remo',
  'trekking',
  'otros',
] as const;

export type SportId = (typeof SPORT_CATALOG)[number];

export type ProfileMetrics = Pick<UserProfile, 'age' | 'weight' | 'height'>;

export type ProfilePatch = Partial<ProfileMetrics> & {
  sports?: UserSport[];
  waistCm?: number;
};

export function normalizeMetric(
  value: number | undefined,
  min: number,
  max: number,
): number | undefined {
  if (value === undefined || !Number.isFinite(value)) {
    return undefined;
  }
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function buildProfile(nickname: string, existing: UserProfile | null): UserProfile {
  const clean = nickname.trim();
  return {
    id: existing?.id ?? 'u1',
    nickname: clean.length > 0 ? clean : 'Atleta',
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  };
}

export async function createUser(repo: IRepo, nickname: string): Promise<UserProfile> {
  const existing = await repo.getProfile();
  const profile = buildProfile(nickname, existing);
  await repo.saveProfile(profile);
  return profile;
}

export async function updateProfile(repo: IRepo, patch: ProfilePatch): Promise<UserProfile | null> {
  const existing = await repo.getProfile();
  if (!existing) {
    return null;
  }
  const next: UserProfile = {
    ...existing,
    age: normalizeMetric(patch.age, AGE_MIN, AGE_MAX),
    weight: normalizeMetric(patch.weight, WEIGHT_MIN, WEIGHT_MAX),
    height: normalizeMetric(patch.height, HEIGHT_MIN, HEIGHT_MAX),
    sports: patch.sports !== undefined ? normalizeSports(patch.sports) : existing.sports,
    waistCm: patch.waistCm !== undefined ? normalizeWaistCm(patch.waistCm) : existing.waistCm,
  };
  await repo.saveProfile(next);
  return next;
}

export function normalizeSports(input: unknown): UserSport[] {
  if (!Array.isArray(input)) {
    return [];
  }
  const seen = new Set<string>();
  const sports: UserSport[] = [];
  for (const item of input) {
    if (!item || typeof item !== 'object') continue;
    const sport = item as Partial<UserSport>;
    if (
      typeof sport.sport !== 'string' ||
      !(SPORT_CATALOG as readonly string[]).includes(sport.sport)
    ) {
      continue;
    }
    if (seen.has(sport.sport)) {
      continue;
    }
    seen.add(sport.sport);
    sports.push({
      sport: sport.sport,
      years: normalizeMetric(sport.years, YEARS_MIN, YEARS_MAX) ?? YEARS_MIN,
      daysPerWeek: Math.min(
        SPORT_DAYS_MAX,
        Math.max(SPORT_DAYS_MIN, Math.round(sport.daysPerWeek ?? SPORT_DAYS_MIN)),
      ),
    });
  }
  return sports;
}

export function normalizeWaistCm(value: number | undefined): number | undefined {
  return normalizeMetric(value, WAIST_MIN, WAIST_MAX);
}

export function computeWhtr(
  waistCm: number | undefined,
  heightCm: number | undefined,
): number | null {
  if (
    waistCm === undefined ||
    heightCm === undefined ||
    !Number.isFinite(waistCm) ||
    !Number.isFinite(heightCm) ||
    waistCm <= 0 ||
    heightCm <= 0
  ) {
    return null;
  }
  return waistCm / heightCm;
}

export type WhtrZone = 'ok' | 'border' | 'elevated';

export function whtrZone(ratio: number): WhtrZone {
  if (ratio < WHTR_THRESHOLD - WHTR_BORDER) return 'ok';
  if (ratio > WHTR_THRESHOLD + WHTR_BORDER) return 'elevated';
  return 'border';
}

export function habitScore(sports: UserSport[]): number {
  if (sports.length === 0) {
    return 0;
  }
  let best = 0;
  for (const sport of sports) {
    const days = Math.min(sport.daysPerWeek, SPORT_DAYS_MAX) / SPORT_DAYS_MAX;
    const years = Math.min(Math.max(sport.years, YEARS_MIN), 10) / 10;
    best = Math.max(best, 50 * days + 50 * years);
  }
  return Math.round(best);
}

export type BmiContext = 'muscle' | 'none';

export function bmiContext(
  bmi: number | null,
  goal: Goal | undefined,
  sports: UserSport[],
): BmiContext {
  if (bmi === null || !Number.isFinite(bmi)) {
    return 'none';
  }
  if (bmi < 24 || bmi >= MUSCLE_CEILING_BMI) {
    return 'none';
  }
  if (goal === 'ganar_musculo' && sports.length > 0) {
    return 'muscle';
  }
  return 'none';
}

export function muscleTargetWeight(
  bmi: number | null,
  goal: Goal | undefined,
  sports: UserSport[],
  heightCm: number | undefined,
): number | null {
  if (!heightCm || !Number.isFinite(heightCm)) {
    return null;
  }
  if (bmi === null || !Number.isFinite(bmi) || bmi >= MUSCLE_CEILING_BMI) {
    return null;
  }
  if (goal !== 'ganar_musculo' || sports.length === 0) {
    return null;
  }
  return healthyWeightRange(heightCm).maxKg;
}

export type BmiCategory = 'low' | 'normal' | 'over' | 'obese';

export const BMI_LOWER = 18.5;
export const BMI_UPPER = 24.9;

export function computeBmi(weight: number | undefined, height: number | undefined): number | null {
  if (
    weight === undefined ||
    height === undefined ||
    !Number.isFinite(weight) ||
    !Number.isFinite(height) ||
    weight <= 0 ||
    height <= 0
  ) {
    return null;
  }
  const meters = height / 100;
  return weight / (meters * meters);
}

export function bmiCategory(bmi: number): BmiCategory {
  if (bmi < BMI_LOWER) return 'low';
  if (bmi < 25) return 'normal';
  if (bmi < 30) return 'over';
  return 'obese';
}

export interface HealthyWeightRange {
  minKg: number;
  maxKg: number;
}

export function healthyWeightRange(heightCm: number): HealthyWeightRange {
  const meters = heightCm / 100;
  return {
    minKg: BMI_LOWER * meters * meters,
    maxKg: BMI_UPPER * meters * meters,
  };
}

export function weightDeviation(weightKg: number, heightCm: number): number | null {
  const { minKg, maxKg } = healthyWeightRange(heightCm);
  if (weightKg >= minKg && weightKg <= maxKg) return null;
  return weightKg < minKg ? weightKg - minKg : weightKg - maxKg;
}

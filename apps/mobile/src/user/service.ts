import type { IRepo, UserProfile } from '../repo';

export const AGE_MIN = 13;
export const AGE_MAX = 100;
export const WEIGHT_MIN = 30;
export const WEIGHT_MAX = 300;
export const HEIGHT_MIN = 100;
export const HEIGHT_MAX = 250;

export type ProfileMetrics = Pick<UserProfile, 'age' | 'weight' | 'height'>;

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

export async function updateProfile(
  repo: IRepo,
  patch: Partial<ProfileMetrics>,
): Promise<UserProfile | null> {
  const existing = await repo.getProfile();
  if (!existing) {
    return null;
  }
  const next: UserProfile = {
    ...existing,
    age: normalizeMetric(patch.age, AGE_MIN, AGE_MAX),
    weight: normalizeMetric(patch.weight, WEIGHT_MIN, WEIGHT_MAX),
    height: normalizeMetric(patch.height, HEIGHT_MIN, HEIGHT_MAX),
  };
  await repo.saveProfile(next);
  return next;
}

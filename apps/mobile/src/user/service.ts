import type { IRepo, UserProfile } from '../repo';

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

import { describe, expect, it } from '@jest/globals';
import { MemoryRepo } from '../memoryRepo';
import type { IRepo } from '../IRepo';
import type { UserProfile } from '../types';

const profile: UserProfile = {
  id: 'u1',
  nickname: 'Anibal',
  createdAt: '2026-09-06T10:00:00Z',
};

describe('IRepo contract (MemoryRepo)', () => {
  const repo: IRepo = new MemoryRepo();

  it('returns null profile when storage is empty', async () => {
    expect(await repo.getProfile()).toBeNull();
  });

  it('persists and reads a profile', async () => {
    await repo.saveProfile(profile);
    expect(await repo.getProfile()).toEqual(profile);
  });

  it('updates an existing profile', async () => {
    await repo.saveProfile({ ...profile, nickname: 'Nuevo' });
    expect((await repo.getProfile())?.nickname).toBe('Nuevo');
  });

  it('returns null for an unknown setting', async () => {
    expect(await repo.getSetting('onboarded')).toBeNull();
  });

  it('persists and updates a setting', async () => {
    await repo.setSetting('onboarded', 'true');
    expect(await repo.getSetting('onboarded')).toBe('true');
    await repo.setSetting('onboarded', 'false');
    expect(await repo.getSetting('onboarded')).toBe('false');
  });

  it('removes a setting', async () => {
    await repo.setSetting('temp', 'x');
    expect(await repo.getSetting('temp')).toBe('x');
    await repo.removeSetting('temp');
    expect(await repo.getSetting('temp')).toBeNull();
  });

  it('lists persisted keys', async () => {
    await repo.setSetting('sb-abc-auth-token', 't1');
    await repo.setSetting('sb-abc-auth-token-user', 'u1');
    await repo.setSetting('profile', 'p1');
    const keys = await repo.listKeys();
    expect(keys).toEqual(
      expect.arrayContaining(['sb-abc-auth-token', 'sb-abc-auth-token-user', 'profile']),
    );
    expect(keys.filter((k) => k.startsWith('sb-'))).toHaveLength(2);
  });
});

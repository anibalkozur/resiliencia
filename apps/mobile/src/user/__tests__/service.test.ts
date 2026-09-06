import { describe, expect, it } from '@jest/globals';
import { MemoryRepo } from '../../repo/memoryRepo';
import { buildProfile, createUser } from '../service';
import type { UserProfile } from '../../repo/types';

const existing: UserProfile = {
  id: 'u1',
  nickname: 'Anibal',
  createdAt: '2026-09-06T10:00:00Z',
};

describe('buildProfile', () => {
  it('reuses existing id and createdAt', () => {
    const profile = buildProfile('Nuevo', existing);
    expect(profile.id).toBe('u1');
    expect(profile.createdAt).toBe('2026-09-06T10:00:00Z');
    expect(profile.nickname).toBe('Nuevo');
  });

  it('trims the nickname', () => {
    expect(buildProfile('  Anibal  ', existing).nickname).toBe('Anibal');
  });

  it('falls back to Atleta when the nickname is empty', () => {
    expect(buildProfile('   ', existing).nickname).toBe('Atleta');
  });

  it('assigns id and createdAt on first creation', () => {
    const profile = buildProfile('Anibal', null);
    expect(profile.id).toBe('u1');
    expect(new Date(profile.createdAt).getTime()).not.toBeNaN();
  });
});

describe('createUser', () => {
  it('persists the profile through the repo', async () => {
    const repo = new MemoryRepo();
    const profile = await createUser(repo, ' Anibal ');
    expect(await repo.getProfile()).toEqual(profile);
    expect(profile.nickname).toBe('Anibal');
  });
});

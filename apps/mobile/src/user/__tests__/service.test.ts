import { describe, expect, it } from '@jest/globals';
import { MemoryRepo } from '../../repo/memoryRepo';
import {
  AGE_MAX,
  WEIGHT_MAX,
  bmiCategory,
  buildProfile,
  computeBmi,
  createUser,
  normalizeMetric,
  updateProfile,
} from '../service';
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

describe('normalizeMetric', () => {
  it('returns undefined for empty or non-finite values', () => {
    expect(normalizeMetric(undefined, 1, 100)).toBeUndefined();
    expect(normalizeMetric(Number.NaN, 1, 100)).toBeUndefined();
    expect(normalizeMetric(Number.POSITIVE_INFINITY, 1, 100)).toBeUndefined();
  });

  it('rounds and clamps to the valid range', () => {
    expect(normalizeMetric(27.4, 13, 100)).toBe(27);
    expect(normalizeMetric(5, 13, 100)).toBe(13);
    expect(normalizeMetric(999, 13, 100)).toBe(AGE_MAX);
  });
});

describe('updateProfile', () => {
  it('updates metrics and keeps id, nickname and createdAt', async () => {
    const repo = new MemoryRepo();
    await createUser(repo, 'Anibal');
    const updated = await updateProfile(repo, { age: 30, weight: 80, height: 180 });
    expect(updated).toEqual({
      id: 'u1',
      nickname: 'Anibal',
      createdAt: expect.any(String),
      age: 30,
      weight: 80,
      height: 180,
    });
  });

  it('clamps out-of-range metrics', async () => {
    const repo = new MemoryRepo();
    await createUser(repo, 'Anibal');
    const updated = await updateProfile(repo, { age: 250, weight: 5000, height: 4 });
    expect(updated?.age).toBe(AGE_MAX);
    expect(updated?.weight).toBe(WEIGHT_MAX);
    expect(updated?.height).toBe(100);
  });

  it('returns null when there is no profile', async () => {
    const repo = new MemoryRepo();
    expect(await updateProfile(repo, { age: 30 })).toBeNull();
  });
});

describe('computeBmi', () => {
  it('returns null when weight or height are missing', () => {
    expect(computeBmi(undefined, 180)).toBeNull();
    expect(computeBmi(80, undefined)).toBeNull();
    expect(computeBmi(0, 180)).toBeNull();
  });

  it('computes the standard BMI from kg and cm', () => {
    const bmi = computeBmi(80, 180);
    expect(bmi).not.toBeNull();
    expect(Number(bmi?.toFixed(1))).toBeCloseTo(24.7, 1);
  });
});

describe('bmiCategory', () => {
  it('classifies underweight, normal, overweight and obese', () => {
    expect(bmiCategory(18)).toBe('low');
    expect(bmiCategory(22)).toBe('normal');
    expect(bmiCategory(27)).toBe('over');
    expect(bmiCategory(32)).toBe('obese');
  });
});

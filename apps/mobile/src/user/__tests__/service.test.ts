import { describe, expect, it } from '@jest/globals';
import { MemoryRepo } from '../../repo/memoryRepo';
import {
  AGE_MAX,
  SPORT_CATALOG,
  SPORT_DAYS_MAX,
  SPORT_DAYS_MIN,
  WEIGHT_MAX,
  YEARS_MAX,
  bmiCategory,
  bmiContext,
  buildProfile,
  computeBmi,
  computeWhtr,
  createUser,
  habitScore,
  healthyWeightRange,
  muscleTargetWeight,
  normalizeMetric,
  normalizeSports,
  normalizeWaistCm,
  updateProfile,
  weightDeviation,
  whtrZone,
} from '../service';
import type { UserProfile, UserSport } from '../../repo/types';

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

describe('healthyWeightRange', () => {
  it('computes the weight range for a typical height', () => {
    const range = healthyWeightRange(180);
    expect(range.minKg).toBeCloseTo(59.94, 2);
    expect(range.maxKg).toBeCloseTo(80.68, 2);
  });

  it('handles the minimum allowed height', () => {
    const range = healthyWeightRange(100);
    expect(range.minKg).toBeCloseTo(18.5, 2);
    expect(range.maxKg).toBeCloseTo(24.9, 2);
  });

  it('handles the maximum allowed height', () => {
    const range = healthyWeightRange(250);
    expect(range.minKg).toBeCloseTo(115.63, 2);
    expect(range.maxKg).toBeCloseTo(155.63, 2);
  });

  it('returns limits consistent with the BMI thresholds', () => {
    const range = healthyWeightRange(170);
    expect(computeBmi(range.minKg, 170)).toBeCloseTo(18.5, 1);
    expect(computeBmi(range.maxKg, 170)).toBeCloseTo(24.9, 1);
  });
});

describe('weightDeviation', () => {
  it('returns null when the weight is inside the healthy range', () => {
    expect(weightDeviation(70, 170)).toBeNull();
  });

  it('returns null on the lower and upper boundaries', () => {
    const range = healthyWeightRange(170);
    expect(weightDeviation(range.minKg, 170)).toBeNull();
    expect(weightDeviation(range.maxKg, 170)).toBeNull();
  });

  it('reports positive deviation above the healthy range', () => {
    expect(weightDeviation(80, 170)).toBeCloseTo(8.04, 2);
  });

  it('reports negative deviation below the healthy range', () => {
    expect(weightDeviation(45, 180)).toBeCloseTo(-14.94, 2);
  });

  it('stays null at IMC 24.9 and deviates from IMC 25', () => {
    const boundary = healthyWeightRange(170).maxKg;
    expect(weightDeviation(boundary, 170)).toBeNull();
    expect(weightDeviation(boundary + 0.01, 170)).toBeGreaterThan(0);
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

describe('normalizeSports', () => {
  it('returns an empty list for non-array input', () => {
    expect(normalizeSports(undefined)).toEqual([]);
    expect(normalizeSports('natacion')).toEqual([]);
  });

  it('keeps only catalog sports and drops duplicates', () => {
    const sports = normalizeSports([
      { sport: 'natacion', years: 5, daysPerWeek: 3 },
      { sport: 'natacion', years: 9, daysPerWeek: 7 },
      { sport: 'skydiving', years: 2, daysPerWeek: 4 },
      'bogus',
      null,
    ]);
    expect(sports).toEqual([{ sport: 'natacion', years: 5, daysPerWeek: 3 }]);
  });

  it('clamps years and days per week', () => {
    const [sport] = normalizeSports([{ sport: 'correr', years: 999, daysPerWeek: 99 }]);
    expect(sport?.years).toBe(YEARS_MAX);
    expect(sport?.daysPerWeek).toBe(SPORT_DAYS_MAX);
  });

  it('defaults missing years and days to their minimums', () => {
    const [sport] = normalizeSports([{ sport: 'bici' }]);
    expect(sport?.years).toBe(0);
    expect(sport?.daysPerWeek).toBe(SPORT_DAYS_MIN);
  });

  it('accepts every catalog sport', () => {
    const sports = normalizeSports(
      SPORT_CATALOG.map((sport) => ({ sport, years: 1, daysPerWeek: 2 })),
    );
    expect(sports.map((s) => s.sport).sort()).toEqual([...SPORT_CATALOG].sort());
  });
});

describe('normalizeWaistCm', () => {
  it('returns undefined for empty or non-finite values', () => {
    expect(normalizeWaistCm(undefined)).toBeUndefined();
    expect(normalizeWaistCm(Number.NaN)).toBeUndefined();
  });

  it('rounds and clamps to the valid range', () => {
    expect(normalizeWaistCm(84.4)).toBe(84);
    expect(normalizeWaistCm(10)).toBe(40);
    expect(normalizeWaistCm(999)).toBe(250);
  });
});

describe('computeWhtr', () => {
  it('returns null when waist or height are missing', () => {
    expect(computeWhtr(undefined, 180)).toBeNull();
    expect(computeWhtr(80, undefined)).toBeNull();
  });

  it('computes the waist-to-height ratio from cm', () => {
    expect(computeWhtr(80, 180)).toBeCloseTo(0.4444, 4);
    expect(computeWhtr(95, 180)).toBeCloseTo(0.5278, 4);
  });
});

describe('whtrZone', () => {
  it('flags values around the 0.5 cutoff with no verdict in the border', () => {
    expect(whtrZone(0.44)).toBe('ok');
    expect(whtrZone(0.47)).toBe('ok');
    expect(whtrZone(0.49)).toBe('border');
    expect(whtrZone(0.5)).toBe('border');
    expect(whtrZone(0.51)).toBe('border');
    expect(whtrZone(0.53)).toBe('elevated');
    expect(whtrZone(0.6)).toBe('elevated');
  });
});

describe('habitScore', () => {
  it('returns 0 without sports', () => {
    expect(habitScore([])).toBe(0);
  });

  it('scores around the dominant sport', () => {
    const low: UserSport[] = [{ sport: 'yoga', years: 1, daysPerWeek: 2 }];
    const high: UserSport[] = [{ sport: 'remo', years: 10, daysPerWeek: 7 }];
    expect(habitScore(low)).toBeLessThan(habitScore(high));
  });

  it('caps at 100 and floors at a positive value', () => {
    expect(habitScore([{ sport: 'remo', years: 40, daysPerWeek: 7 }])).toBe(100);
    expect(habitScore([{ sport: 'yoga', years: 0, daysPerWeek: 1 }])).toBeGreaterThan(0);
  });
});

describe('bmiContext', () => {
  const sports: UserSport[] = [{ sport: 'natacion', years: 3, daysPerWeek: 3 }];

  it('enables the muscle context for trained users on muscle gain', () => {
    expect(bmiContext(26.5, 'ganar_musculo', sports)).toBe('muscle');
  });

  it('stays silent out of the 24-30 band', () => {
    expect(bmiContext(22, 'ganar_musculo', sports)).toBe('none');
    expect(bmiContext(31, 'ganar_musculo', sports)).toBe('none');
  });

  it('never legitimizes IMC 30 or above', () => {
    expect(bmiContext(30, 'ganar_musculo', sports)).toBe('none');
    expect(bmiContext(35, 'ganar_musculo', sports)).toBe('none');
  });

  it('requires both the muscle goal and declared sports', () => {
    expect(bmiContext(26, 'mantener', sports)).toBe('none');
    expect(bmiContext(26, 'ganar_musculo', [])).toBe('none');
    expect(bmiContext(null, 'ganar_musculo', sports)).toBe('none');
  });
});

describe('muscleTargetWeight', () => {
  const sports: UserSport[] = [{ sport: 'gimnasio', years: 2, daysPerWeek: 4 }];

  it('returns the upper healthy limit for trained muscle gainers', () => {
    const range = healthyWeightRange(183);
    expect(muscleTargetWeight(26.5, 'ganar_musculo', sports, 183)).toBeCloseTo(range.maxKg, 2);
  });

  it('returns null below 30 BMI but also at 30 or above', () => {
    expect(muscleTargetWeight(30, 'ganar_musculo', sports, 183)).toBeNull();
    expect(muscleTargetWeight(24.9, 'ganar_musculo', sports, 183)).not.toBeNull();
  });

  it('requires the muscle goal, sports and a height', () => {
    expect(muscleTargetWeight(26, 'mantener', sports, 183)).toBeNull();
    expect(muscleTargetWeight(26, 'ganar_musculo', [], 183)).toBeNull();
    expect(muscleTargetWeight(26, 'ganar_musculo', sports, undefined)).toBeNull();
  });
});

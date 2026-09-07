import { describe, expect, it } from '@jest/globals';
import { LEVELS, levelForXp, xpForNextLevel } from '../src';

describe('LEVELS', () => {
  it('matches the app.html thresholds', () => {
    expect(LEVELS).toEqual([0, 50, 120, 220, 360, 550, 800, 1150, 1600, 2200, 3000]);
  });
});

describe('levelForXp', () => {
  it.each([
    [-10, 1],
    [0, 1],
    [49, 1],
    [50, 2],
    [119, 2],
    [120, 3],
    [219, 3],
    [220, 4],
    [359, 4],
    [360, 5],
    [549, 5],
    [550, 6],
    [799, 6],
    [800, 7],
    [1149, 7],
    [1150, 8],
    [1599, 8],
    [1600, 9],
    [2199, 9],
    [2200, 10],
    [2999, 10],
    [3000, 11],
    [3500, 11],
    [1000000, 11],
  ])('xp %i => level %i', (xp, lvl) => {
    expect(levelForXp(xp)).toBe(lvl);
  });
});

describe('xpForNextLevel', () => {
  it.each([
    [0, 1, 0, 50],
    [49, 1, 0, 50],
    [50, 2, 50, 120],
    [119, 2, 50, 120],
    [120, 3, 120, 220],
    [359, 4, 220, 360],
    [360, 5, 360, 550],
    [2999, 10, 2200, 3000],
    [3000, 11, 3000, 4000],
    [5000, 11, 3000, 4000],
  ])('xp %i => { lvl: %i, prev: %i, next: %i }', (xp, lvl, prev, next) => {
    expect(xpForNextLevel(xp)).toEqual({ lvl, prev, next });
  });

  it('has no level cap above the last threshold in app.html', () => {
    expect(xpForNextLevel(5000).lvl).toBe(11);
    expect(xpForNextLevel(5000).next).toBe(4000);
  });
});

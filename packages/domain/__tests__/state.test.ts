import { describe, expect, it } from '@jest/globals';
import { freshState } from '../src';

describe('freshState', () => {
  it('matches the app.html default state shape and values', () => {
    expect(freshState()).toEqual({
      onboarded: false,
      profile: {
        name: '',
        mode: 'home',
        experience: 'beginner',
        goal: 'habit',
        exercises: { pushups: 1, squats: 1, situps: 1 },
      },
      xp: 0,
      streak: { current: 0, best: 0, lastDate: null },
      history: [],
      unlocked: [],
      hadComeback: false,
    });
  });

  it('returns a fresh object on every call', () => {
    const a = freshState();
    const b = freshState();
    expect(a).not.toBe(b);
    a.xp = 10;
    expect(b.xp).toBe(0);
  });
});

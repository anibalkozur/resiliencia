export const LEVELS = [0, 50, 120, 220, 360, 550, 800, 1150, 1600, 2200, 3000];

export function levelForXp(xp: number): number {
  let lvl = 1;
  for (let i = 0; i < LEVELS.length; i++) {
    if (xp >= LEVELS[i]) lvl = i + 1;
  }
  return lvl;
}

export interface LevelInfo {
  prev: number;
  next: number;
  lvl: number;
}

export function xpForNextLevel(xp: number): LevelInfo {
  const lvl = levelForXp(xp);
  const next = LEVELS[lvl] ?? LEVELS[LEVELS.length - 1] + 1000;
  const prev = LEVELS[lvl - 1] ?? 0;
  return { prev, next, lvl };
}

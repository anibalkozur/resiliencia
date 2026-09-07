import type { IRepo } from '../repo';
import { getPrefs } from '../prefs/service';
import type { Goal } from '../prefs/types';
import type { DailyChallenge } from './types';
import { DEFAULT_TARGETS, EXERCISES, GOAL_EXERCISE_ORDER, GOAL_TARGET_MULTIPLIER } from './catalog';

export function todayKey(): string {
  const now = new Date();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${m}-${d}`;
}

export function tomorrowKey(): string {
  const now = new Date();
  now.setDate(now.getDate() + 1);
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${m}-${d}`;
}

export function buildChallenge(date: string, goal: Goal = 'mantener'): DailyChallenge {
  const day = parseInt(date.slice(8, 10), 10);
  const ids = GOAL_EXERCISE_ORDER[goal];
  const exerciseId = ids[day % ids.length];
  const exercise = EXERCISES.find((e) => e.id === exerciseId) ?? EXERCISES[0];
  const base = DEFAULT_TARGETS[exercise.id] ?? 10;
  const target = Math.round(base * GOAL_TARGET_MULTIPLIER[goal]);
  return {
    date,
    exerciseId: exercise.id,
    target,
  };
}

function storageKey(date: string): string {
  return `reto:${date}`;
}

export async function getTodayChallenge(repo: IRepo): Promise<DailyChallenge> {
  const date = todayKey();
  const raw = await repo.getSetting(storageKey(date));
  if (raw) {
    return JSON.parse(raw) as DailyChallenge;
  }
  const prefs = await getPrefs(repo);
  const challenge = buildChallenge(date, prefs.goal);
  await repo.setSetting(storageKey(date), JSON.stringify(challenge));
  return challenge;
}

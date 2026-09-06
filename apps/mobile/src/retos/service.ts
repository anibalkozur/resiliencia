import type { IRepo } from '../repo';
import type { DailyChallenge } from './types';
import { EXERCISES, DEFAULT_TARGETS } from './catalog';

export function todayKey(): string {
  const now = new Date();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${m}-${d}`;
}

export function buildChallenge(date: string): DailyChallenge {
  const day = new Date(date).getDate();
  const exercise = EXERCISES[day % EXERCISES.length];
  return {
    date,
    exerciseId: exercise.id,
    target: DEFAULT_TARGETS[exercise.id] ?? 10,
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
  const challenge = buildChallenge(date);
  await repo.setSetting(storageKey(date), JSON.stringify(challenge));
  return challenge;
}

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

function isoWeekday(date: Date): number {
  const day = date.getDay();
  return day === 0 ? 7 : day;
}

function isoWeekNumber(date: Date): number {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNr = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const firstDayNr = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNr + 3);
  return 1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000));
}

export function buildChallenge(date: string, goal: Goal = 'mantener'): DailyChallenge {
  const [y, m, d] = date.split('-').map(Number);
  const parsed = new Date(y, m - 1, d);
  const ids = GOAL_EXERCISE_ORDER[goal];
  const index = (isoWeekNumber(parsed) + isoWeekday(parsed)) % ids.length;
  const exerciseId = ids[index];
  const exercise = EXERCISES.find((e) => e.id === exerciseId) ?? EXERCISES[0];
  const base = DEFAULT_TARGETS[exercise.id] ?? 10;
  const target = Math.round(base * GOAL_TARGET_MULTIPLIER[goal]);
  return {
    date,
    exerciseId: exercise.id,
    target,
    goal,
  };
}

export function inferChallengeGoal(
  challenge: Pick<DailyChallenge, 'date' | 'exerciseId' | 'target'>,
): Goal | null {
  const goals = Object.keys(GOAL_EXERCISE_ORDER) as Goal[];
  return (
    goals.find((goal) => {
      const expected = buildChallenge(challenge.date, goal);
      return expected.exerciseId === challenge.exerciseId && expected.target === challenge.target;
    }) ?? null
  );
}

function storageKey(date: string): string {
  return `reto:${date}`;
}

export async function getStoredChallenge(
  repo: IRepo,
  date: string,
): Promise<DailyChallenge | null> {
  const raw = await repo.getSetting(storageKey(date));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<DailyChallenge>;
    if (
      parsed.date === date &&
      typeof parsed.exerciseId === 'string' &&
      parsed.exerciseId.length > 0 &&
      typeof parsed.target === 'number' &&
      Number.isInteger(parsed.target) &&
      parsed.target > 0
    ) {
      const stored = {
        date: parsed.date,
        exerciseId: parsed.exerciseId,
        target: parsed.target,
      };
      const goal =
        parsed.goal && parsed.goal in GOAL_EXERCISE_ORDER
          ? parsed.goal
          : inferChallengeGoal(stored);
      return { ...parsed, goal } as DailyChallenge;
    }
  } catch {
    // El reto se puede reconstruir abajo si el dato local está corrupto.
  }
  return null;
}

export async function getTodayChallenge(repo: IRepo): Promise<DailyChallenge> {
  const date = todayKey();
  const stored = await getStoredChallenge(repo, date);
  if (stored) return stored;
  const prefs = await getPrefs(repo);
  const challenge = buildChallenge(date, prefs.goal);
  await repo.setSetting(storageKey(date), JSON.stringify(challenge));
  return challenge;
}

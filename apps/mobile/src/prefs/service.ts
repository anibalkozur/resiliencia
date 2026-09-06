import type { IRepo } from '../repo';
import type { Goal, Language, UserPrefs } from './types';

const PREFS_KEY = 'prefs';

export const DEFAULT_PREFS: UserPrefs = {
  goal: 'mantener',
  daysPerWeek: 4,
  language: 'es',
};

export const MIN_DAYS = 2;
export const MAX_DAYS = 6;

export const GOAL_LABELS: Record<Goal, string> = {
  perder_grasa: 'Perder grasa',
  ganar_musculo: 'Ganar músculo',
  mantener: 'Mantener',
};

export const LANGUAGE_OPTIONS: { code: Language; label: string }[] = [
  { code: 'es', label: 'Español' },
  { code: 'en', label: 'English' },
  { code: 'pt', label: 'Português' },
];

export function normalizePrefs(input: Partial<UserPrefs> | undefined): UserPrefs {
  const goal: Goal = input?.goal && input.goal in GOAL_LABELS ? input.goal : DEFAULT_PREFS.goal;
  const language: Language =
    input?.language && LANGUAGE_OPTIONS.some((option) => option.code === input.language)
      ? input.language
      : DEFAULT_PREFS.language;
  const daysPerWeek = Math.min(
    MAX_DAYS,
    Math.max(MIN_DAYS, input?.daysPerWeek ?? DEFAULT_PREFS.daysPerWeek),
  );
  return { goal, daysPerWeek, language };
}

export async function getPrefs(repo: IRepo): Promise<UserPrefs> {
  const raw = await repo.getSetting(PREFS_KEY);
  if (raw) {
    return normalizePrefs(JSON.parse(raw) as Partial<UserPrefs>);
  }
  await repo.setSetting(PREFS_KEY, JSON.stringify(DEFAULT_PREFS));
  return DEFAULT_PREFS;
}

export async function savePrefs(repo: IRepo, prefs: Partial<UserPrefs>): Promise<UserPrefs> {
  const current = await getPrefs(repo);
  const safe = normalizePrefs({ ...current, ...prefs });
  await repo.setSetting(PREFS_KEY, JSON.stringify(safe));
  return safe;
}

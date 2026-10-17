import type { IRepo } from '../repo';
import type { Goal, Language, UserPrefs } from './types';

const PREFS_KEY = 'prefs';

// Días de entrenamiento por defecto: lunes, miércoles, viernes y sábado.
export const DEFAULT_TRAINING_DAYS: number[] = [1, 3, 5, 6];

export const DEFAULT_PREFS: UserPrefs = {
  goal: 'mantener',
  trainingDays: DEFAULT_TRAINING_DAYS,
  language: 'es',
  showInRanking: true,
};

// Migración de la preferencia vieja `daysPerWeek` (cantidad) a días concretos.
// Índice = cantidad de días; valores = dayOfWeek (0=domingo … 6=sábado).
const LEGACY_TRAINING_SLOTS: Record<number, number[]> = {
  2: [1, 4],
  3: [1, 3, 5],
  4: [1, 3, 5, 6],
  5: [1, 2, 3, 5, 6],
  6: [1, 2, 3, 4, 5, 6],
};

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

function normalizeTrainingDays(input: { trainingDays?: unknown; daysPerWeek?: unknown }): number[] {
  if (Array.isArray(input.trainingDays)) {
    const days = Array.from(
      new Set(
        input.trainingDays.filter(
          (day): day is number =>
            typeof day === 'number' && Number.isInteger(day) && day >= 0 && day <= 6,
        ),
      ),
    ).sort((a, b) => a - b);
    if (days.length > 0) return days;
  }
  if (typeof input.daysPerWeek === 'number' && Number.isFinite(input.daysPerWeek)) {
    const legacy = LEGACY_TRAINING_SLOTS[Math.min(6, Math.max(2, Math.round(input.daysPerWeek)))];
    if (legacy) return legacy;
  }
  return DEFAULT_TRAINING_DAYS;
}
export function normalizePrefs(input: Partial<UserPrefs> | undefined): UserPrefs {
  const goal = input?.goal && input.goal in GOAL_LABELS ? (input.goal as Goal) : DEFAULT_PREFS.goal;
  const language =
    input?.language && LANGUAGE_OPTIONS.some((option) => option.code === input.language)
      ? (input.language as Language)
      : DEFAULT_PREFS.language;
  const trainingDays = normalizeTrainingDays({
    trainingDays: input?.trainingDays,
    daysPerWeek: (input as { daysPerWeek?: unknown } | undefined)?.daysPerWeek,
  });
  const showInRanking = typeof input?.showInRanking === 'boolean' ? input.showInRanking : true;
  return { goal, trainingDays, language, showInRanking };
}

export async function getPrefs(repo: IRepo): Promise<UserPrefs> {
  const raw = await repo.getSetting(PREFS_KEY);
  if (raw) {
    try {
      return normalizePrefs(JSON.parse(raw) as Partial<UserPrefs>);
    } catch {
      await repo.removeSetting(PREFS_KEY);
    }
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

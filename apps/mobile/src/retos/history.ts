import { EXERCISES } from './catalog';
import type { FreeSession } from './freeSessions';

export interface HistoryEntry {
  key: string;
  date: string;
  exerciseId: string;
  value: number;
  target: number;
  unit: 'reps' | 'seconds';
  source: 'retos' | 'libre';
  ranked?: boolean;
}

export interface DailyHistoryInput {
  date: string;
  exerciseId: string;
  value: number;
  target: number;
  unit: 'reps' | 'seconds';
}

export function unitForExercise(exerciseId: string): 'reps' | 'seconds' {
  const exercise = EXERCISES.find((e) => e.id === exerciseId);
  return exercise?.unit === 'seconds' ? 'seconds' : 'reps';
}

// Une los retos diarios completados con las sesiones libres en una sola lista de
// "ejercicios realizados". Es puramente local (offline-first): no depende del
// backend, así que la UI puede mostrarla aunque el ranking todavía esté vacío.
export function buildHistory(
  free: readonly FreeSession[],
  daily: readonly DailyHistoryInput[],
): HistoryEntry[] {
  const entries: HistoryEntry[] = [];

  for (const item of daily) {
    entries.push({
      key: `reto:${item.date}`,
      date: item.date,
      exerciseId: item.exerciseId,
      value: item.value,
      target: item.target,
      unit: item.unit,
      source: 'retos',
    });
  }

  free.forEach((session, index) => {
    entries.push({
      key: `libre:${session.clientOpId ?? `${session.date}:${index}`}`,
      date: session.date,
      exerciseId: session.exerciseId,
      value: session.value,
      target: session.target,
      unit: unitForExercise(session.exerciseId),
      source: 'libre',
      ranked: session.ranked,
    });
  });

  return entries.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

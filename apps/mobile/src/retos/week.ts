import { buildChallenge } from './service';
import type { Goal } from '../prefs/types';

export interface WeekDay {
  date: string;
  dayOfWeek: number;
  isTraining: boolean;
  isToday: boolean;
  exerciseId: string | null;
  target: number | null;
}

function iso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function mondayOf(d: Date): Date {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  return copy;
}

export function buildWeek(
  goal: Goal,
  trainingDays: readonly number[],
  today: Date = new Date(),
): WeekDay[] {
  const monday = mondayOf(today);
  const todayIso = iso(today);
  const days: WeekDay[] = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const date = iso(d);
    const isTraining = trainingDays.includes(d.getDay());

    if (isTraining) {
      const challenge = buildChallenge(date, goal);
      days.push({
        date,
        dayOfWeek: d.getDay(),
        isTraining: true,
        isToday: date === todayIso,
        exerciseId: challenge.exerciseId,
        target: challenge.target,
      });
    } else {
      days.push({
        date,
        dayOfWeek: d.getDay(),
        isTraining: false,
        isToday: date === todayIso,
        exerciseId: null,
        target: null,
      });
    }
  }

  return days;
}

// Primer día con reto posterior a `today` (mira hasta dos semanas). Sirve para
// avisar "mañana vuelven los retos" o el próximo día concreto.
export function buildNextTraining(
  goal: Goal,
  trainingDays: readonly number[],
  today: Date = new Date(),
): WeekDay | null {
  for (let i = 1; i <= 14; i++) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
    const day = buildWeek(goal, trainingDays, d).find((x) => x.isToday);
    if (day && day.isTraining) return day;
  }
  return null;
}

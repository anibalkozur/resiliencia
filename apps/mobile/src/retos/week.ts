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

export function buildWeek(goal: Goal, daysPerWeek: number, today: Date = new Date()): WeekDay[] {
  const monday = mondayOf(today);
  const todayIso = iso(today);
  const days: WeekDay[] = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const date = iso(d);
    const isTraining = i < daysPerWeek;

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

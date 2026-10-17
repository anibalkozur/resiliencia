import type { TranslationKey } from '../i18n/translations';

export type RankPeriod = 'day' | 'week' | 'month' | 'year' | 'all';
export const RANK_PERIODS: readonly RankPeriod[] = ['day', 'week', 'month', 'year', 'all'];

function startOfDay(value: Date): Date {
  const day = new Date(value.getFullYear(), value.getMonth(), value.getDate());
  day.setHours(0, 0, 0, 0);
  return day;
}

function startOfWeek(value: Date): Date {
  const mondayOffset = (value.getDay() + 6) % 7;
  const day = new Date(value.getFullYear(), value.getMonth(), value.getDate() - mondayOffset);
  day.setHours(0, 0, 0, 0);
  return day;
}

export function rankPeriodSince(period: RankPeriod, now: Date = new Date()): string | null {
  switch (period) {
    case 'day':
      return startOfDay(now).toISOString();
    case 'week':
      return startOfWeek(now).toISOString();
    case 'month':
      return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    case 'year':
      return new Date(now.getFullYear(), 0, 1).toISOString();
    case 'all':
    default:
      return null;
  }
}

export function rankPeriodLabelKey(period: RankPeriod): TranslationKey {
  switch (period) {
    case 'day':
      return 'progress.period_day';
    case 'week':
      return 'progress.period_week';
    case 'month':
      return 'progress.period_month';
    case 'year':
      return 'progress.period_year';
    case 'all':
    default:
      return 'progress.period_all';
  }
}

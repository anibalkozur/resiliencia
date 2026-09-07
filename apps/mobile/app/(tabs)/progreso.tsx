import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '@resiliencia/design-tokens';
import { getRepo } from '../../src/repo';
import { getBestStreak } from '../../src/retos/streak';
import { getTotalCompleted } from '../../src/retos/completions';
import { useUser } from '../../src/user/UserProvider';
import { usePrefs } from '../../src/prefs/PrefsProvider';
import { translate } from '../../src/i18n/translations';
import type { TranslationKey } from '../../src/i18n/translations';

const WEEKDAYS: TranslationKey[] = [
  'weekday.sun',
  'weekday.mon',
  'weekday.tue',
  'weekday.wed',
  'weekday.thu',
  'weekday.fri',
  'weekday.sat',
];

function daysSince(iso: string): number {
  const created = new Date(iso);
  const now = new Date();
  return Math.max(0, Math.floor((now.getTime() - created.getTime()) / 86_400_000));
}

function localDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

interface WeekCell {
  key: string;
  done: boolean;
  label: TranslationKey;
}

export default function ProgresoScreen() {
  const { profile } = useUser();
  const { prefs } = usePrefs();
  const lang = prefs?.language ?? 'es';
  const repo = getRepo();
  const [best, setBest] = useState(0);
  const [total, setTotal] = useState(0);
  const [week, setWeek] = useState<WeekCell[]>([]);

  useEffect(() => {
    getBestStreak(repo).then(setBest);
    getTotalCompleted(repo).then(setTotal);

    (async () => {
      const cells: WeekCell[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const raw = await repo.getSetting(`completed:${localDate(d)}`);
        cells.push({ key: localDate(d), done: raw === '1', label: WEEKDAYS[d.getDay()] });
      }
      setWeek(cells);
    })();
  }, [repo]);

  const days = profile ? daysSince(profile.createdAt) : 0;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{translate(lang, 'progress.title')}</Text>

      <View style={styles.row}>
        <View style={styles.metric}>
          <Text style={styles.metricValue}>{best}</Text>
          <Text style={styles.metricLabel}>{translate(lang, 'progress.best_streak')}</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricValue}>{total}</Text>
          <Text style={styles.metricLabel}>{translate(lang, 'progress.completed')}</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricValue}>{days}</Text>
          <Text style={styles.metricLabel}>{translate(lang, 'progress.days')}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>{translate(lang, 'progress.week')}</Text>
        <View style={styles.weekRow}>
          {week.map((cell) => (
            <View key={cell.key} style={[styles.weekCell, cell.done && styles.weekCellDone]}>
              <Text style={[styles.weekLabel, cell.done && styles.weekLabelDone]}>
                {translate(lang, cell.label)}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.emptyCard}>
        <Text style={styles.emptyTitle}>{translate(lang, 'progress.empty_title')}</Text>
        <Text style={styles.emptyBody}>{translate(lang, 'progress.empty_body')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  title: {
    color: colors.silver,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 1,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  metric: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: spacing.lg,
  },
  metricValue: {
    color: colors.silver,
    fontSize: 28,
    fontWeight: '800',
  },
  metricLabel: {
    color: colors.silverDim,
    fontSize: 10,
    letterSpacing: 1,
    marginTop: spacing.xs,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    marginTop: spacing.xl,
    padding: spacing.lg,
  },
  cardLabel: {
    color: colors.silverDim,
    fontSize: 12,
    letterSpacing: 2,
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  weekCell: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekCellDone: {
    backgroundColor: colors.teal,
    borderColor: colors.teal,
  },
  weekLabel: {
    color: colors.silverDim,
    fontSize: 12,
    fontWeight: '700',
  },
  weekLabelDone: {
    color: colors.bg,
  },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    marginTop: spacing.xl,
    padding: spacing.lg,
  },
  emptyTitle: {
    color: colors.silver,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1,
  },
  emptyBody: {
    color: colors.silverDim,
    fontSize: 13,
    lineHeight: 19,
    marginTop: spacing.sm,
  },
});

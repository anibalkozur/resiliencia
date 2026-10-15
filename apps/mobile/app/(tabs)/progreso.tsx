import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { colors, radius, spacing } from '@resiliencia/design-tokens';
import { getRepo } from '../../src/repo';
import { getBestStreak } from '../../src/retos/streak';
import {
  getCompletedDates,
  getCompletionMeta,
  getTotalCompleted,
} from '../../src/retos/completions';
import { buildChallenge, getStoredChallenge } from '../../src/retos/service';
import { getFreeSessions } from '../../src/retos/freeSessions';
import {
  buildHistory,
  unitForExercise,
  type DailyHistoryInput,
  type HistoryEntry,
} from '../../src/retos/history';
import { exerciseNameKey } from '../../src/retos/catalog';
import { useUser } from '../../src/user/UserProvider';
import { usePrefs } from '../../src/prefs/PrefsProvider';
import { useDayKey } from '../../src/retos/DayProvider';
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
  const dayKey = useDayKey();
  const [best, setBest] = useState(0);
  const [total, setTotal] = useState(0);
  const [week, setWeek] = useState<WeekCell[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const goal = prefs?.goal;

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const [nextBest, nextTotal, free, dates] = await Promise.all([
          getBestStreak(repo),
          getTotalCompleted(repo),
          getFreeSessions(repo),
          getCompletedDates(repo),
        ]);
        const cells: WeekCell[] = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date(`${dayKey}T00:00:00`);
          d.setDate(d.getDate() - i);
          const raw = await repo.getSetting(`completed:${localDate(d)}`);
          cells.push({ key: localDate(d), done: raw === '1', label: WEEKDAYS[d.getDay()] });
        }
        const daily: DailyHistoryInput[] = [];
        for (const date of dates) {
          const [meta, stored] = await Promise.all([
            getCompletionMeta(repo, date),
            getStoredChallenge(repo, date),
          ]);
          const challenge = stored ?? buildChallenge(date, goal ?? 'mantener');
          daily.push({
            date,
            exerciseId: challenge.exerciseId,
            value: meta?.value ?? challenge.target,
            target: meta?.target ?? challenge.target,
            unit: meta?.unit ?? unitForExercise(challenge.exerciseId),
          });
        }
        const nextHistory = buildHistory(free, daily);
        if (!active) return;
        setBest(nextBest);
        setTotal(nextTotal);
        setWeek(cells);
        setHistory(nextHistory);
      })();
      return () => {
        active = false;
      };
    }, [repo, dayKey, goal]),
  );

  const days = profile ? daysSince(profile.createdAt) : 0;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
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

      <View style={styles.card}>
        <Text style={styles.cardLabel}>{translate(lang, 'progress.history')}</Text>
        <Text style={styles.historyNote}>{translate(lang, 'progress.history_note')}</Text>
        {history.length === 0 ? (
          <>
            <Text style={styles.emptyTitle}>{translate(lang, 'progress.empty_title')}</Text>
            <Text style={styles.emptyBody}>{translate(lang, 'progress.empty_body')}</Text>
          </>
        ) : (
          history.map((entry) => (
            <View key={entry.key} style={styles.historyRow}>
              <View style={styles.historyInfo}>
                <Text style={styles.historyName} numberOfLines={1}>
                  {translate(lang, exerciseNameKey(entry.exerciseId))}
                </Text>
                <Text style={styles.historySub}>
                  {entry.date} ·{' '}
                  {translate(
                    lang,
                    entry.source === 'libre' ? 'progress.history_libre' : 'progress.history_retos',
                  )}
                </Text>
              </View>
              <Text style={styles.historyValue}>
                {entry.value}/{entry.target}{' '}
                {translate(lang, entry.unit === 'seconds' ? 'unit.seconds' : 'unit.reps')}
              </Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  container: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
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
  emptyTitle: {
    color: colors.silver,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: spacing.md,
  },
  emptyBody: {
    color: colors.silverDim,
    fontSize: 13,
    lineHeight: 19,
    marginTop: spacing.sm,
  },
  historyNote: {
    color: colors.teal,
    fontSize: 11,
    lineHeight: 16,
    marginTop: spacing.xs,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingVertical: spacing.md,
  },
  historyInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  historyName: {
    color: colors.silver,
    fontSize: 14,
    fontWeight: '700',
  },
  historySub: {
    color: colors.silverDim,
    fontSize: 11,
    marginTop: 2,
  },
  historyValue: {
    color: colors.teal,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});

import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { colors, radius, spacing } from '@resiliencia/design-tokens';
import { getRepo } from '../../src/repo';
import { getBestStreak } from '../../src/retos/streak';
import { getTotalCompleted } from '../../src/retos/completions';
import { useUser } from '../../src/user/UserProvider';
import { useAuth } from '../../src/auth/AuthProvider';
import { usePrefs } from '../../src/prefs/PrefsProvider';
import { getSupabase } from '../../src/auth/supabase';
import { fetchRanking, type RankingRow } from '../../src/sync/syncService';
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
  const { session } = useAuth();
  const { prefs } = usePrefs();
  const lang = prefs?.language ?? 'es';
  const repo = getRepo();
  const [best, setBest] = useState(0);
  const [total, setTotal] = useState(0);
  const [week, setWeek] = useState<WeekCell[]>([]);
  const [ranking, setRanking] = useState<RankingRow[]>([]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const [nextBest, nextTotal] = await Promise.all([
          getBestStreak(repo),
          getTotalCompleted(repo),
        ]);
        const cells: WeekCell[] = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const raw = await repo.getSetting(`completed:${localDate(d)}`);
          cells.push({ key: localDate(d), done: raw === '1', label: WEEKDAYS[d.getDay()] });
        }
        if (!active) return;
        setBest(nextBest);
        setTotal(nextTotal);
        setWeek(cells);
      })();
      return () => {
        active = false;
      };
    }, [repo]),
  );

  useFocusEffect(
    useCallback(() => {
      const client = getSupabase();
      if (!session || !client) {
        return;
      }
      let active = true;
      fetchRanking(client).then((rows) => {
        if (active) {
          setRanking(rows);
        }
      });
      return () => {
        active = false;
      };
    }, [session]),
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

      <View style={styles.emptyCard}>
        <Text style={styles.emptyTitle}>{translate(lang, 'progress.empty_title')}</Text>
        <Text style={styles.emptyBody}>{translate(lang, 'progress.empty_body')}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>{translate(lang, 'progress.ranking')}</Text>
        {ranking.length === 0 ? (
          <Text style={styles.rankingEmpty}>{translate(lang, 'progress.ranking_empty')}</Text>
        ) : (
          ranking.map((entry, index) => {
            const isMe = entry.user_id === profile?.id;
            return (
              <View key={entry.user_id} style={[styles.rankRow, isMe && styles.rankRowMe]}>
                <Text style={styles.rankPos}>{index + 1}</Text>
                <View style={styles.rankInfo}>
                  <Text style={[styles.rankName, isMe && styles.rankNameMe]} numberOfLines={1}>
                    {isMe ? translate(lang, 'progress.you') : entry.nickname}
                  </Text>
                  <Text style={styles.rankSub}>
                    {entry.current_streak} {translate(lang, 'progress.rank_streak')}
                  </Text>
                </View>
                <Text style={styles.rankValue}>
                  {entry.completed_challenges} {translate(lang, 'progress.rank_challenges')}
                </Text>
              </View>
            );
          })
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
  rankingEmpty: {
    color: colors.silverDim,
    fontSize: 13,
    lineHeight: 19,
    marginTop: spacing.sm,
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingVertical: spacing.md,
  },
  rankRowMe: {
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
  },
  rankPos: {
    color: colors.silverDim,
    fontSize: 14,
    fontWeight: '800',
    width: 28,
    textAlign: 'center',
  },
  rankInfo: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  rankName: {
    color: colors.silver,
    fontSize: 14,
    fontWeight: '700',
  },
  rankNameMe: {
    color: colors.teal,
  },
  rankSub: {
    color: colors.silverDim,
    fontSize: 11,
    marginTop: 2,
  },
  rankValue: {
    color: colors.teal,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});

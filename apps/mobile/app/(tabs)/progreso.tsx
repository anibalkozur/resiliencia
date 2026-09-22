import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { colors, radius, spacing } from '@resiliencia/design-tokens';
import { getRepo } from '../../src/repo';
import { getBestStreak } from '../../src/retos/streak';
import { getTotalCompleted } from '../../src/retos/completions';
import { EXERCISES, exerciseNameKey } from '../../src/retos/catalog';
import { useUser } from '../../src/user/UserProvider';
import { useAuth } from '../../src/auth/AuthProvider';
import { usePrefs } from '../../src/prefs/PrefsProvider';
import { getSupabase } from '../../src/auth/supabase';
import {
  fetchRanking,
  fetchRepsRanking,
  fetchTotalRepsRanking,
  type RankingRow,
  type RepsRankingRow,
  type TotalRepsRankingRow,
} from '../../src/sync/syncService';
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

type RankTab = 'streak' | 'reps' | 'total';
const RANK_TABS: RankTab[] = ['streak', 'reps', 'total'];

function rankTabLabel(tab: RankTab): TranslationKey {
  switch (tab) {
    case 'reps':
      return 'progress.rank_reps';
    case 'total':
      return 'progress.rank_total';
    default:
      return 'progress.rank_streak';
  }
}

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
  const dayKey = useDayKey();
  const [best, setBest] = useState(0);
  const [total, setTotal] = useState(0);
  const [week, setWeek] = useState<WeekCell[]>([]);
  const [ranking, setRanking] = useState<RankingRow[]>([]);
  const [tab, setTab] = useState<RankTab>('streak');
  const [repsExercise, setRepsExercise] = useState('sentadillas');
  const [repsRanking, setRepsRanking] = useState<RepsRankingRow[]>([]);
  const [totalRanking, setTotalRanking] = useState<TotalRepsRankingRow[]>([]);

  useEffect(() => {
    const client = getSupabase();
    if (!session || !client || tab === 'streak') {
      return;
    }
    let active = true;
    if (tab === 'reps') {
      fetchRepsRanking(client, repsExercise).then((rows) => {
        if (active) {
          setRepsRanking(rows);
        }
      });
    } else {
      fetchTotalRepsRanking(client).then((rows) => {
        if (active) {
          setTotalRanking(rows);
        }
      });
    }
    return () => {
      active = false;
    };
  }, [session, tab, repsExercise]);

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
          const d = new Date(`${dayKey}T00:00:00`);
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
    }, [repo, dayKey]),
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
        <View style={styles.tabsRow}>
          {RANK_TABS.map((t) => (
            <Pressable
              key={t}
              style={[styles.tab, tab === t && styles.tabActive]}
              onPress={() => setTab(t)}
            >
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                {translate(lang, rankTabLabel(t))}
              </Text>
            </Pressable>
          ))}
        </View>

        {!session ? (
          <Text style={styles.rankingEmpty}>{translate(lang, 'progress.ranking_empty')}</Text>
        ) : tab === 'streak' ? (
          ranking.length === 0 ? (
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
          )
        ) : tab === 'reps' ? (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.chipsRow}
              contentContainerStyle={styles.chipsContent}
            >
              {EXERCISES.map((ex) => {
                const active = ex.id === repsExercise;
                return (
                  <Pressable
                    key={ex.id}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setRepsExercise(ex.id)}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {translate(lang, exerciseNameKey(ex.id))}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            {repsRanking.length === 0 ? (
              <Text style={styles.rankingEmpty}>{translate(lang, 'progress.ranking_empty')}</Text>
            ) : (
              repsRanking.map((entry, index) => {
                const isMe = entry.user_id === profile?.id;
                return (
                  <View key={entry.user_id} style={[styles.rankRow, isMe && styles.rankRowMe]}>
                    <Text style={styles.rankPos}>{index + 1}</Text>
                    <View style={styles.rankInfo}>
                      <Text style={[styles.rankName, isMe && styles.rankNameMe]} numberOfLines={1}>
                        {isMe ? translate(lang, 'progress.you') : entry.nickname}
                      </Text>
                      <Text style={styles.rankSub}>
                        {entry.sessions} {translate(lang, 'progress.rank_sessions')}
                      </Text>
                    </View>
                    <Text style={styles.rankValue}>
                      {entry.best_value} {translate(lang, 'progress.rank_reps')}
                    </Text>
                  </View>
                );
              })
            )}
          </>
        ) : totalRanking.length === 0 ? (
          <Text style={styles.rankingEmpty}>{translate(lang, 'progress.ranking_empty')}</Text>
        ) : (
          totalRanking.map((entry, index) => {
            const isMe = entry.user_id === profile?.id;
            return (
              <View key={entry.user_id} style={[styles.rankRow, isMe && styles.rankRowMe]}>
                <Text style={styles.rankPos}>{index + 1}</Text>
                <View style={styles.rankInfo}>
                  <Text style={[styles.rankName, isMe && styles.rankNameMe]} numberOfLines={1}>
                    {isMe ? translate(lang, 'progress.you') : entry.nickname}
                  </Text>
                </View>
                <Text style={styles.rankValue}>{entry.total_value}</Text>
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
  tabsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: spacing.sm,
  },
  tabActive: {
    borderColor: colors.teal,
    backgroundColor: 'rgba(45, 212, 168, 0.08)',
  },
  tabText: {
    color: colors.silverDim,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  tabTextActive: {
    color: colors.teal,
  },
  chipsRow: {
    marginTop: spacing.md,
  },
  chipsContent: {
    gap: spacing.sm,
    paddingRight: spacing.sm,
  },
  chip: {
    backgroundColor: colors.bg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipActive: {
    borderColor: colors.teal,
    backgroundColor: 'rgba(45, 212, 168, 0.08)',
  },
  chipText: {
    color: colors.silverDim,
    fontSize: 12,
    fontWeight: '700',
  },
  chipTextActive: {
    color: colors.teal,
  },
});

import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { colors, radius, spacing } from '@resiliencia/design-tokens';
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
import {
  RANK_PERIODS,
  rankPeriodLabelKey,
  rankPeriodSince,
  type RankPeriod,
} from '../../src/sync/rankingPeriods';
import { translate } from '../../src/i18n/translations';
import type { TranslationKey } from '../../src/i18n/translations';
import { usePremium } from '../../src/premium/usePremium';

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

export default function RankingScreen() {
  const { profile } = useUser();
  const { session } = useAuth();
  const { prefs } = usePrefs();
  const lang = prefs?.language ?? 'es';
  const premium = usePremium();
  const [ranking, setRanking] = useState<RankingRow[]>([]);
  const [tab, setTab] = useState<RankTab>('streak');
  const [period, setPeriod] = useState<RankPeriod>('all');
  const [repsExercise, setRepsExercise] = useState('sentadillas');
  const [repsRanking, setRepsRanking] = useState<RepsRankingRow[]>([]);
  const [totalRanking, setTotalRanking] = useState<TotalRepsRankingRow[]>([]);
  const emptyKey: TranslationKey =
    period !== 'all' ? 'progress.period_empty' : 'progress.ranking_empty';

  useEffect(() => {
    const client = getSupabase();
    if (!session || !client || tab === 'streak') {
      return;
    }
    let active = true;
    const since = rankPeriodSince(period);
    if (tab === 'reps') {
      fetchRepsRanking(client, repsExercise, 10, since).then((rows) => {
        if (active) {
          setRepsRanking(rows);
        }
      });
    } else {
      fetchTotalRepsRanking(client, 10, since).then((rows) => {
        if (active) {
          setTotalRanking(rows);
        }
      });
    }
    return () => {
      active = false;
    };
  }, [session, tab, repsExercise, period]);

  useFocusEffect(
    useCallback(() => {
      const client = getSupabase();
      if (!session || !client) {
        return;
      }
      let active = true;
      fetchRanking(client, 50, rankPeriodSince(period)).then((rows) => {
        if (active) {
          setRanking(rows);
        }
      });
      return () => {
        active = false;
      };
    }, [session, period]),
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.cardLabel}>{translate(lang, 'progress.ranking')}</Text>
        <Text style={styles.rankingNote}>{translate(lang, 'progress.ranking_note')}</Text>
        {!premium ? (
          <Text style={styles.rankingPremium}>{translate(lang, 'progress.ranking_premium')}</Text>
        ) : null}
        <View style={styles.periodsRow}>
          {RANK_PERIODS.map((p) => {
            const active = p === period;
            return (
              <Pressable
                key={p}
                style={[styles.periodChip, active && styles.periodChipActive]}
                onPress={() => setPeriod(p)}
              >
                <Text
                  style={[styles.periodChipText, active && styles.periodChipTextActive]}
                  numberOfLines={1}
                >
                  {translate(lang, rankPeriodLabelKey(p))}
                </Text>
              </Pressable>
            );
          })}
        </View>
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
            <Text style={styles.rankingEmpty}>{translate(lang, emptyKey)}</Text>
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
              <Text style={styles.rankingEmpty}>{translate(lang, emptyKey)}</Text>
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
          <Text style={styles.rankingEmpty}>{translate(lang, emptyKey)}</Text>
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
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  cardLabel: {
    color: colors.silverDim,
    fontSize: 12,
    letterSpacing: 2,
  },
  rankingNote: {
    color: colors.teal,
    fontSize: 11,
    lineHeight: 16,
    marginTop: spacing.xs,
  },
  rankingPremium: {
    color: colors.silverDim,
    fontSize: 13,
    lineHeight: 19,
    marginTop: spacing.sm,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    padding: spacing.sm,
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
  periodsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  periodChip: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  periodChipActive: {
    borderColor: colors.teal,
    backgroundColor: 'rgba(45, 212, 168, 0.08)',
  },
  periodChipText: {
    color: colors.silverDim,
    fontSize: 11,
    fontWeight: '700',
  },
  periodChipTextActive: {
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

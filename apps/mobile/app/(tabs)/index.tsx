import { useCallback, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '@resiliencia/design-tokens';
import { ChatPanel } from '../../components/ChatPanel';
import { usePrefs } from '../../src/prefs/PrefsProvider';
import { DEFAULT_TRAINING_DAYS } from '../../src/prefs/service';
import { getRepo } from '../../src/repo';
import { EXERCISES, exerciseNameKey } from '../../src/retos/catalog';
import {
  buildChallenge,
  getStoredChallenge,
  getTodayChallenge,
  tomorrowKey,
} from '../../src/retos/service';
import { buildNextTraining, buildWeek } from '../../src/retos/week';
import {
  getCompletionSyncState,
  isCompleted,
  type CompletionSyncState,
} from '../../src/retos/completions';
import { getBestStreak, getCompletedCount, getStreak } from '../../src/retos/streak';
import { getFreeSessions } from '../../src/retos/freeSessions';
import { buildHistory, type DailyHistoryInput, type HistoryEntry } from '../../src/retos/history';
import { weeklyFact } from '../../src/retos/weeklyFact';
import { useDayKey } from '../../src/retos/DayProvider';
import { usePremium } from '../../src/premium/usePremium';
import { translate } from '../../src/i18n/translations';
import type { TranslationKey } from '../../src/i18n/translations';
import type { DailyChallenge } from '../../src/retos/types';
import type { Goal } from '../../src/prefs/types';

const WEEKDAYS: TranslationKey[] = [
  'weekday.sun',
  'weekday.mon',
  'weekday.tue',
  'weekday.wed',
  'weekday.thu',
  'weekday.fri',
  'weekday.sat',
];

function daysBetween(from: string, to: string): number {
  const a = new Date(`${from}T00:00:00`);
  const b = new Date(`${to}T00:00:00`);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

function localDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function InicioScreen() {
  const router = useRouter();
  const { prefs } = usePrefs();
  const insets = useSafeAreaInsets();
  const lang = prefs?.language ?? 'es';
  const goal: Goal = prefs?.goal ?? 'mantener';
  const repo = getRepo();
  const premium = usePremium();
  const dayKey = useDayKey();
  const trainingDays = prefs?.trainingDays ?? DEFAULT_TRAINING_DAYS;
  const trainingToday = useMemo(() => {
    const week = buildWeek(goal, trainingDays, new Date(`${dayKey}T00:00:00`));
    return week.find((d) => d.isToday)?.isTraining ?? true;
  }, [goal, trainingDays, dayKey]);
  const nextTraining = useMemo(
    () => buildNextTraining(goal, trainingDays, new Date(`${dayKey}T00:00:00`)),
    [goal, trainingDays, dayKey],
  );
  const [challenge, setChallenge] = useState<DailyChallenge | null>(null);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [completedToday, setCompletedToday] = useState(false);
  const [syncState, setSyncState] = useState<CompletionSyncState | undefined>(undefined);
  const [lastEntry, setLastEntry] = useState<HistoryEntry | undefined>(undefined);
  const [weekCells, setWeekCells] = useState<boolean[]>([]);
  const [chatAbierto, setChatAbierto] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const [nextChallenge, nextStreak, nextBest, nextCount, done, state, free] =
          await Promise.all([
            getTodayChallenge(repo),
            getStreak(repo),
            getBestStreak(repo),
            getCompletedCount(repo),
            isCompleted(repo, dayKey),
            getCompletionSyncState(repo, dayKey),
            getFreeSessions(repo),
          ]);

        // Últimos 7 días completados (para la barra semanal compacta).
        const cells: boolean[] = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date(`${dayKey}T00:00:00`);
          d.setDate(d.getDate() - i);
          cells.push((await repo.getSetting(`completed:${localDate(d)}`)) === '1');
        }

        // Último entrenamiento (offline-first): el reto del día anterior con
        // meta registrada, o la sesión libre más reciente.
        const prev = new Date(`${dayKey}T00:00:00`);
        prev.setDate(prev.getDate() - 1);
        const prevKey = localDate(prev);
        const [prevStored, prevMeta] = await Promise.all([
          getStoredChallenge(repo, prevKey),
          repo.getSetting(`completed:meta:${prevKey}`),
        ]);
        const daily: DailyHistoryInput[] = [];
        if (prevMeta) {
          let meta: { value?: number; target?: number; unit?: 'reps' | 'seconds' } | null = null;
          try {
            meta = JSON.parse(prevMeta) as {
              value?: number;
              target?: number;
              unit?: 'reps' | 'seconds';
            };
          } catch {
            meta = null;
          }
          const prevChallenge = prevStored ?? buildChallenge(prevKey, goal);
          daily.push({
            date: prevKey,
            exerciseId: prevChallenge.exerciseId,
            value: meta?.value ?? prevChallenge.target,
            target: meta?.target ?? prevChallenge.target,
            unit: meta?.unit ?? 'reps',
          });
        }
        const history = buildHistory(free, daily);

        if (!active) return;
        setChallenge(nextChallenge);
        setStreak(nextStreak);
        setBest(nextBest);
        setCompletedCount(nextCount);
        setCompletedToday(done);
        setSyncState(state ?? undefined);
        setWeekCells(cells);
        setLastEntry(history[0]);
      })();
      return () => {
        active = false;
      };
    }, [repo, dayKey, goal]),
  );

  function handleGoToReto() {
    if (completedToday) return;
    if (!trainingToday) {
      const restMessage = nextTraining
        ? daysBetween(dayKey, nextTraining.date) <= 1
          ? translate(lang, 'home.rest_tomorrow')
          : translate(lang, 'home.rest_next', {
              day: translate(lang, WEEKDAYS[nextTraining.dayOfWeek]),
            })
        : translate(lang, 'retos.rest_note');
      Alert.alert(translate(lang, 'home.rest_title'), restMessage, [
        { text: translate(lang, 'home.rest_ok') },
      ]);
      return;
    }
    router.push('/(tabs)/retos');
  }

  const exercise = challenge ? EXERCISES.find((e) => e.id === challenge.exerciseId) : undefined;
  const unit: TranslationKey =
    exercise?.unit === 'seconds'
      ? 'unit.seconds'
      : exercise?.unit === 'reps'
        ? 'unit.reps'
        : 'unit.reps';
  const tomorrowExercise = EXERCISES.find(
    (e) => e.id === buildChallenge(tomorrowKey(), goal).exerciseId,
  );

  const isRejected = syncState?.status === 'rejected';
  const isPending = syncState?.status === 'pending';
  const ctaLabel = isRejected
    ? 'home.completed_rejected'
    : isPending
      ? 'home.completed_pending'
      : 'home.completed';

  // Semana compacta: días completados de los últimos 7.
  const weekTraining = useMemo(() => {
    const trainingSet = new Set(trainingDays);
    let total = 0;
    let done = 0;
    for (let i = 6; i >= 0; i--) {
      const d = new Date(`${dayKey}T00:00:00`);
      d.setDate(d.getDate() - i);
      if (trainingSet.has(d.getDay())) {
        total++;
        if (weekCells[6 - i]) done++;
      }
    }
    return { done, total };
  }, [weekCells, trainingDays, dayKey]);

  const fact = useMemo(() => weeklyFact(new Date(`${dayKey}T00:00:00`)), [dayKey]);

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.content, { paddingBottom: spacing.xxl + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        {challenge && exercise ? (
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <View style={styles.headLeft}>
                <Text style={styles.eyebrow}>{translate(lang, 'home.challenge')}</Text>
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {translate(lang, exerciseNameKey(exercise.id))}
                </Text>
              </View>
              <View style={styles.metaBox}>
                <Text style={styles.metaNumber}>{challenge.target}</Text>
                <Text style={styles.metaUnit}>{translate(lang, unit)}</Text>
              </View>
            </View>

            <View style={styles.statStrip}>
              <View style={styles.stat}>
                <Text style={styles.statValue}>{streak}</Text>
                <Text style={styles.statLabel}>{translate(lang, 'home.streak')}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.stat}>
                <Text style={styles.statValue}>{completedCount}</Text>
                <Text style={styles.statLabel}>{translate(lang, 'progress.completed')}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.stat}>
                <Text style={styles.statValue}>
                  {weekTraining.done}/{weekTraining.total}
                </Text>
                <Text style={styles.statLabel}>{translate(lang, 'home.days_short')}</Text>
              </View>
            </View>

            <Pressable
              style={[styles.cta, completedToday && styles.ctaDone]}
              disabled={completedToday}
              onPress={handleGoToReto}
              accessibilityRole="button"
            >
              <Text style={[styles.ctaText, completedToday && styles.ctaTextDone]}>
                {translate(lang, completedToday ? ctaLabel : 'home.start')}
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.skeleton}>
            <View style={styles.skeletonBarWide} />
            <View style={styles.skeletonBarNarrow} />
            <View style={styles.skeletonBlock} />
          </View>
        )}

        {streak === 0 && !completedToday ? (
          <Text style={styles.hint}>{translate(lang, 'home.first_streak')}</Text>
        ) : null}

        <View style={styles.strip}>
          {tomorrowExercise ? (
            <Text style={styles.stripText} numberOfLines={1}>
              {translate(lang, 'home.tomorrow', {
                exercise: translate(lang, exerciseNameKey(tomorrowExercise.id)),
              })}
            </Text>
          ) : null}
          {lastEntry ? (
            <Text style={styles.stripText} numberOfLines={1}>
              {translate(lang, 'home.last', {
                exercise: translate(lang, exerciseNameKey(lastEntry.exerciseId)),
                value: lastEntry.value,
              })}
            </Text>
          ) : null}
        </View>

        <View style={styles.factCard}>
          <Text style={styles.factEyebrow}>{translate(lang, 'weekly.title')}</Text>
          <Text style={styles.factTitle}>{translate(lang, fact.titleKey)}</Text>
          <Text style={styles.factBody}>{translate(lang, fact.bodyKey)}</Text>
        </View>

        {premium ? (
          <Pressable
            style={styles.secondary}
            onPress={() => router.push('/(tabs)/ranking')}
            accessibilityRole="button"
          >
            <Text style={styles.secondaryText}>{translate(lang, 'home.view_ranking')}</Text>
          </Pressable>
        ) : null}

        <Text style={styles.best}>{translate(lang, 'home.best', { n: best })}</Text>
      </ScrollView>

      <Pressable
        style={[styles.iaBtn, { bottom: spacing.lg + insets.bottom }]}
        onPress={() => setChatAbierto(true)}
        accessibilityRole="button"
        accessibilityLabel={translate(lang, 'home.ia_title')}
      >
        <Text style={styles.iaBtnText}>IA</Text>
      </Pressable>

      <Modal
        visible={chatAbierto}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setChatAbierto(false)}
      >
        <View style={[styles.chatRoot, { paddingTop: insets.top }]}>
          <View style={styles.chatHeader}>
            <Text style={styles.chatTitle}>{translate(lang, 'home.ia_title')}</Text>
            <Pressable style={styles.chatClose} onPress={() => setChatAbierto(false)} hitSlop={8}>
              <Text style={styles.chatCloseText}>{translate(lang, 'auth.back')}</Text>
            </Pressable>
          </View>
          <ChatPanel />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  screen: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  headLeft: {
    flex: 1,
    flexShrink: 1,
  },
  eyebrow: {
    color: colors.silverDim,
    fontSize: 12,
    letterSpacing: 2,
  },
  cardTitle: {
    color: colors.silver,
    fontSize: 26,
    fontWeight: '800',
    marginTop: spacing.xs,
  },
  metaBox: {
    alignItems: 'flex-end',
    flexShrink: 0,
  },
  metaNumber: {
    color: colors.teal,
    fontSize: 34,
    fontWeight: '800',
    lineHeight: 36,
  },
  metaUnit: {
    color: colors.silverDim,
    fontSize: 11,
    letterSpacing: 1,
  },
  statStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.line,
    marginTop: spacing.md,
    paddingTop: spacing.md,
  },
  stat: {
    alignItems: 'center',
    flex: 1,
  },
  statDivider: {
    backgroundColor: colors.line,
    height: 28,
    width: 1,
  },
  statValue: {
    color: colors.silver,
    fontSize: 24,
    fontWeight: '800',
  },
  statLabel: {
    color: colors.silverDim,
    fontSize: 10,
    letterSpacing: 1,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  cta: {
    backgroundColor: colors.teal,
    borderRadius: radius.pill,
    alignItems: 'center',
    marginTop: spacing.md,
    paddingVertical: spacing.md,
  },
  ctaText: {
    color: colors.bg,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 2,
  },
  ctaDone: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.teal,
  },
  ctaTextDone: {
    color: colors.teal,
  },
  skeleton: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
    minHeight: 150,
  },
  skeletonBarWide: {
    backgroundColor: colors.line,
    borderRadius: radius.sm,
    height: 14,
    width: '40%',
  },
  skeletonBarNarrow: {
    backgroundColor: colors.line,
    borderRadius: radius.sm,
    height: 26,
    marginTop: spacing.sm,
    width: '65%',
  },
  skeletonBlock: {
    backgroundColor: colors.line,
    borderRadius: radius.sm,
    height: 44,
    marginTop: spacing.lg,
    width: '100%',
  },
  hint: {
    color: colors.silverDim,
    fontSize: 14,
    lineHeight: 21,
    marginTop: spacing.md,
  },
  strip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  stripText: {
    color: colors.silverDim,
    fontSize: 13,
  },
  secondary: {
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
  },
  secondaryText: {
    color: colors.silver,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 2,
  },
  best: {
    color: colors.silverDim,
    fontSize: 13,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  factCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    marginTop: spacing.lg,
    padding: spacing.lg,
  },
  factEyebrow: {
    color: colors.teal,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
  },
  factTitle: {
    color: colors.silver,
    fontSize: 17,
    fontWeight: '800',
    marginTop: spacing.xs,
  },
  factBody: {
    color: colors.silverDim,
    fontSize: 14,
    lineHeight: 21,
    marginTop: spacing.sm,
  },
  iaBtn: {
    position: 'absolute',
    right: spacing.md,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.teal,
    borderWidth: 2,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  iaBtnText: {
    color: colors.bg,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1,
  },
  chatRoot: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    backgroundColor: colors.bg,
  },
  chatTitle: {
    color: colors.silver,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 2,
  },
  chatClose: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
  },
  chatCloseText: {
    color: colors.teal,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
  },
});

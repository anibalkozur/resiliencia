import { useCallback, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '@resiliencia/design-tokens';
import { ChatPanel } from '../../components/ChatPanel';
import { usePrefs } from '../../src/prefs/PrefsProvider';
import { getRepo } from '../../src/repo';
import { EXERCISES, exerciseNameKey } from '../../src/retos/catalog';
import { buildChallenge, getTodayChallenge, tomorrowKey } from '../../src/retos/service';
import { isCompleted } from '../../src/retos/completions';
import { getCompletedCount, getStreak } from '../../src/retos/streak';
import { useDayKey } from '../../src/retos/DayProvider';
import { GOAL_TRANSLATION_KEYS, translate } from '../../src/i18n/translations';
import type { DailyChallenge } from '../../src/retos/types';
import type { Goal } from '../../src/prefs/types';

export default function InicioScreen() {
  const router = useRouter();
  const { prefs } = usePrefs();
  const insets = useSafeAreaInsets();
  const lang = prefs?.language ?? 'es';
  const goal: Goal = prefs?.goal ?? 'mantener';
  const repo = getRepo();
  const dayKey = useDayKey();
  const [challenge, setChallenge] = useState<DailyChallenge | null>(null);
  const [streak, setStreak] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [completedToday, setCompletedToday] = useState(false);
  const [chatAbierto, setChatAbierto] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      Promise.all([
        getTodayChallenge(repo),
        getStreak(repo),
        getCompletedCount(repo),
        isCompleted(repo, dayKey),
      ]).then(([nextChallenge, nextStreak, nextCount, done]) => {
        if (!active) return;
        setChallenge(nextChallenge);
        setStreak(nextStreak);
        setCompletedCount(nextCount);
        setCompletedToday(done);
      });
      return () => {
        active = false;
      };
    }, [repo, dayKey]),
  );

  function handleGoToReto() {
    if (completedToday) return;
    router.push('/(tabs)/retos');
  }

  const exercise = challenge ? EXERCISES.find((e) => e.id === challenge.exerciseId) : undefined;
  const unit = exercise?.unit === 'reps' ? 'unit.reps' : 'unit.seconds';
  const tomorrowExercise = EXERCISES.find(
    (e) => e.id === buildChallenge(tomorrowKey(), goal).exerciseId,
  );

  return (
    <View style={styles.container}>
      {challenge && exercise ? (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>{translate(lang, 'home.challenge')}</Text>
          <Text style={styles.cardTitle}>{translate(lang, exerciseNameKey(exercise.id))}</Text>
          <Text style={styles.cardTarget}>
            {translate(lang, 'home.meta', {
              target: challenge.target,
              unit: translate(lang, unit),
            })}
          </Text>

          <View style={styles.chipRow}>
            <View style={styles.chip}>
              <Text style={styles.chipText}>
                {translate(lang, 'home.day_n', { n: completedCount + 1 })}
              </Text>
            </View>
            <View style={styles.chip}>
              <Text style={styles.chipText}>
                {translate(lang, 'home.by_goal', {
                  goal: translate(lang, GOAL_TRANSLATION_KEYS[goal]),
                })}
              </Text>
            </View>
          </View>

          <Pressable
            style={[styles.cta, completedToday && styles.ctaDone]}
            disabled={completedToday}
            onPress={handleGoToReto}
          >
            <Text style={[styles.ctaText, completedToday && styles.ctaTextDone]}>
              {translate(lang, completedToday ? 'home.completed' : 'home.complete')}
            </Text>
          </Pressable>

          <Pressable style={styles.secondary} onPress={() => router.push('/(tabs)/retos')}>
            <Text style={styles.secondaryText}>{translate(lang, 'home.view')}</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.streakBox}>
        {streak > 0 ? (
          <>
            <Text style={styles.streakValue}>{streak}</Text>
            <Text style={styles.streakLabel}>{translate(lang, 'home.streak')}</Text>
          </>
        ) : (
          <Text style={styles.streakHint}>{translate(lang, 'home.first_streak')}</Text>
        )}
      </View>

      {tomorrowExercise ? (
        <Text style={styles.tomorrowText}>
          {translate(lang, 'home.tomorrow', {
            exercise: translate(lang, exerciseNameKey(tomorrowExercise.id)),
          })}
        </Text>
      ) : null}

      <Pressable
        style={styles.iaBtn}
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
            <Pressable
              style={styles.chatClose}
              onPress={() => setChatAbierto(false)}
              hitSlop={8}
            >
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
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
  },
  title: {
    color: colors.silver,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 1,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    marginTop: spacing.lg,
    padding: spacing.lg,
  },
  cardLabel: {
    color: colors.silverDim,
    fontSize: 12,
    letterSpacing: 2,
  },
  cardTitle: {
    color: colors.silver,
    fontSize: 28,
    fontWeight: '800',
    marginTop: spacing.sm,
  },
  cardTarget: {
    color: colors.teal,
    fontSize: 40,
    fontWeight: '800',
    marginTop: spacing.xs,
  },
  chipRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  chip: {
    backgroundColor: colors.bg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  chipText: {
    color: colors.silverDim,
    fontSize: 12,
    letterSpacing: 0.5,
  },
  cta: {
    backgroundColor: colors.teal,
    borderRadius: radius.pill,
    alignItems: 'center',
    marginTop: spacing.lg,
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
  secondary: {
    alignItems: 'center',
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
  },
  secondaryText: {
    color: colors.silverDim,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 2,
  },
  streakBox: {
    marginTop: spacing.lg,
  },
  streakValue: {
    color: colors.teal,
    fontSize: 40,
    fontWeight: '800',
  },
  streakLabel: {
    color: colors.silverDim,
    fontSize: 12,
    letterSpacing: 2,
  },
  streakHint: {
    color: colors.silverDim,
    fontSize: 14,
    lineHeight: 21,
  },
  tomorrowText: {
    color: colors.silverDim,
    fontSize: 13,
    marginTop: spacing.md,
  },
  iaBtn: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.teal,
    borderWidth: 2,
    borderColor: '#1d5c3a',
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

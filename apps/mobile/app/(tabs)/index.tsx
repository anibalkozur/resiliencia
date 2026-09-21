import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { colors, radius, spacing } from '@resiliencia/design-tokens';
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
  const lang = prefs?.language ?? 'es';
  const goal: Goal = prefs?.goal ?? 'mantener';
  const repo = getRepo();
  const dayKey = useDayKey();
  const [challenge, setChallenge] = useState<DailyChallenge | null>(null);
  const [streak, setStreak] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [completedToday, setCompletedToday] = useState(false);

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
});

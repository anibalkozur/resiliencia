import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '@resiliencia/design-tokens';
import { usePrefs } from '../../src/prefs/PrefsProvider';
import { getRepo } from '../../src/repo';
import { EXERCISES } from '../../src/retos/catalog';
import { getTodayChallenge } from '../../src/retos/service';
import { translate } from '../../src/i18n/translations';
import type { DailyChallenge } from '../../src/retos/types';

export default function RetosScreen() {
  const { prefs } = usePrefs();
  const lang = prefs?.language ?? 'es';
  const [challenge, setChallenge] = useState<DailyChallenge | null>(null);
  const repo = getRepo();

  useEffect(() => {
    getTodayChallenge(repo).then(setChallenge);
  }, [repo]);

  const exercise = challenge ? EXERCISES.find((e) => e.id === challenge.exerciseId) : undefined;
  const unit = exercise?.unit === 'reps' ? 'unit.reps' : 'unit.seconds';

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{translate(lang, 'home.challenge')}</Text>
      {challenge && exercise ? (
        <View style={styles.card}>
          <Text style={styles.exercise}>{exercise.name}</Text>
          <Text style={styles.target}>
            {translate(lang, 'challenge.meta', {
              target: challenge.target,
              unit: translate(lang, unit),
            })}
          </Text>
          <Text style={styles.note}>{translate(lang, 'challenge.note')}</Text>
          <Text style={styles.rotation}>{translate(lang, 'challenge.rotation')}</Text>
        </View>
      ) : null}
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
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    marginTop: spacing.xl,
    padding: spacing.lg,
  },
  exercise: {
    color: colors.silver,
    fontSize: 24,
    fontWeight: '800',
  },
  target: {
    color: colors.silverDim,
    fontSize: 15,
    marginTop: spacing.sm,
  },
  note: {
    color: colors.silverDim,
    fontSize: 13,
    lineHeight: 19,
    marginTop: spacing.md,
  },
  rotation: {
    color: colors.silverDim,
    fontSize: 13,
    marginTop: spacing.sm,
  },
});

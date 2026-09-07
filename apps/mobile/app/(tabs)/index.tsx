import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '@resiliencia/design-tokens';
import { useUser } from '../../src/user/UserProvider';
import { usePrefs } from '../../src/prefs/PrefsProvider';
import { getRepo } from '../../src/repo';
import { EXERCISES } from '../../src/retos/catalog';
import { getTodayChallenge } from '../../src/retos/service';
import { getStreak } from '../../src/retos/streak';
import { translate } from '../../src/i18n/translations';
import type { DailyChallenge } from '../../src/retos/types';

export default function InicioScreen() {
  const { profile } = useUser();
  const { prefs } = usePrefs();
  const lang = prefs?.language ?? 'es';
  const repo = getRepo();
  const [challenge, setChallenge] = useState<DailyChallenge | null>(null);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    getTodayChallenge(repo).then(setChallenge);
    getStreak(repo).then(setStreak);
  }, [repo]);

  const exercise = challenge ? EXERCISES.find((e) => e.id === challenge.exerciseId) : undefined;
  const unit = exercise?.unit === 'reps' ? 'unit.reps' : 'unit.seconds';

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {translate(lang, 'home.greeting', { name: profile?.nickname ?? 'Atleta' })}
      </Text>

      <View style={styles.streakBox}>
        <Text style={styles.streakValue}>{streak}</Text>
        <Text style={styles.streakLabel}>{translate(lang, 'home.streak')}</Text>
      </View>

      {challenge && exercise ? (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>{translate(lang, 'home.challenge')}</Text>
          <Text style={styles.cardTitle}>{exercise.name}</Text>
          <Text style={styles.cardMeta}>
            {translate(lang, 'home.meta', {
              target: challenge.target,
              unit: translate(lang, unit),
            })}
          </Text>
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
  streakBox: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
    marginTop: spacing.xl,
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
  cardTitle: {
    color: colors.silver,
    fontSize: 24,
    fontWeight: '800',
    marginTop: spacing.sm,
  },
  cardMeta: {
    color: colors.silverDim,
    fontSize: 13,
    marginTop: spacing.sm,
  },
});

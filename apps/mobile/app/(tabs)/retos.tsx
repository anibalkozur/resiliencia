import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '@resiliencia/design-tokens';
import { getRepo } from '../../src/repo';
import { EXERCISES } from '../../src/retos/catalog';
import { getTodayChallenge } from '../../src/retos/service';
import type { DailyChallenge } from '../../src/retos/types';

export default function RetosScreen() {
  const [challenge, setChallenge] = useState<DailyChallenge | null>(null);
  const repo = getRepo();

  useEffect(() => {
    getTodayChallenge(repo).then(setChallenge);
  }, [repo]);

  const exercise = challenge ? EXERCISES.find((e) => e.id === challenge.exerciseId) : undefined;

  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>RESILIENCIA</Text>
      <Text style={styles.title}>RETO DE HOY</Text>
      {challenge && exercise ? (
        <View style={styles.card}>
          <Text style={styles.exercise}>{exercise.name}</Text>
          <Text style={styles.target}>
            Meta: {challenge.target} {exercise.unit === 'reps' ? 'repeticiones' : 'segundos'}
          </Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>VERIFICADO CON CÁMARA AL ENTRENAR</Text>
          </View>
          <Text style={styles.note}>
            Nadie completa ejercicios a mano. La detección con cámara llega en la próxima fase del
            plan.
          </Text>
          <Text style={styles.rotation}>Mañana hay otro reto.</Text>
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
  eyebrow: {
    color: colors.teal,
    fontSize: 12,
    letterSpacing: 4,
    marginBottom: spacing.sm,
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
  badge: {
    alignSelf: 'flex-start',
    borderColor: colors.teal,
    borderRadius: radius.pill,
    borderWidth: 1,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  badgeText: {
    color: colors.teal,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
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

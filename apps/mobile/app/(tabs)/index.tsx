import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '@resiliencia/design-tokens';
import { useUser } from '../../src/user/UserProvider';
import { getRepo } from '../../src/repo';
import { EXERCISES } from '../../src/retos/catalog';
import { getTodayChallenge } from '../../src/retos/service';
import type { DailyChallenge } from '../../src/retos/types';

export default function InicioScreen() {
  const { profile } = useUser();
  const [challenge, setChallenge] = useState<DailyChallenge | null>(null);
  const repo = getRepo();

  useEffect(() => {
    getTodayChallenge(repo).then(setChallenge);
  }, [repo]);

  const exercise = challenge ? EXERCISES.find((e) => e.id === challenge.exerciseId) : undefined;

  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>RESILIENCIA</Text>
      <Text style={styles.title}>Hola, {profile?.nickname ?? 'Atleta'}</Text>
      {challenge && exercise ? (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>RETO DE HOY</Text>
          <Text style={styles.cardTitle}>{exercise.name}</Text>
          <Text style={styles.cardMeta}>
            Meta: {challenge.target} {exercise.unit === 'reps' ? 'repeticiones' : 'segundos'} ·
            verificada con cámara
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

import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '@resiliencia/design-tokens';
import { getRepo } from '../../src/repo';
import { getStreak } from '../../src/retos/streak';
import { getTotalCompleted } from '../../src/retos/completions';
import { useUser } from '../../src/user/UserProvider';

function daysSince(iso: string): number {
  const created = new Date(iso);
  const now = new Date();
  return Math.max(0, Math.floor((now.getTime() - created.getTime()) / 86_400_000));
}

export default function ProgresoScreen() {
  const { profile } = useUser();
  const repo = getRepo();
  const [streak, setStreak] = useState(0);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    getStreak(repo).then(setStreak);
    getTotalCompleted(repo).then(setTotal);
  }, [repo]);

  const dias = profile ? daysSince(profile.createdAt) : 0;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>PROGRESO</Text>

      <View style={styles.row}>
        <View style={styles.metric}>
          <Text style={styles.metricValue}>{streak}</Text>
          <Text style={styles.metricLabel}>RACHA</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricValue}>{total}</Text>
          <Text style={styles.metricLabel}>COMPLETADOS</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricValue}>{dias}</Text>
          <Text style={styles.metricLabel}>DIAS</Text>
        </View>
      </View>

      <View style={styles.emptyCard}>
        <Text style={styles.emptyTitle}>TU PROGRESO APARECERA AQUI</Text>
        <Text style={styles.emptyBody}>
          Cuando completes tu primer reto con la camara, vas a ver tu historial y graficos de
          evolucion.
        </Text>
      </View>
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
});

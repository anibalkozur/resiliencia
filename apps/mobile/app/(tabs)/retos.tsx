import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, spacing } from '@resiliencia/design-tokens';
import { getRepo } from '../../src/repo';
import { EXERCISES } from '../../src/retos/catalog';
import { completeChallenge, getTodayChallenge } from '../../src/retos/service';
import type { DailyChallenge } from '../../src/retos/types';

export default function RetosScreen() {
  const [challenge, setChallenge] = useState<DailyChallenge | null>(null);
  const [qty, setQty] = useState('');
  const [saving, setSaving] = useState(false);
  const repo = getRepo();

  useEffect(() => {
    getTodayChallenge(repo).then(setChallenge);
  }, [repo]);

  const exercise = challenge ? EXERCISES.find((e) => e.id === challenge.exerciseId) : undefined;

  const handleComplete = useCallback(async () => {
    setSaving(true);
    const value = Math.max(0, Math.min(Number.parseInt(qty, 10) || 0, 9999));
    const updated = await completeChallenge(repo, value);
    setChallenge(updated);
    setSaving(false);
  }, [qty, repo]);

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
          {challenge.completedAt ? (
            <View>
              <Text style={styles.done}>Completado hoy: {challenge.completedQty}</Text>
              <Text style={styles.rotation}>Mañana hay otro reto. Vuelve pronto.</Text>
            </View>
          ) : (
            <View>
              <TextInput
                style={styles.input}
                value={qty}
                onChangeText={setQty}
                keyboardType="number-pad"
                placeholder={`Cuanto hiciste (${exercise.unit === 'reps' ? 'repeticiones' : 'segundos'})`}
                placeholderTextColor={colors.silverDim}
              />
              <Pressable
                style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
                onPress={handleComplete}
                disabled={saving}
              >
                <Text style={styles.buttonText}>{saving ? 'GUARDANDO...' : 'COMPLETAR'}</Text>
              </Pressable>
            </View>
          )}
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
  input: {
    backgroundColor: colors.bg,
    borderColor: colors.line,
    borderRadius: radius.sm,
    borderWidth: 1,
    color: colors.silver,
    fontSize: 16,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  button: {
    alignItems: 'center',
    backgroundColor: colors.teal,
    borderRadius: radius.sm,
    marginTop: spacing.md,
    paddingVertical: spacing.md,
  },
  buttonPressed: {
    opacity: 0.7,
  },
  buttonText: {
    color: colors.bg,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 2,
  },
  done: {
    color: colors.teal,
    fontSize: 17,
    fontWeight: '700',
    marginTop: spacing.md,
  },
  rotation: {
    color: colors.silverDim,
    fontSize: 13,
    marginTop: spacing.sm,
  },
});

import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '@resiliencia/design-tokens';
import { getRepo } from '../../src/repo';
import {
  GOAL_LABELS,
  LANGUAGE_OPTIONS,
  MAX_DAYS,
  MIN_DAYS,
  getPrefs,
  savePrefs,
} from '../../src/prefs/service';
import type { Goal, Language, UserPrefs } from '../../src/prefs/types';

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.chip,
        active && styles.chipActive,
        pressed && styles.chipPressed,
      ]}
      onPress={onPress}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

export default function AjustesScreen() {
  const [prefs, setPrefs] = useState<UserPrefs | null>(null);
  const [saved, setSaved] = useState(false);
  const repo = getRepo();

  useEffect(() => {
    getPrefs(repo).then(setPrefs);
  }, [repo]);

  const update = useCallback(
    async (patch: Partial<UserPrefs>) => {
      if (!prefs) {
        return;
      }
      const next = await savePrefs(repo, { ...prefs, ...patch });
      setPrefs(next);
      setSaved(true);
    },
    [prefs, repo],
  );

  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>RESILIENCIA</Text>
      <Text style={styles.title}>AJUSTES</Text>
      {prefs ? (
        <View style={styles.body}>
          <Text style={styles.section}>OBJETIVO</Text>
          <View style={styles.row}>
            {(Object.keys(GOAL_LABELS) as Goal[]).map((goal) => (
              <Chip
                key={goal}
                label={GOAL_LABELS[goal]}
                active={prefs.goal === goal}
                onPress={() => update({ goal })}
              />
            ))}
          </View>

          <Text style={styles.section}>DÍAS POR SEMANA</Text>
          <View style={styles.row}>
            <Pressable
              style={({ pressed }) => [
                styles.step,
                (pressed || prefs.daysPerWeek <= MIN_DAYS) && styles.stepDim,
              ]}
              onPress={() => update({ daysPerWeek: prefs.daysPerWeek - 1 })}
              disabled={prefs.daysPerWeek <= MIN_DAYS}
            >
              <Text style={styles.stepText}>−</Text>
            </Pressable>
            <Text style={styles.stepValue}>{prefs.daysPerWeek}</Text>
            <Pressable
              style={({ pressed }) => [
                styles.step,
                (pressed || prefs.daysPerWeek >= MAX_DAYS) && styles.stepDim,
              ]}
              onPress={() => update({ daysPerWeek: prefs.daysPerWeek + 1 })}
              disabled={prefs.daysPerWeek >= MAX_DAYS}
            >
              <Text style={styles.stepText}>+</Text>
            </Pressable>
          </View>

          <Text style={styles.section}>IDIOMA</Text>
          <View style={styles.row}>
            {LANGUAGE_OPTIONS.map((option) => (
              <Chip
                key={option.code}
                label={option.label}
                active={prefs.language === option.code}
                onPress={() => update({ language: option.code as Language })}
              />
            ))}
          </View>

          {saved && <Text style={styles.saved}>Preferencias guardadas en este dispositivo</Text>}
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
  body: {
    marginTop: spacing.xl,
  },
  section: {
    color: colors.silverDim,
    fontSize: 12,
    letterSpacing: 2,
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    borderColor: colors.line,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  chipActive: {
    borderColor: colors.teal,
    backgroundColor: colors.surface,
  },
  chipPressed: {
    opacity: 0.7,
  },
  chipText: {
    color: colors.silverDim,
    fontSize: 14,
  },
  chipTextActive: {
    color: colors.teal,
    fontWeight: '700',
  },
  step: {
    borderColor: colors.line,
    borderRadius: radius.sm,
    borderWidth: 1,
    minWidth: 48,
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  stepDim: {
    opacity: 0.4,
  },
  stepText: {
    color: colors.silver,
    fontSize: 20,
    fontWeight: '700',
  },
  stepValue: {
    color: colors.silver,
    fontSize: 20,
    fontWeight: '800',
    minWidth: 56,
    textAlign: 'center',
  },
  saved: {
    color: colors.teal,
    fontSize: 13,
    marginTop: spacing.lg,
  },
});

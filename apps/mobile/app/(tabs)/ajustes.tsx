import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';
import { colors, radius, spacing } from '@resiliencia/design-tokens';
import PerfilPanel from '../../components/PerfilPanel';
import { usePrefs } from '../../src/prefs/PrefsProvider';
import { useAuth } from '../../src/auth/AuthProvider';
import { getSupabase } from '../../src/auth/supabase';
import { getRepo } from '../../src/repo';
import { resetCloudProgress, resetLocalProgress } from '../../src/retos/reset';
import { LANGUAGE_OPTIONS } from '../../src/prefs/service';
import { translate } from '../../src/i18n/translations';
import type { TranslationKey } from '../../src/i18n/translations';
import type { Language } from '../../src/prefs/types';

const DAY_ORDER: { label: TranslationKey; value: number }[] = [
  { label: 'weekday.mon', value: 1 },
  { label: 'weekday.tue', value: 2 },
  { label: 'weekday.wed', value: 3 },
  { label: 'weekday.thu', value: 4 },
  { label: 'weekday.fri', value: 5 },
  { label: 'weekday.sat', value: 6 },
  { label: 'weekday.sun', value: 0 },
];

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
  const { prefs, updatePrefs } = usePrefs();
  const { session, signOut } = useAuth();
  const lang = prefs?.language ?? 'es';
  const [perfilOpen, setPerfilOpen] = useState(false);

  const email = session?.user?.email ?? null;

  function toggleTrainingDay(day: number) {
    if (!prefs) return;
    const has = prefs.trainingDays.includes(day);
    if (has && prefs.trainingDays.length === 1) return;
    const trainingDays = has
      ? prefs.trainingDays.filter((d) => d !== day)
      : [...prefs.trainingDays, day].sort((a, b) => a - b);
    void updatePrefs({ trainingDays });
  }

  function confirmReset() {
    Alert.alert(
      translate(lang, 'settings.reset_confirm_title'),
      translate(lang, 'settings.reset_confirm'),
      [
        { text: translate(lang, 'settings.reset_cancel'), style: 'cancel' },
        {
          text: translate(lang, 'settings.reset_ok'),
          style: 'destructive',
          onPress: () => {
            const client = getSupabase();
            void (async () => {
              try {
                await resetLocalProgress(getRepo());
                if (client && session) {
                  await resetCloudProgress(client);
                }
                Alert.alert(
                  translate(lang, 'settings.reset_confirm_title'),
                  client && session
                    ? translate(lang, 'settings.reset_done')
                    : translate(lang, 'settings.reset_local_only'),
                );
              } catch (err) {
                console.warn('[ajustes] reset:', err);
                Alert.alert(
                  translate(lang, 'settings.reset_confirm_title'),
                  client && session
                    ? translate(lang, 'settings.reset_error')
                    : translate(lang, 'settings.reset_local_only'),
                );
              }
            })();
          },
        },
      ],
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <Pressable
        style={styles.profileHeader}
        onPress={() => setPerfilOpen((open) => !open)}
        accessibilityRole="button"
        accessibilityState={{ expanded: perfilOpen }}
      >
        <Text style={styles.profileHeaderText}>{translate(lang, 'settings.profile')}</Text>
        <Text style={styles.profileHeaderChevron}>{perfilOpen ? '▾' : '▸'}</Text>
      </Pressable>
      {perfilOpen ? <PerfilPanel /> : null}
      {prefs && (
        <View style={styles.body}>
          <Text style={styles.section}>{translate(lang, 'settings.days')}</Text>
          <Text style={styles.hint}>{translate(lang, 'settings.days_hint')}</Text>
          <View style={styles.daysRow}>
            {DAY_ORDER.map(({ label, value }) => {
              const active = prefs.trainingDays.includes(value);
              return (
                <Pressable
                  key={value}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={({ pressed }) => [
                    styles.dayChip,
                    active && styles.dayChipActive,
                    pressed && styles.chipPressed,
                  ]}
                  onPress={() => toggleTrainingDay(value)}
                >
                  <Text style={[styles.dayChipText, active && styles.dayChipTextActive]}>
                    {translate(lang, label)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.section}>{translate(lang, 'settings.language')}</Text>
          <View style={styles.row}>
            {LANGUAGE_OPTIONS.map((option) => (
              <Chip
                key={option.code}
                label={option.label}
                active={prefs.language === option.code}
                onPress={() => updatePrefs({ language: option.code as Language })}
              />
            ))}
          </View>

          <Text style={styles.section}>{translate(lang, 'settings.account')}</Text>
          <Text style={styles.accountLine}>
            {translate(lang, 'settings.logged_as', { email: email ?? '' })}
          </Text>
          <Pressable
            style={({ pressed }) => [styles.action, pressed && styles.chipPressed]}
            onPress={() => signOut()}
          >
            <Text style={styles.actionText}>{translate(lang, 'settings.logout')}</Text>
          </Pressable>
          <Text style={styles.section}>{translate(lang, 'settings.reset')}</Text>
          <Text style={styles.accountLine}>{translate(lang, 'settings.reset_desc')}</Text>
          <Pressable
            style={({ pressed }) => [styles.actionDanger, pressed && styles.chipPressed]}
            onPress={confirmReset}
          >
            <Text style={styles.actionDangerText}>{translate(lang, 'settings.reset')}</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  container: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  body: {
    marginTop: spacing.sm,
  },
  profileHeader: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    padding: spacing.lg,
  },
  profileHeaderText: {
    color: colors.silver,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
  },
  profileHeaderChevron: {
    color: colors.teal,
    fontSize: 16,
    fontWeight: '800',
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
  daysRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  dayChip: {
    alignItems: 'center',
    borderColor: colors.line,
    borderRadius: radius.pill,
    borderWidth: 1,
    flex: 1,
    paddingVertical: spacing.sm,
  },
  dayChipActive: {
    borderColor: colors.teal,
    backgroundColor: colors.surface,
  },
  dayChipText: {
    color: colors.silverDim,
    fontSize: 13,
  },
  dayChipTextActive: {
    color: colors.teal,
    fontWeight: '700',
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
  hint: {
    color: colors.silverDim,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: spacing.sm,
  },
  accountLine: {
    color: colors.silverDim,
    fontSize: 13,
    marginBottom: spacing.sm,
  },
  action: {
    alignItems: 'center',
    borderColor: colors.line,
    borderRadius: radius.sm,
    borderWidth: 1,
    marginRight: spacing.sm,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  actionText: {
    color: colors.silver,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
  },
  actionDanger: {
    alignItems: 'center',
    borderColor: colors.line,
    borderRadius: radius.sm,
    borderWidth: 1,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  actionDangerText: {
    color: '#ff6b6b',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
  },
});

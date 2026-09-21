import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '@resiliencia/design-tokens';
import { usePrefs } from '../../src/prefs/PrefsProvider';
import { useAuth } from '../../src/auth/AuthProvider';
import { getSupabase } from '../../src/auth/supabase';
import { getRepo } from '../../src/repo';
import { resetCloudProgress, resetLocalProgress } from '../../src/retos/reset';
import { LANGUAGE_OPTIONS, MAX_DAYS, MIN_DAYS } from '../../src/prefs/service';
import { translate } from '../../src/i18n/translations';
import type { Language } from '../../src/prefs/types';

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

  if (!prefs) {
    return <View style={styles.container} />;
  }

  const email = session?.user?.email ?? null;

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
                  await resetCloudProgress(client, session.user.id);
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
                  translate(lang, 'settings.reset_local_only'),
                );
              }
            })();
          },
        },
      ],
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.body}>
        <Text style={styles.section}>{translate(lang, 'settings.days')}</Text>
        <View style={styles.row}>
          <Pressable
            style={({ pressed }) => [
              styles.step,
              (pressed || prefs.daysPerWeek <= MIN_DAYS) && styles.stepDim,
            ]}
            onPress={() => updatePrefs({ daysPerWeek: prefs.daysPerWeek - 1 })}
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
            onPress={() => updatePrefs({ daysPerWeek: prefs.daysPerWeek + 1 })}
            disabled={prefs.daysPerWeek >= MAX_DAYS}
          >
            <Text style={styles.stepText}>+</Text>
          </Pressable>
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

        <Text style={styles.saved}>{translate(lang, 'settings.saved')}</Text>

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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.lg,
  },
  title: {
    color: colors.silver,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 1,
  },
  body: {
    marginTop: spacing.md,
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

import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { colors, radius, spacing } from '@resiliencia/design-tokens';
import { useAuth } from '../../src/auth/AuthProvider';
import { authErrorKey } from '../../src/auth/authErrorText';
import { usePrefs } from '../../src/prefs/PrefsProvider';
import { translate } from '../../src/i18n/translations';

export default function OnboardingScreen() {
  const { googleSignIn, errorCode, clearError } = useAuth();
  const { prefs } = usePrefs();
  const lang = prefs?.language ?? 'es';
  const [saving, setSaving] = useState(false);

  const handleGoogle = useCallback(async () => {
    clearError();
    setSaving(true);
    const result = await googleSignIn();
    setSaving(false);
    if (!result.ok) {
      return;
    }
  }, [googleSignIn, clearError]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{translate(lang, 'onboarding.title')}</Text>
      <Text style={styles.caption}>{translate(lang, 'onboarding.caption')}</Text>

      <Pressable
        style={({ pressed }) => [styles.googleButton, pressed && styles.buttonPressed]}
        onPress={handleGoogle}
        disabled={saving}
      >
        <Text style={styles.googleButtonText}>{translate(lang, 'auth.continue_google')}</Text>
      </Pressable>

      <Text style={styles.or}>{translate(lang, 'auth.or')}</Text>

      <Pressable
        style={({ pressed }) => [styles.outlineButton, pressed && styles.buttonPressed]}
        onPress={() => router.push('/(auth)/signup')}
        disabled={saving}
      >
        <Text style={styles.outlineButtonText}>{translate(lang, 'auth.title_signup')}</Text>
      </Pressable>

      <Pressable style={styles.link} onPress={() => router.push('/(auth)/login')} disabled={saving}>
        <Text style={styles.linkText}>{translate(lang, 'onboarding.have_account')}</Text>
      </Pressable>

      {errorCode ? (
        <Text style={styles.error}>{translate(lang, authErrorKey(errorCode))}</Text>
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
  caption: {
    color: colors.silverDim,
    fontSize: 16,
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
    lineHeight: 24,
  },
  googleButton: {
    alignItems: 'center',
    backgroundColor: colors.teal,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
  },
  googleButtonText: {
    color: colors.bg,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 2,
  },
  or: {
    color: colors.silverDim,
    fontSize: 12,
    letterSpacing: 2,
    marginVertical: spacing.md,
    textAlign: 'center',
  },
  outlineButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radius.sm,
    borderWidth: 1,
    paddingVertical: spacing.md,
  },
  outlineButtonText: {
    color: colors.silver,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 2,
  },
  link: {
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  linkText: {
    color: colors.silverDim,
    fontSize: 14,
  },
  buttonPressed: {
    opacity: 0.7,
  },
  error: {
    color: colors.ember,
    fontSize: 14,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
});

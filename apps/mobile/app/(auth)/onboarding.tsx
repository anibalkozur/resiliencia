import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '@resiliencia/design-tokens';
import { useAuth } from '../../src/auth/AuthProvider';
import { authErrorKey } from '../../src/auth/authErrorText';
import { usePrefs } from '../../src/prefs/PrefsProvider';
import { translate } from '../../src/i18n/translations';

const logo = require('../../assets/brand/logo.png');
const welcomeArt = require('../../assets/brand/onboarding-hombre-mujer.png');

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
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brandBlock}>
          <Image
            source={logo}
            style={styles.logo}
            resizeMode="contain"
            accessibilityLabel="ResiliencIA"
          />
          <Text style={styles.eyebrow}>{translate(lang, 'onboarding.eyebrow')}</Text>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroAccent} />
          <View style={styles.imageFrame}>
            <Image source={welcomeArt} style={styles.welcomeArt} resizeMode="contain" />
          </View>
          <Text style={styles.title}>{translate(lang, 'onboarding.hero_title')}</Text>
          <Text style={styles.caption}>{translate(lang, 'onboarding.hero_caption')}</Text>
        </View>

        <View style={styles.actionsCard}>
          <Text style={styles.accountHint}>{translate(lang, 'onboarding.account_hint')}</Text>

          <Pressable
            style={({ pressed }) => [styles.googleButton, pressed && styles.buttonPressed]}
            onPress={handleGoogle}
            disabled={saving}
            accessibilityRole="button"
          >
            {saving ? (
              <ActivityIndicator color={colors.bg} />
            ) : (
              <>
                <View style={styles.googleMark}>
                  <Text style={styles.googleMarkText}>G</Text>
                </View>
                <Text style={styles.googleButtonText}>
                  {translate(lang, 'auth.continue_google')}
                </Text>
              </>
            )}
          </Pressable>

          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text style={styles.or}>{translate(lang, 'auth.or')}</Text>
            <View style={styles.divider} />
          </View>

          <Pressable
            style={({ pressed }) => [styles.outlineButton, pressed && styles.buttonPressed]}
            onPress={() => router.push('/(auth)/signup')}
            disabled={saving}
            accessibilityRole="button"
          >
            <Text style={styles.outlineButtonText}>{translate(lang, 'auth.title_signup')}</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.link, pressed && styles.buttonPressed]}
            onPress={() => router.push('/(auth)/login')}
            disabled={saving}
            accessibilityRole="button"
          >
            <Text style={styles.linkText}>{translate(lang, 'onboarding.have_account')}</Text>
          </Pressable>
          <Text style={styles.premiumNote}>{translate(lang, 'onboarding.premium_note')}</Text>
        </View>

        {errorCode ? (
          <Text style={styles.error}>{translate(lang, authErrorKey(errorCode))}</Text>
        ) : null}

        <Text style={styles.footer}>{translate(lang, 'onboarding.footer_note')}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.bg,
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  brandBlock: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  logo: {
    height: 78,
    width: 190,
  },
  eyebrow: {
    color: colors.teal,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2.2,
    marginTop: spacing.xs,
  },
  heroCard: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    paddingBottom: spacing.lg,
  },
  heroAccent: {
    backgroundColor: colors.teal,
    height: 3,
    left: spacing.lg,
    position: 'absolute',
    right: spacing.lg,
    top: 0,
    zIndex: 1,
  },
  imageFrame: {
    alignItems: 'center',
    backgroundColor: colors.bg,
    height: 218,
    justifyContent: 'flex-end',
    margin: spacing.sm,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  welcomeArt: {
    height: '100%',
    width: '100%',
  },
  title: {
    color: colors.silver,
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 0.2,
    lineHeight: 32,
    paddingHorizontal: spacing.lg,
    textAlign: 'center',
  },
  caption: {
    color: colors.silverDim,
    fontSize: 14,
    lineHeight: 21,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xl,
    textAlign: 'center',
  },
  actionsCard: {
    marginTop: spacing.md,
  },
  accountHint: {
    color: colors.silverDim,
    fontSize: 13,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  googleButton: {
    alignItems: 'center',
    backgroundColor: colors.teal,
    borderRadius: radius.sm,
    flexDirection: 'row',
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  googleMark: {
    alignItems: 'center',
    backgroundColor: colors.silver,
    borderRadius: radius.pill,
    height: 24,
    justifyContent: 'center',
    marginRight: spacing.sm,
    width: 24,
  },
  googleMarkText: {
    color: colors.blue,
    fontSize: 15,
    fontWeight: '900',
  },
  googleButtonText: {
    color: colors.bg,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  dividerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginVertical: spacing.sm,
  },
  divider: {
    backgroundColor: colors.line,
    flex: 1,
    height: 1,
  },
  or: {
    color: colors.silverDim,
    fontSize: 12,
    letterSpacing: 2,
    marginHorizontal: spacing.md,
    textAlign: 'center',
  },
  outlineButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radius.sm,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 52,
    paddingVertical: spacing.md,
  },
  outlineButtonText: {
    color: colors.silver,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  link: {
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
  },
  linkText: {
    color: colors.silverDim,
    fontSize: 14,
  },
  premiumNote: {
    color: colors.teal,
    fontSize: 12,
    fontWeight: '700',
    marginTop: spacing.xs,
    textAlign: 'center',
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
  footer: {
    color: colors.silverDim,
    fontSize: 11,
    letterSpacing: 0.4,
    marginTop: spacing.sm,
    opacity: 0.75,
    textAlign: 'center',
  },
});

import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { colors, radius, spacing } from '@resiliencia/design-tokens';
import { useAuth } from '../../src/auth/AuthProvider';
import { authErrorKey } from '../../src/auth/authErrorText';
import { usePrefs } from '../../src/prefs/PrefsProvider';
import { translate } from '../../src/i18n/translations';

export default function SignupScreen() {
  const { signUp, googleSignIn, errorCode, clearError } = useAuth();
  const { prefs } = usePrefs();
  const lang = prefs?.language ?? 'es';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const handleSignup = useCallback(async () => {
    clearError();
    setBusy(true);
    const result = await signUp(email, password, nickname);
    setBusy(false);
    if (!result.ok) {
      return;
    }
    if (result.needsEmailConfirmation) {
      setNotice(translate(prefs?.language ?? 'es', 'auth.email_confirm_notice'));
      return;
    }
  }, [signUp, clearError, email, password, nickname, prefs?.language]);

  const handleGoogle = useCallback(async () => {
    clearError();
    setBusy(true);
    const result = await googleSignIn();
    setBusy(false);
    if (!result.ok) {
      return;
    }
  }, [googleSignIn, clearError]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{translate(lang, 'auth.title_signup')}</Text>
      <TextInput
        style={styles.input}
        value={nickname}
        onChangeText={setNickname}
        placeholder={translate(lang, 'onboarding.nickname')}
        placeholderTextColor={colors.silverDim}
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        placeholder={translate(lang, 'auth.email')}
        placeholderTextColor={colors.silverDim}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
      />
      <TextInput
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        placeholder={translate(lang, 'auth.password')}
        placeholderTextColor={colors.silverDim}
        secureTextEntry
        autoComplete="new-password"
      />
      {errorCode ? (
        <Text style={styles.error}>{translate(lang, authErrorKey(errorCode))}</Text>
      ) : null}
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      <Pressable
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        onPress={handleSignup}
        disabled={busy}
      >
        <Text style={styles.buttonText}>{translate(lang, 'auth.signup')}</Text>
      </Pressable>
      <Text style={styles.divider}>{translate(lang, 'auth.or')}</Text>
      <Pressable
        style={({ pressed }) => [styles.googleButton, pressed && styles.buttonPressed]}
        onPress={handleGoogle}
        disabled={busy}
      >
        <Text style={styles.googleButtonText}>{translate(lang, 'auth.continue_google')}</Text>
      </Pressable>
      <Pressable
        style={styles.link}
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/onboarding'))}
        disabled={busy}
      >
        <Text style={styles.linkText}>{translate(lang, 'auth.back')}</Text>
      </Pressable>
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
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radius.sm,
    borderWidth: 1,
    color: colors.silver,
    fontSize: 16,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  error: {
    color: colors.ember,
    fontSize: 14,
    marginTop: spacing.sm,
  },
  notice: {
    color: colors.teal,
    fontSize: 14,
    marginTop: spacing.sm,
  },
  button: {
    alignItems: 'center',
    backgroundColor: colors.teal,
    borderRadius: radius.sm,
    marginTop: spacing.lg,
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
  divider: {
    color: colors.silverDim,
    fontSize: 12,
    letterSpacing: 2,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  googleButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
    marginTop: spacing.md,
    paddingVertical: spacing.md,
  },
  googleButtonText: {
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
});

import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { colors, radius, spacing } from '@resiliencia/design-tokens';
import { useUser } from '../src/user/UserProvider';
import { usePrefs } from '../src/prefs/PrefsProvider';
import { translate } from '../src/i18n/translations';

export default function OnboardingScreen() {
  const { createUser } = useUser();
  const { prefs } = usePrefs();
  const lang = prefs?.language ?? 'es';
  const [nickname, setNickname] = useState('');
  const [saving, setSaving] = useState(false);

  const handleStart = useCallback(async () => {
    setSaving(true);
    await createUser(nickname);
    router.replace('/(tabs)');
  }, [createUser, nickname]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{translate(lang, 'onboarding.title')}</Text>
      <Text style={styles.caption}>{translate(lang, 'onboarding.caption')}</Text>
      <TextInput
        style={styles.input}
        value={nickname}
        onChangeText={setNickname}
        placeholder={translate(lang, 'onboarding.nickname')}
        placeholderTextColor={colors.silverDim}
        autoCapitalize="none"
      />
      <Pressable
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        onPress={handleStart}
        disabled={saving}
      >
        <Text style={styles.buttonText}>
          {saving ? translate(lang, 'onboarding.creating') : translate(lang, 'onboarding.start')}
        </Text>
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
  caption: {
    color: colors.silverDim,
    fontSize: 16,
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radius.sm,
    borderWidth: 1,
    color: colors.silver,
    fontSize: 16,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
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
});

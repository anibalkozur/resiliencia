import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, spacing } from '@resiliencia/design-tokens';
import { useUser } from '../../src/user/UserProvider';
import { usePrefs } from '../../src/prefs/PrefsProvider';
import { translate } from '../../src/i18n/translations';

export default function PerfilScreen() {
  const { profile, createUser, updateProfile } = useUser();
  const { prefs } = usePrefs();
  const lang = prefs?.language ?? 'es';
  const [nickname, setNickname] = useState(profile?.nickname ?? '');
  const [age, setAge] = useState(profile?.age != null ? String(profile.age) : '');
  const [weight, setWeight] = useState(profile?.weight != null ? String(profile.weight) : '');
  const [height, setHeight] = useState(profile?.height != null ? String(profile.height) : '');
  const [saved, setSaved] = useState(false);

  const handleSave = useCallback(async () => {
    await createUser(nickname);
    await updateProfile({
      age: age.trim() === '' ? undefined : Number(age),
      weight: weight.trim() === '' ? undefined : Number(weight),
      height: height.trim() === '' ? undefined : Number(height),
    });
    setSaved(true);
  }, [age, createUser, height, nickname, updateProfile, weight]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{translate(lang, 'profile.title')}</Text>
      <Text style={styles.caption}>{translate(lang, 'profile.caption')}</Text>
      <View style={styles.card}>
        <Text style={styles.label}>{translate(lang, 'profile.nickname')}</Text>
        <TextInput
          style={styles.input}
          value={nickname}
          onChangeText={setNickname}
          placeholder={translate(lang, 'onboarding.nickname')}
          placeholderTextColor={colors.silverDim}
          autoCapitalize="none"
        />

        <Text style={styles.label}>{translate(lang, 'profile.age')}</Text>
        <TextInput
          style={styles.input}
          value={age}
          onChangeText={setAge}
          placeholder={translate(lang, 'profile.age_placeholder')}
          placeholderTextColor={colors.silverDim}
          keyboardType="number-pad"
        />

        <Text style={styles.label}>{translate(lang, 'profile.weight')}</Text>
        <TextInput
          style={styles.input}
          value={weight}
          onChangeText={setWeight}
          placeholder={translate(lang, 'profile.weight_placeholder')}
          placeholderTextColor={colors.silverDim}
          keyboardType="decimal-pad"
        />

        <Text style={styles.label}>{translate(lang, 'profile.height')}</Text>
        <TextInput
          style={styles.input}
          value={height}
          onChangeText={setHeight}
          placeholder={translate(lang, 'profile.height_placeholder')}
          placeholderTextColor={colors.silverDim}
          keyboardType="number-pad"
        />

        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          onPress={handleSave}
        >
          <Text style={styles.buttonText}>{translate(lang, 'profile.save')}</Text>
        </Pressable>
        <Text style={styles.meta}>
          {translate(lang, 'profile.member_since', {
            date: profile?.createdAt.slice(0, 10) ?? '',
          })}
        </Text>
        {saved && <Text style={styles.saved}>{translate(lang, 'profile.saved')}</Text>}
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
  caption: {
    color: colors.silverDim,
    fontSize: 16,
    marginTop: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    marginTop: spacing.xl,
    padding: spacing.lg,
  },
  label: {
    color: colors.silverDim,
    fontSize: 12,
    letterSpacing: 2,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  input: {
    backgroundColor: colors.bg,
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
  meta: {
    color: colors.silverDim,
    fontSize: 12,
    marginTop: spacing.md,
  },
  saved: {
    color: colors.teal,
    fontSize: 13,
    marginTop: spacing.sm,
  },
});

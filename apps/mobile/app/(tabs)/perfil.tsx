import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, spacing } from '@resiliencia/design-tokens';
import { useUser } from '../../src/user/UserProvider';
import { usePrefs } from '../../src/prefs/PrefsProvider';
import { bmiCategory, computeBmi } from '../../src/user/service';
import { translate } from '../../src/i18n/translations';
import type { TranslationKey } from '../../src/i18n/translations';
import type { BmiCategory } from '../../src/user/service';

const BMI_KEYS: Record<BmiCategory, TranslationKey> = {
  low: 'profile.bmi_low',
  normal: 'profile.bmi_normal',
  over: 'profile.bmi_over',
  obese: 'profile.bmi_obese',
};

const BMI_COLORS: Record<BmiCategory, string> = {
  low: colors.cyan,
  normal: colors.teal,
  over: colors.ember,
  obese: colors.ember,
};

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

  const empty = translate(lang, 'profile.empty_value');
  const bmi = computeBmi(
    profile?.weight != null ? profile.weight : undefined,
    profile?.height != null ? profile.height : undefined,
  );
  const bmiCategoryValue = bmi != null ? bmiCategory(bmi) : null;
  const bmiLabel = bmiCategoryValue != null ? translate(lang, BMI_KEYS[bmiCategoryValue]) : null;
  const bmiColor = bmiCategoryValue != null ? BMI_COLORS[bmiCategoryValue] : colors.teal;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <Text style={styles.title}>{translate(lang, 'profile.title')}</Text>
      <Text style={styles.caption}>{translate(lang, 'profile.caption')}</Text>

      <View style={styles.metricsRow}>
        <View style={styles.metric}>
          <Text style={styles.metricValue}>{profile?.age ?? empty}</Text>
          <Text style={styles.metricLabel}>{translate(lang, 'profile.age')}</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricValue}>{profile?.weight ?? empty}</Text>
          <Text style={styles.metricLabel}>{translate(lang, 'profile.weight')}</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricValue}>{profile?.height ?? empty}</Text>
          <Text style={styles.metricLabel}>{translate(lang, 'profile.height')}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.statsLabel}>{translate(lang, 'profile.stats')}</Text>
        {bmi != null ? (
          <View style={styles.bmiRow}>
            <Text style={styles.bmiValue}>{bmi.toFixed(1)}</Text>
            <Text style={[styles.bmiBadge, { borderColor: bmiColor, color: bmiColor }]}>
              {bmiLabel}
            </Text>
          </View>
        ) : (
          <Text style={styles.hint}>{translate(lang, 'profile.bmi_hint')}</Text>
        )}
      </View>

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
  metricsRow: {
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
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    marginTop: spacing.lg,
    padding: spacing.lg,
  },
  statsLabel: {
    color: colors.silverDim,
    fontSize: 12,
    letterSpacing: 2,
  },
  bmiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  bmiValue: {
    color: colors.teal,
    fontSize: 36,
    fontWeight: '800',
  },
  bmiBadge: {
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  hint: {
    color: colors.silverDim,
    fontSize: 13,
    lineHeight: 19,
    marginTop: spacing.sm,
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

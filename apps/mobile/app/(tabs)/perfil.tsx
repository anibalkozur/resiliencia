import { useCallback, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type DimensionValue,
} from 'react-native';
import { colors, radius, spacing } from '@resiliencia/design-tokens';
import { useUser } from '../../src/user/UserProvider';
import { usePrefs } from '../../src/prefs/PrefsProvider';
import { computeBmi, healthyWeightRange, weightDeviation } from '../../src/user/service';
import { translate } from '../../src/i18n/translations';
import type { TranslationKey } from '../../src/i18n/translations';

const SCALE_MIN = 15;
const SCALE_MAX = 40;

const SCALE_KEYS: TranslationKey[] = [
  'profile.bmi_scale_min',
  'profile.bmi_scale_lower',
  'profile.bmi_scale_upper',
  'profile.bmi_scale_max',
];

function scalePercent(bmi: number): number {
  const clamped = Math.min(SCALE_MAX, Math.max(SCALE_MIN, bmi));
  return ((clamped - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)) * 100;
}

export default function PerfilScreen() {
  const { profile, createUser, updateProfile } = useUser();
  const { prefs } = usePrefs();
  const lang = prefs?.language ?? 'es';
  const [nickname, setNickname] = useState(profile?.nickname ?? '');
  const [age, setAge] = useState(profile?.age != null ? String(profile.age) : '');
  const [weight, setWeight] = useState(profile?.weight != null ? String(profile.weight) : '');
  const [height, setHeight] = useState(profile?.height != null ? String(profile.height) : '');
  const [saved, setSaved] = useState(false);
  const [bmiInfoOpen, setBmiInfoOpen] = useState(false);

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
  const heightCm =
    profile?.height != null && Number.isFinite(profile.height) ? profile.height : undefined;
  const weightKg =
    profile?.weight != null && Number.isFinite(profile.weight) ? profile.weight : undefined;
  const bmi = computeBmi(weightKg, heightCm);
  const healthyRange = heightCm != null ? healthyWeightRange(heightCm) : null;
  const deviation =
    weightKg != null && heightCm != null ? weightDeviation(weightKg, heightCm) : null;
  const deltaLabel =
    deviation == null
      ? translate(lang, 'profile.bmi_within')
      : deviation > 0
        ? translate(lang, 'profile.bmi_above', { delta: deviation.toFixed(1) })
        : translate(lang, 'profile.bmi_below', { delta: Math.abs(deviation).toFixed(1) });
  const markerLeft: DimensionValue = bmi != null ? `${scalePercent(bmi)}%` : '0%';

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
        <View style={styles.statsHeader}>
          <Text style={styles.statsLabel}>{translate(lang, 'profile.bmi')}</Text>
          <Pressable
            accessible
            accessibilityRole="button"
            accessibilityLabel={translate(lang, 'profile.bmi_info_label')}
            onPress={() => setBmiInfoOpen(true)}
            hitSlop={spacing.sm}
            style={styles.infoButton}
          >
            <Text style={styles.infoButtonText}>?</Text>
          </Pressable>
        </View>
        {bmi != null && healthyRange ? (
          <>
            <Text style={styles.bmiValue}>{bmi.toFixed(1)}</Text>
            <View style={styles.scaleTrack}>
              <View style={styles.scaleHealthyZone} />
              <View style={[styles.scaleMarker, { left: markerLeft }]} />
            </View>
            <View style={styles.scaleLabels}>
              {SCALE_KEYS.map((key) => (
                <Text key={key} style={styles.scaleLabel}>
                  {translate(lang, key)}
                </Text>
              ))}
            </View>
            <Text style={styles.bmiDelta}>{deltaLabel}</Text>
            <Text style={styles.healthyRange}>
              {translate(lang, 'profile.healthy_range', {
                min: healthyRange.minKg.toFixed(1),
                max: healthyRange.maxKg.toFixed(1),
              })}
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.bmiValue}>{empty}</Text>
            <Text style={styles.hint}>{translate(lang, 'profile.bmi_hint')}</Text>
          </>
        )}
      </View>

      <Modal
        visible={bmiInfoOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setBmiInfoOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View accessible style={styles.modalCard}>
            <Text style={styles.modalTitle}>{translate(lang, 'profile.bmi_info_title')}</Text>
            <Text style={styles.modalBody}>{translate(lang, 'profile.bmi_info_body')}</Text>
            <Pressable
              accessible
              accessibilityRole="button"
              style={styles.modalButton}
              onPress={() => setBmiInfoOpen(false)}
            >
              <Text style={styles.modalButtonText}>{translate(lang, 'profile.bmi_close')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

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
  statsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  infoButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    width: 20,
    height: 20,
  },
  infoButtonText: {
    color: colors.silverDim,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 16,
  },
  bmiValue: {
    color: colors.teal,
    fontSize: 36,
    fontWeight: '800',
    marginTop: spacing.sm,
  },
  scaleTrack: {
    backgroundColor: colors.line,
    borderRadius: radius.pill,
    height: 8,
    marginTop: spacing.md,
    overflow: 'hidden',
    position: 'relative',
  },
  scaleHealthyZone: {
    position: 'absolute',
    left: `${scalePercent(18.5)}%`,
    width: `${scalePercent(24.9) - scalePercent(18.5)}%`,
    top: 0,
    bottom: 0,
    backgroundColor: colors.teal,
    opacity: 0.35,
  },
  scaleMarker: {
    position: 'absolute',
    top: -3,
    width: 4,
    height: 14,
    borderRadius: 2,
    backgroundColor: colors.silver,
    marginLeft: -2,
  },
  scaleLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  scaleLabel: {
    color: colors.silverDim,
    fontSize: 10,
  },
  bmiDelta: {
    color: colors.silver,
    fontSize: 13,
    marginTop: spacing.md,
  },
  healthyRange: {
    color: colors.teal,
    fontSize: 15,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(3,4,5,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    maxWidth: 420,
    padding: spacing.lg,
  },
  modalTitle: {
    color: colors.silver,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 1,
  },
  modalBody: {
    color: colors.silver,
    fontSize: 14,
    lineHeight: 21,
    marginTop: spacing.md,
  },
  modalButton: {
    alignItems: 'center',
    backgroundColor: colors.teal,
    borderRadius: radius.sm,
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
  },
  modalButtonText: {
    color: colors.bg,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 2,
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

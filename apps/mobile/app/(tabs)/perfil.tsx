import { useCallback, useEffect, useRef, useState } from 'react';
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
import { useAuth } from '../../src/auth/AuthProvider';
import {
  SPORT_CATALOG,
  SPORT_DAYS_MAX,
  SPORT_DAYS_MIN,
  YEARS_MAX,
  YEARS_MIN,
  bmiContext,
  computeBmi,
  computeWhtr,
  habitScore,
  healthyWeightRange,
  muscleTargetWeight,
  normalizeWaistCm,
  weightDeviation,
  whtrZone,
} from '../../src/user/service';
import type { ProfilePatch } from '../../src/user/service';
import { GOAL_TRANSLATION_KEYS, translate } from '../../src/i18n/translations';
import type { TranslationKey } from '../../src/i18n/translations';
import type { Goal } from '../../src/prefs/types';
import type { UserSport } from '../../src/repo';

const SCALE_MIN = 15;
const SCALE_MAX = 40;
const AUTOSAVE_DELAY = 400;

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

function sportKey(sport: string): TranslationKey {
  return `sport.${sport}` as TranslationKey;
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessible
      accessibilityRole="button"
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

function Stepper({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
}) {
  return (
    <View style={styles.stepperRow}>
      <Pressable
        accessible
        accessibilityRole="button"
        style={({ pressed }) => [styles.step, (pressed || value <= min) && styles.stepDim]}
        onPress={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
      >
        <Text style={styles.stepText}>−</Text>
      </Pressable>
      <Text style={styles.stepValue}>{value}</Text>
      <Pressable
        accessible
        accessibilityRole="button"
        style={({ pressed }) => [styles.step, (pressed || value >= max) && styles.stepDim]}
        onPress={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
      >
        <Text style={styles.stepText}>+</Text>
      </Pressable>
    </View>
  );
}

export default function PerfilScreen() {
  const { profile, createUser, updateProfile } = useUser();
  const { prefs, updatePrefs } = usePrefs();
  const { signOut } = useAuth();
  const lang = prefs?.language ?? 'es';
  const goal: Goal | undefined = prefs?.goal;

  const [nickname, setNickname] = useState(profile?.nickname ?? '');
  const [age, setAge] = useState(profile?.age != null ? String(profile.age) : '');
  const [weight, setWeight] = useState(profile?.weight != null ? String(profile.weight) : '');
  const [height, setHeight] = useState(profile?.height != null ? String(profile.height) : '');
  const [waist, setWaist] = useState(profile?.waistCm != null ? String(profile.waistCm) : '');
  const [sports, setSports] = useState<UserSport[]>(profile?.sports ?? []);
  const [nicknameSaved, setNicknameSaved] = useState(false);
  const [bmiInfoOpen, setBmiInfoOpen] = useState(false);

  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current != null) clearTimeout(autosaveTimerRef.current);
    };
  }, []);

  const flushAutosave = useCallback(
    (patch: ProfilePatch) => {
      if (autosaveTimerRef.current != null) clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = setTimeout(async () => {
        const updated = await updateProfile(patch);
        if (updated) {
          if (patch.age !== undefined || patch.weight !== undefined || patch.height !== undefined) {
            setAge(updated.age != null ? String(updated.age) : '');
            setWeight(updated.weight != null ? String(updated.weight) : '');
            setHeight(updated.height != null ? String(updated.height) : '');
          }
          if (patch.waistCm !== undefined) {
            setWaist(updated.waistCm != null ? String(updated.waistCm) : '');
          }
          if (patch.sports !== undefined) {
            setSports(updated.sports ?? []);
          }
        }
      }, AUTOSAVE_DELAY);
    },
    [updateProfile],
  );

  const saveNickname = useCallback(async () => {
    await createUser(nickname);
    setNicknameSaved(true);
    setTimeout(() => setNicknameSaved(false), 2000);
  }, [createUser, nickname]);

  const toggleSport = useCallback(
    (sport: string) => {
      setSports((prev) => {
        const next = prev.some((s) => s.sport === sport)
          ? prev.filter((s) => s.sport !== sport)
          : [...prev, { sport, years: 0, daysPerWeek: 3 }];
        flushAutosave({ sports: next });
        return next;
      });
    },
    [flushAutosave],
  );

  const adjustSport = useCallback(
    (sportId: string, patch: Partial<UserSport>) => {
      setSports((prev) => {
        const next = prev.map((s) => (s.sport === sportId ? { ...s, ...patch } : s));
        flushAutosave({ sports: next });
        return next;
      });
    },
    [flushAutosave],
  );

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
  const context = bmiContext(bmi, goal, sports);
  const muscleTarget = muscleTargetWeight(bmi, goal, sports, heightCm);
  const waistNum = waist.trim() === '' ? undefined : Number(waist);
  const whtr = computeWhtr(normalizeWaistCm(waistNum), heightCm);
  const whtrZoneKey: TranslationKey | null = whtr == null ? null : `profile.whtr_${whtrZone(whtr)}`;
  const score = habitScore(sports);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <Text style={styles.title}>{translate(lang, 'profile.title')}</Text>
      <Text style={styles.caption}>{translate(lang, 'profile.caption')}</Text>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>{translate(lang, 'profile.identity')}</Text>
        <View style={styles.nicknameRow}>
          <TextInput
            style={styles.nicknameInput}
            value={nickname}
            onChangeText={setNickname}
            placeholder={translate(lang, 'onboarding.nickname')}
            placeholderTextColor={colors.silverDim}
            autoCapitalize="none"
          />
          <Pressable
            accessible
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.saveNicknameButton,
              (pressed || nickname === (profile?.nickname ?? '')) && styles.saveNicknameDim,
            ]}
            onPress={saveNickname}
            disabled={nickname === (profile?.nickname ?? '')}
          >
            <Text style={styles.saveNicknameText}>{translate(lang, 'profile.save_nickname')}</Text>
          </Pressable>
        </View>
        {nicknameSaved && (
          <Text style={styles.saved}>{translate(lang, 'profile.nickname_saved')}</Text>
        )}
        <Text style={styles.meta}>
          {translate(lang, 'profile.member_since', {
            date: profile?.createdAt.slice(0, 10) ?? '',
          })}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>{translate(lang, 'profile.body')}</Text>
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

        <Text style={styles.label}>{translate(lang, 'profile.age')}</Text>
        <TextInput
          style={styles.input}
          value={age}
          onChangeText={(text) => {
            setAge(text);
            flushAutosave({ age: text.trim() === '' ? undefined : Number(text) });
          }}
          placeholder={translate(lang, 'profile.age_placeholder')}
          placeholderTextColor={colors.silverDim}
          keyboardType="number-pad"
        />

        <Text style={styles.label}>{translate(lang, 'profile.weight')}</Text>
        <TextInput
          style={styles.input}
          value={weight}
          onChangeText={(text) => {
            setWeight(text);
            flushAutosave({ weight: text.trim() === '' ? undefined : Number(text) });
          }}
          placeholder={translate(lang, 'profile.weight_placeholder')}
          placeholderTextColor={colors.silverDim}
          keyboardType="decimal-pad"
        />

        <Text style={styles.label}>{translate(lang, 'profile.height')}</Text>
        <TextInput
          style={styles.input}
          value={height}
          onChangeText={(text) => {
            setHeight(text);
            flushAutosave({ height: text.trim() === '' ? undefined : Number(text) });
          }}
          placeholder={translate(lang, 'profile.height_placeholder')}
          placeholderTextColor={colors.silverDim}
          keyboardType="number-pad"
        />

        <Text style={styles.autoSaveHint}>{translate(lang, 'profile.auto_save')}</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.statsHeader}>
          <Text style={styles.sectionLabel}>{translate(lang, 'profile.bmi')}</Text>
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
        {context === 'muscle' && (
          <View style={styles.contextBox}>
            <Text style={styles.contextText}>{translate(lang, 'profile.muscle_context')}</Text>
          </View>
        )}
        {muscleTarget != null && (
          <View style={styles.targetBox}>
            <Text style={styles.targetText}>
              {translate(lang, 'profile.muscle_target', { target: muscleTarget.toFixed(1) })}
            </Text>
            <Text style={styles.targetNote}>{translate(lang, 'profile.muscle_target_note')}</Text>
          </View>
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
        <Text style={styles.sectionLabel}>{translate(lang, 'profile.goal')}</Text>
        <View style={styles.row}>
          {(Object.keys(GOAL_TRANSLATION_KEYS) as Goal[]).map((option) => (
            <Chip
              key={option}
              label={translate(lang, GOAL_TRANSLATION_KEYS[option])}
              active={goal === option}
              onPress={() => updatePrefs({ goal: option })}
            />
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>{translate(lang, 'profile.sports')}</Text>
        <Text style={styles.hint}>{translate(lang, 'profile.sports_hint')}</Text>
        <View style={styles.row}>
          {SPORT_CATALOG.map((sport) => (
            <Chip
              key={sport}
              label={translate(lang, sportKey(sport))}
              active={sports.some((s) => s.sport === sport)}
              onPress={() => toggleSport(sport)}
            />
          ))}
        </View>
        {sports.map((sport) => (
          <View key={sport.sport} style={styles.sportRow}>
            <Text style={styles.sportName}>{translate(lang, sportKey(sport.sport))}</Text>
            <View style={styles.sportControls}>
              <View style={styles.sportControl}>
                <Text style={styles.sportControlLabel}>
                  {translate(lang, 'profile.sports_years')}
                </Text>
                <Stepper
                  value={sport.years}
                  min={YEARS_MIN}
                  max={YEARS_MAX}
                  onChange={(years) => adjustSport(sport.sport, { years })}
                />
              </View>
              <View style={styles.sportControl}>
                <Text style={styles.sportControlLabel}>
                  {translate(lang, 'profile.sports_days')}
                </Text>
                <Stepper
                  value={sport.daysPerWeek}
                  min={SPORT_DAYS_MIN}
                  max={SPORT_DAYS_MAX}
                  onChange={(daysPerWeek) => adjustSport(sport.sport, { daysPerWeek })}
                />
              </View>
            </View>
          </View>
        ))}
        <View style={styles.habitBox}>
          <Text style={styles.habitTitle}>{translate(lang, 'profile.habit_title')}</Text>
          {sports.length > 0 ? (
            <>
              <Text style={styles.habitScore}>
                {translate(lang, 'profile.habit_score', { score })}
              </Text>
              <Text style={styles.targetNote}>{translate(lang, 'profile.habit_disclaimer')}</Text>
            </>
          ) : (
            <Text style={styles.hint}>{translate(lang, 'profile.habit_empty')}</Text>
          )}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>{translate(lang, 'profile.measures_title')}</Text>
        <Text style={styles.label}>{translate(lang, 'profile.waist')}</Text>
        <TextInput
          style={styles.input}
          value={waist}
          onChangeText={(text) => {
            setWaist(text);
            flushAutosave({
              waistCm: text.trim() === '' ? undefined : Number(text),
            });
          }}
          placeholder={translate(lang, 'profile.waist_placeholder')}
          placeholderTextColor={colors.silverDim}
          keyboardType="decimal-pad"
        />
        <Text style={styles.hint}>{translate(lang, 'profile.waist_hint')}</Text>
        {whtr != null && whtrZoneKey != null ? (
          <View style={styles.whtrBox}>
            <Text style={styles.whtrValue}>{translate(lang, 'profile.whtr')}</Text>
            <Text style={styles.whtrNumber}>{whtr.toFixed(2)}</Text>
            <Text style={styles.whtrState}>{translate(lang, whtrZoneKey)}</Text>
            <Text style={styles.targetNote}>{translate(lang, 'profile.whtr_note')}</Text>
          </View>
        ) : (
          heightCm != null && (
            <Text style={styles.hint}>{translate(lang, 'profile.whtr_hint')}</Text>
          )
        )}
        <Text style={styles.autoSaveHint}>{translate(lang, 'profile.auto_save')}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>{translate(lang, 'settings.account')}</Text>
        <Pressable
          accessible
          accessibilityRole="button"
          style={({ pressed }) => [styles.logoutButton, pressed && styles.logoutPressed]}
          onPress={() => signOut()}
        >
          <Text style={styles.logoutText}>{translate(lang, 'settings.logout')}</Text>
        </Pressable>
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
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    marginTop: spacing.lg,
    padding: spacing.lg,
  },
  sectionLabel: {
    color: colors.silverDim,
    fontSize: 12,
    letterSpacing: 2,
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
  nicknameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  nicknameInput: {
    flex: 1,
    backgroundColor: colors.bg,
    borderColor: colors.line,
    borderRadius: radius.sm,
    borderWidth: 1,
    color: colors.silver,
    fontSize: 16,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  saveNicknameButton: {
    alignItems: 'center',
    backgroundColor: colors.teal,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  saveNicknameDim: {
    opacity: 0.4,
  },
  saveNicknameText: {
    color: colors.bg,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
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
  autoSaveHint: {
    color: colors.silverDim,
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: spacing.md,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  metric: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: spacing.md,
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
  contextBox: {
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.teal,
    marginTop: spacing.md,
    padding: spacing.md,
  },
  contextText: {
    color: colors.silver,
    fontSize: 13,
    lineHeight: 19,
  },
  targetBox: {
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
    marginTop: spacing.md,
    padding: spacing.md,
  },
  targetText: {
    color: colors.cyan,
    fontSize: 14,
    fontWeight: '800',
  },
  targetNote: {
    color: colors.silverDim,
    fontSize: 11,
    lineHeight: 16,
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
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
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
  sportRow: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    marginTop: spacing.md,
    paddingTop: spacing.md,
  },
  sportName: {
    color: colors.silver,
    fontSize: 15,
    fontWeight: '700',
  },
  sportControls: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.sm,
  },
  sportControl: {
    flex: 1,
  },
  sportControlLabel: {
    color: colors.silverDim,
    fontSize: 10,
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  step: {
    borderColor: colors.line,
    borderRadius: radius.sm,
    borderWidth: 1,
    minWidth: 40,
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  stepDim: {
    opacity: 0.4,
  },
  stepText: {
    color: colors.silver,
    fontSize: 18,
    fontWeight: '700',
  },
  stepValue: {
    color: colors.silver,
    fontSize: 18,
    fontWeight: '800',
    minWidth: 40,
    textAlign: 'center',
  },
  habitBox: {
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
    marginTop: spacing.lg,
    padding: spacing.md,
  },
  habitTitle: {
    color: colors.silverDim,
    fontSize: 11,
    letterSpacing: 2,
  },
  habitScore: {
    color: colors.cyan,
    fontSize: 22,
    fontWeight: '800',
    marginTop: spacing.xs,
  },
  whtrBox: {
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
    marginTop: spacing.md,
    padding: spacing.md,
  },
  whtrValue: {
    color: colors.silverDim,
    fontSize: 11,
    letterSpacing: 2,
  },
  whtrNumber: {
    color: colors.cyan,
    fontSize: 28,
    fontWeight: '800',
    marginTop: spacing.xs,
  },
  whtrState: {
    color: colors.silver,
    fontSize: 13,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  logoutButton: {
    alignItems: 'center',
    borderColor: colors.line,
    borderRadius: radius.sm,
    borderWidth: 1,
    marginTop: spacing.md,
    paddingVertical: spacing.md,
  },
  logoutPressed: {
    opacity: 0.7,
  },
  logoutText: {
    color: colors.silver,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 2,
  },
});

import { useEffect, useRef, useState } from 'react';
import type { ElementRef } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '@resiliencia/design-tokens';
import { useAuth } from '../src/auth/AuthProvider';
import { usePrefs } from '../src/prefs/PrefsProvider';
import { GOAL_TRANSLATION_KEYS, translate } from '../src/i18n/translations';
import type { TranslationKey } from '../src/i18n/translations';
import type { Goal } from '../src/prefs/types';
import { ONBOARDING_GOALS } from '../src/prefs/service';
import { useUser } from '../src/user/UserProvider';
import {
  AGE_MAX,
  AGE_MIN,
  HEIGHT_MAX,
  HEIGHT_MIN,
  WEIGHT_MAX,
  WEIGHT_MIN,
} from '../src/user/service';
import { syncGoalToServer, syncProfileToServer } from '../src/sync/syncService';
import { getSupabase } from '../src/auth/supabase';
import { getRepo } from '../src/repo';
import type { ExperienceLevel, VisualModel } from '../src/repo';

const womanArt = require('../assets/brand/onboarding-mujer.png');
const manArt = require('../assets/brand/onboarding-hombre.png');
const TOTAL_STEPS = 8;
type OnboardingGoal = Exclude<Goal, 'mantener'>;

const GOAL_DESCRIPTION_KEYS: Record<OnboardingGoal, TranslationKey> = {
  perder_grasa: 'goal.perder_grasa_desc',
  ganar_musculo: 'goal.ganar_musculo_desc',
  crear_habito: 'goal.crear_habito_desc',
  sentirme_mejor: 'goal.sentirme_mejor_desc',
};

const GOAL_ICONS: Record<OnboardingGoal, string> = {
  perder_grasa: '↗',
  ganar_musculo: '✦',
  crear_habito: '↻',
  sentirme_mejor: '≈',
};

const EXPERIENCE_OPTIONS: {
  value: ExperienceLevel;
  symbol: string;
  label: TranslationKey;
  description: TranslationKey;
}[] = [
  {
    value: 'nunca_entrene',
    symbol: '✦',
    label: 'experience.nunca_entrene',
    description: 'experience.nunca_entrene_desc',
  },
  {
    value: 'principiante',
    symbol: '↗',
    label: 'experience.principiante',
    description: 'experience.principiante_desc',
  },
  {
    value: 'intermedio',
    symbol: '◆',
    label: 'experience.intermedio',
    description: 'experience.intermedio_desc',
  },
  {
    value: 'avanzado',
    symbol: '✧',
    label: 'experience.avanzado',
    description: 'experience.avanzado_desc',
  },
];

const DAY_OPTIONS: { value: number; label: TranslationKey }[] = [
  { value: 1, label: 'weekday.mon_full' },
  { value: 2, label: 'weekday.tue_full' },
  { value: 3, label: 'weekday.wed_full' },
  { value: 4, label: 'weekday.thu_full' },
  { value: 5, label: 'weekday.fri_full' },
  { value: 6, label: 'weekday.sat_full' },
  { value: 0, label: 'weekday.sun_full' },
];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

const RULER_TICK_WIDTH = 28;

function SliderField({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  const scrollRef = useRef<ElementRef<typeof ScrollView>>(null);
  const [rulerWidth, setRulerWidth] = useState(0);
  const didSetInitialOffset = useRef(false);
  const rulerReady = useRef(false);

  useEffect(() => {
    if (rulerWidth <= 0 || didSetInitialOffset.current) return;
    didSetInitialOffset.current = true;
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        x: (value - min) * RULER_TICK_WIDTH,
        animated: false,
      });
      rulerReady.current = true;
    });
  }, [min, rulerWidth, value]);

  function updateFromOffset(offsetX: number) {
    if (!rulerReady.current) return;
    const next = clamp(min + Math.round(offsetX / RULER_TICK_WIDTH), min, max);
    if (next !== value) onChange(next);
  }

  return (
    <View
      style={styles.rulerBlock}
      onLayout={(event) => setRulerWidth(event.nativeEvent.layout.width)}
    >
      <View pointerEvents="none" style={styles.rulerCenterLine} />
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        bounces={false}
        snapToInterval={RULER_TICK_WIDTH}
        decelerationRate="fast"
        scrollEventThrottle={16}
        contentContainerStyle={{
          paddingHorizontal: Math.max(0, rulerWidth / 2 - RULER_TICK_WIDTH / 2),
        }}
        onScroll={(event) => updateFromOffset(event.nativeEvent.contentOffset.x)}
        onMomentumScrollEnd={(event) => updateFromOffset(event.nativeEvent.contentOffset.x)}
      >
        {Array.from({ length: max - min + 1 }, (_, index) => {
          const tick = min + index;
          return (
            <View key={tick} style={[styles.rulerTick, tick % 5 === 0 && styles.rulerTickLong]} />
          );
        })}
      </ScrollView>
      <View style={styles.rulerLabels}>
        <Text style={styles.sliderLabel}>{min}</Text>
        <Text style={styles.sliderLabel}>{max}</Text>
      </View>
    </View>
  );
}

function ChoiceCard({
  selected,
  label,
  image,
  onPress,
}: {
  selected: boolean;
  label: string;
  image: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.choiceCard,
        selected && styles.choiceCardSelected,
        pressed && styles.pressed,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <View style={styles.choiceImageFrame}>
        <Image source={image} style={styles.choiceImage} resizeMode="contain" />
      </View>
      <Text style={[styles.choiceLabel, selected && styles.choiceLabelSelected]}>{label}</Text>
    </Pressable>
  );
}

export default function ProfileSetupScreen() {
  const { session } = useAuth();
  const { prefs, updatePrefs } = usePrefs();
  const { profile, isLoading, updateProfile } = useUser();
  const lang = prefs?.language ?? 'es';
  const [step, setStep] = useState(0);
  const [visualModel, setVisualModel] = useState<VisualModel | undefined>();
  const [goal, setGoal] = useState<OnboardingGoal>('crear_habito');
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>();
  const [ageText, setAgeText] = useState('');
  const [weight, setWeight] = useState(70);
  const [height, setHeight] = useState(170);
  const [trainingDays, setTrainingDays] = useState<number[]>([1, 3, 5, 6]);
  const [busy, setBusy] = useState(false);
  const profileInitialized = useRef(false);
  const prefsInitialized = useRef(false);

  useEffect(() => {
    if (profileInitialized.current || !profile) return;
    profileInitialized.current = true;
    setVisualModel(profile.visualModel);
    setAgeText(profile.age != null ? String(profile.age) : '');
    setWeight(profile.weight ?? 70);
    setHeight(profile.height ?? 170);
    setExperienceLevel(profile.experienceLevel);
  }, [profile]);

  useEffect(() => {
    if (prefsInitialized.current || !prefs) return;
    prefsInitialized.current = true;
    setGoal(prefs.goal === 'mantener' ? 'crear_habito' : prefs.goal);
    setTrainingDays(prefs.trainingDays);
  }, [prefs]);

  const age = Number(ageText);
  const validAge = Number.isInteger(age) && age >= AGE_MIN && age <= AGE_MAX;
  const canContinue =
    step === 0
      ? visualModel !== undefined
      : step === 1
        ? validAge
        : step === 5
          ? experienceLevel !== undefined
          : step === 6
            ? trainingDays.length > 0
            : true;

  async function finish() {
    if (!profile || !visualModel || !experienceLevel || !validAge || busy) return;
    setBusy(true);
    try {
      const updated = await updateProfile({
        visualModel,
        age,
        weight,
        height,
        experienceLevel,
      });
      await updatePrefs({ goal, trainingDays });
      if (updated) {
        await syncProfileToServer(getSupabase(), updated);
        await syncGoalToServer(getSupabase(), getRepo());
      }
      router.replace('/(tabs)');
    } finally {
      setBusy(false);
    }
  }

  function next() {
    if (!canContinue || busy) return;
    if (step === TOTAL_STEPS - 1) {
      void finish();
      return;
    }
    setStep((current) => current + 1);
  }

  if (isLoading || !profile || !session) {
    return (
      <SafeAreaView style={styles.loading}>
        <ActivityIndicator color={colors.teal} />
      </SafeAreaView>
    );
  }

  const title =
    step === 0
      ? translate(lang, 'profile_setup.visual_title')
      : step === 1
        ? translate(lang, 'profile_setup.age_title')
        : step === 2
          ? translate(lang, 'profile_setup.weight_title')
          : step === 3
            ? translate(lang, 'profile_setup.height_title')
            : step === 4
              ? translate(lang, 'profile_setup.goal_title')
              : step === 5
                ? translate(lang, 'profile_setup.experience_title')
                : translate(lang, 'profile_setup.days_title');
  const body =
    step === 0
      ? translate(lang, 'profile_setup.visual_body')
      : step === 1
        ? translate(lang, 'profile_setup.age_body')
        : step === 2
          ? translate(lang, 'profile_setup.weight_body')
          : step === 3
            ? translate(lang, 'profile_setup.height_body')
            : step === 4
              ? translate(lang, 'profile_setup.goal_body')
              : step === 5
                ? translate(lang, 'profile_setup.experience_body')
                : translate(lang, 'profile_setup.days_body');

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.container}>
        <View style={[styles.header, step === TOTAL_STEPS - 1 && styles.headerSummary]}>
          <Text style={styles.kicker}>{translate(lang, 'profile_setup.kicker')}</Text>
          <Text style={styles.stepText}>
            {translate(lang, 'profile_setup.step', { current: step + 1, total: TOTAL_STEPS })}
          </Text>
          <View style={styles.progressTrack}>
            <View
              style={[styles.progressFill, { width: `${((step + 1) / TOTAL_STEPS) * 100}%` }]}
            />
          </View>
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {step < TOTAL_STEPS - 1 ? (
            <>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.body}>{body}</Text>
            </>
          ) : (
            <>
              <Text style={styles.title}>{translate(lang, 'profile_setup.summary_title')}</Text>
              <Text style={styles.body}>{translate(lang, 'profile_setup.summary_body')}</Text>
            </>
          )}

          {step === 0 ? (
            <View style={styles.choiceRow}>
              <ChoiceCard
                selected={visualModel === 'mujer'}
                label={translate(lang, 'profile_setup.woman')}
                image={womanArt}
                onPress={() => setVisualModel('mujer')}
              />
              <ChoiceCard
                selected={visualModel === 'hombre'}
                label={translate(lang, 'profile_setup.man')}
                image={manArt}
                onPress={() => setVisualModel('hombre')}
              />
            </View>
          ) : null}

          {step === 1 ? (
            <View style={styles.inputPanel}>
              <Text style={styles.inputLabel}>{translate(lang, 'profile_setup.age_label')}</Text>
              <TextInput
                value={ageText}
                onChangeText={setAgeText}
                keyboardType="number-pad"
                placeholder="30"
                placeholderTextColor={colors.silverDim}
                style={styles.ageInput}
                maxLength={3}
                autoFocus
              />
              <Text style={[styles.inputHint, ageText.length > 0 && !validAge && styles.errorText]}>
                {translate(lang, 'profile_setup.age_hint')}
              </Text>
            </View>
          ) : null}

          {step === 2 ? (
            <View style={styles.measurePanel}>
              <Text style={styles.measureValue}>
                {weight.toFixed(1)} {translate(lang, 'profile_setup.weight_suffix')}
              </Text>
              <Text style={styles.inputLabel}>{translate(lang, 'profile_setup.weight_label')}</Text>
              <SliderField value={weight} min={WEIGHT_MIN} max={WEIGHT_MAX} onChange={setWeight} />
              <View style={styles.measureNote}>
                <Text style={styles.measureNoteMark}>i</Text>
                <View style={styles.measureNoteCopy}>
                  <Text style={styles.measureNoteText}>
                    {translate(lang, 'profile_setup.measure_private')}
                  </Text>
                  <Text style={styles.measureNoteText}>
                    {translate(lang, 'profile_setup.measure_use')}
                  </Text>
                </View>
              </View>
            </View>
          ) : null}

          {step === 3 ? (
            <View style={styles.measurePanel}>
              <Text style={styles.measureValue}>
                {height} {translate(lang, 'profile_setup.height_suffix')}
              </Text>
              <Text style={styles.inputLabel}>{translate(lang, 'profile_setup.height_label')}</Text>
              <SliderField value={height} min={HEIGHT_MIN} max={HEIGHT_MAX} onChange={setHeight} />
              <View style={styles.measureNote}>
                <Text style={styles.measureNoteMark}>i</Text>
                <View style={styles.measureNoteCopy}>
                  <Text style={styles.measureNoteText}>
                    {translate(lang, 'profile_setup.measure_private')}
                  </Text>
                  <Text style={styles.measureNoteText}>
                    {translate(lang, 'profile_setup.measure_use')}
                  </Text>
                </View>
              </View>
            </View>
          ) : null}

          {step === 4 ? (
            <View style={styles.goalGrid}>
              {ONBOARDING_GOALS.map((option) => (
                <Pressable
                  key={option}
                  style={({ pressed }) => [
                    styles.goalCard,
                    goal === option && styles.goalCardSelected,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => setGoal(option)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: goal === option }}
                >
                  <View style={[styles.goalIcon, goal === option && styles.goalIconSelected]}>
                    <Text style={styles.goalIconText}>{GOAL_ICONS[option]}</Text>
                  </View>
                  <Text
                    style={[styles.goalCardText, goal === option && styles.goalCardTextSelected]}
                  >
                    {translate(lang, GOAL_TRANSLATION_KEYS[option])}
                  </Text>
                  <Text style={styles.goalCardDescription}>
                    {translate(lang, GOAL_DESCRIPTION_KEYS[option])}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {step === 5 ? (
            <View style={styles.experienceList}>
              {EXPERIENCE_OPTIONS.map((option) => {
                const selected = experienceLevel === option.value;
                return (
                  <Pressable
                    key={option.value}
                    style={({ pressed }) => [
                      styles.experienceCard,
                      selected && styles.experienceCardSelected,
                      pressed && styles.pressed,
                    ]}
                    onPress={() => setExperienceLevel(option.value)}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                  >
                    <View
                      style={[styles.experienceMark, selected && styles.experienceMarkSelected]}
                    >
                      <Text
                        style={[
                          styles.experienceMarkText,
                          selected && styles.experienceMarkTextSelected,
                        ]}
                      >
                        {option.symbol}
                      </Text>
                    </View>
                    <View style={styles.experienceCopy}>
                      <Text
                        style={[styles.experienceLabel, selected && styles.experienceLabelSelected]}
                      >
                        {translate(lang, option.label)}
                      </Text>
                      <Text style={styles.experienceDescription}>
                        {translate(lang, option.description)}
                      </Text>
                    </View>
                    <View style={[styles.selectionMark, selected && styles.selectionMarkSelected]}>
                      {selected ? <Text style={styles.selectionMarkText}>✓</Text> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {step === 6 ? (
            <View style={styles.daysPanel}>
              <Text style={styles.daysCount}>
                {translate(lang, 'profile_setup.days_count', { count: trainingDays.length })}
              </Text>
              <View style={styles.dayGrid}>
                {DAY_OPTIONS.map((day) => {
                  const selected = trainingDays.includes(day.value);
                  return (
                    <Pressable
                      key={day.value}
                      style={({ pressed }) => [
                        styles.dayCard,
                        selected && styles.dayCardSelected,
                        pressed && styles.pressed,
                      ]}
                      onPress={() =>
                        setTrainingDays((current) =>
                          selected
                            ? current.filter((value) => value !== day.value)
                            : [...current, day.value].sort((a, b) => a - b),
                        )
                      }
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                    >
                      <Text style={[styles.dayCardText, selected && styles.dayCardTextSelected]}>
                        {translate(lang, day.label)}
                      </Text>
                      <View style={[styles.dayDot, selected && styles.dayDotSelected]} />
                    </Pressable>
                  );
                })}
              </View>
              <Text style={styles.daysHint}>{translate(lang, 'profile_setup.days_hint')}</Text>
            </View>
          ) : null}

          {step === 7 ? (
            <View style={styles.summaryPanel}>
              <View style={styles.summaryCharacter}>
                <Image
                  source={visualModel === 'mujer' ? womanArt : manArt}
                  style={styles.summaryImage}
                  resizeMode="contain"
                />
              </View>
              <View style={styles.summaryRows}>
                <Text style={styles.summaryRow}>
                  {visualModel === 'mujer'
                    ? translate(lang, 'profile_setup.woman')
                    : translate(lang, 'profile_setup.man')}
                </Text>
                <Text style={styles.summaryRow}>
                  {age} {translate(lang, 'profile_setup.age_suffix')}
                </Text>
                <Text style={styles.summaryRow}>
                  {weight} {translate(lang, 'profile_setup.weight_suffix')} · {height}{' '}
                  {translate(lang, 'profile_setup.height_suffix')}
                </Text>
                <Text style={styles.summaryRow}>
                  {translate(lang, GOAL_TRANSLATION_KEYS[goal])}
                </Text>
                <Text style={styles.summaryRow}>
                  {translate(lang, 'profile_setup.experience_summary')}:{' '}
                  {experienceLevel
                    ? translate(
                        lang,
                        EXPERIENCE_OPTIONS.find((option) => option.value === experienceLevel)!
                          .label,
                      )
                    : '—'}
                </Text>
              </View>
            </View>
          ) : null}
        </ScrollView>

        <View style={[styles.footerActions, step === 0 && styles.footerActionsSingle]}>
          {step > 0 ? (
            <Pressable
              style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
              onPress={() => setStep((current) => current - 1)}
              disabled={busy}
            >
              <Text style={styles.backText}>{translate(lang, 'profile_setup.back')}</Text>
            </Pressable>
          ) : null}
          <Pressable
            style={({ pressed }) => [
              styles.nextButton,
              step === 0 && styles.nextButtonSingle,
              !canContinue && styles.nextDisabled,
              pressed && styles.pressed,
            ]}
            onPress={next}
            disabled={!canContinue || busy}
          >
            <Text style={styles.nextText}>
              {busy
                ? translate(lang, 'profile_setup.saving')
                : step === TOTAL_STEPS - 1
                  ? translate(lang, 'profile_setup.finish')
                  : translate(lang, 'profile_setup.continue')}
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  loading: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  header: { marginBottom: spacing.lg },
  headerSummary: { marginBottom: spacing.sm },
  kicker: { color: colors.teal, fontSize: 11, fontWeight: '900', letterSpacing: 2.2 },
  stepText: { color: colors.silverDim, fontSize: 12, marginTop: spacing.sm },
  progressTrack: {
    backgroundColor: colors.line,
    borderRadius: radius.pill,
    height: 5,
    marginTop: spacing.sm,
    overflow: 'hidden',
  },
  progressFill: { backgroundColor: colors.teal, borderRadius: radius.pill, height: '100%' },
  content: { flex: 1 },
  contentContainer: { paddingBottom: spacing.md },
  title: {
    color: colors.silver,
    fontSize: 29,
    fontWeight: '900',
    lineHeight: 35,
    letterSpacing: 0.1,
    textAlign: 'center',
  },
  body: {
    alignSelf: 'center',
    color: colors.silverDim,
    fontSize: 15,
    lineHeight: 22,
    marginTop: spacing.sm,
    maxWidth: 360,
    textAlign: 'center',
  },
  goalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'space-between',
    marginTop: spacing.xl,
  },
  goalCard: {
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radius.md,
    borderWidth: 1,
    minHeight: 154,
    justifyContent: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    width: '48%',
  },
  goalCardSelected: { backgroundColor: colors.surface, borderColor: colors.teal, borderWidth: 2 },
  goalIcon: {
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderColor: colors.line,
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    marginBottom: spacing.sm,
    width: 34,
  },
  goalIconSelected: { backgroundColor: colors.teal, borderColor: colors.teal },
  goalIconText: { color: colors.teal, fontSize: 20, fontWeight: '900' },
  goalCardText: { color: colors.silverDim, fontSize: 15, fontWeight: '800', lineHeight: 19 },
  goalCardTextSelected: { color: colors.teal },
  goalCardDescription: { color: colors.silverDim, fontSize: 12, lineHeight: 17, marginTop: 6 },
  experienceList: { gap: spacing.sm, marginTop: spacing.xl },
  experienceCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 78,
    padding: spacing.md,
  },
  experienceCardSelected: {
    backgroundColor: '#0D272A',
    borderColor: colors.teal,
    borderWidth: 2,
  },
  experienceMark: {
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderColor: colors.line,
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    marginRight: spacing.md,
    width: 42,
  },
  experienceMarkSelected: { backgroundColor: colors.teal, borderColor: colors.teal },
  experienceMarkText: { color: colors.teal, fontSize: 20, fontWeight: '900' },
  experienceMarkTextSelected: { color: colors.bg },
  experienceCopy: { flex: 1 },
  experienceLabel: { color: colors.silver, fontSize: 16, fontWeight: '800' },
  experienceLabelSelected: { color: colors.teal },
  experienceDescription: { color: colors.silverDim, fontSize: 13, lineHeight: 18, marginTop: 3 },
  selectionMark: {
    alignItems: 'center',
    borderColor: colors.line,
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 24,
    justifyContent: 'center',
    marginLeft: spacing.sm,
    width: 24,
  },
  selectionMarkSelected: { backgroundColor: colors.teal, borderColor: colors.teal },
  selectionMarkText: { color: colors.bg, fontSize: 15, fontWeight: '900' },
  daysPanel: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginTop: spacing.xl,
    padding: spacing.md,
  },
  daysCount: { color: colors.teal, fontSize: 22, fontWeight: '900', textAlign: 'center' },
  dayGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  dayCard: {
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderColor: colors.line,
    borderRadius: radius.md,
    borderWidth: 1,
    minHeight: 72,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    width: '30%',
  },
  dayCardSelected: { borderColor: colors.teal, backgroundColor: colors.surface },
  dayCardText: { color: colors.silverDim, fontSize: 13, fontWeight: '800', textAlign: 'center' },
  dayCardTextSelected: { color: colors.silver },
  dayDot: {
    backgroundColor: colors.line,
    borderRadius: radius.pill,
    height: 7,
    marginTop: spacing.sm,
    width: 7,
  },
  dayDotSelected: { backgroundColor: colors.teal },
  daysHint: {
    color: colors.silverDim,
    fontSize: 12,
    lineHeight: 18,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  choiceRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl },
  choiceCard: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radius.lg,
    borderWidth: 1,
    flex: 1,
    overflow: 'hidden',
    paddingBottom: spacing.md,
  },
  choiceCardSelected: { borderColor: colors.teal, borderWidth: 2 },
  choiceImageFrame: {
    alignItems: 'center',
    backgroundColor: colors.bg,
    height: 270,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  choiceImage: { height: '100%', width: '100%' },
  choiceLabel: {
    color: colors.silver,
    fontSize: 16,
    fontWeight: '800',
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  choiceLabelSelected: { color: colors.teal },
  inputPanel: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginTop: spacing.xl,
    padding: spacing.xl,
  },
  inputLabel: {
    color: colors.silverDim,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    textAlign: 'center',
  },
  ageInput: {
    color: colors.silver,
    fontSize: 58,
    fontWeight: '900',
    minWidth: 150,
    paddingVertical: spacing.sm,
    textAlign: 'center',
  },
  inputHint: { color: colors.silverDim, fontSize: 13, marginTop: spacing.sm },
  errorText: { color: colors.ember },
  measurePanel: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginTop: spacing.xl,
    padding: spacing.xl,
  },
  measureValue: { color: colors.teal, fontSize: 54, fontWeight: '900', textAlign: 'center' },
  measureNote: {
    backgroundColor: colors.bg,
    borderColor: colors.line,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: spacing.xl,
    padding: spacing.md,
  },
  measureNoteMark: {
    alignItems: 'center',
    borderColor: colors.silverDim,
    borderRadius: radius.pill,
    borderWidth: 1,
    color: colors.silver,
    fontSize: 12,
    fontWeight: '900',
    height: 22,
    lineHeight: 19,
    marginRight: spacing.sm,
    textAlign: 'center',
    width: 22,
  },
  measureNoteCopy: { flex: 1, gap: spacing.xs },
  measureNoteText: { color: colors.silverDim, fontSize: 12, lineHeight: 17 },
  rulerBlock: { marginTop: spacing.xl, position: 'relative' },
  rulerCenterLine: {
    backgroundColor: colors.silver,
    height: 70,
    left: '50%',
    marginLeft: -1,
    position: 'absolute',
    top: 0,
    width: 2,
    zIndex: 1,
  },
  rulerTick: {
    backgroundColor: colors.line,
    height: 30,
    marginHorizontal: (RULER_TICK_WIDTH - 2) / 2,
    marginTop: 40,
    width: 2,
  },
  rulerTickLong: { backgroundColor: colors.silverDim, height: 46, marginTop: 24 },
  rulerLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm },
  sliderLabel: { color: colors.silverDim, fontSize: 12 },
  summaryPanel: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: spacing.md,
    minHeight: 220,
    overflow: 'hidden',
    padding: spacing.sm,
  },
  summaryCharacter: {
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    flex: 1,
    overflow: 'hidden',
  },
  summaryImage: { height: '100%', width: '100%' },
  summaryRows: { justifyContent: 'center', paddingHorizontal: spacing.md, width: '44%' },
  summaryRow: {
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    color: colors.silver,
    fontSize: 13,
    fontWeight: '700',
    paddingVertical: spacing.md,
  },
  footerActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    paddingTop: spacing.md,
  },
  footerActionsSingle: { justifyContent: 'center' },
  backButton: {
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  backText: { color: colors.silverDim, fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  nextButton: {
    alignItems: 'center',
    backgroundColor: colors.teal,
    borderRadius: radius.sm,
    flex: 1,
    minHeight: 52,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  nextButtonSingle: { flex: 0, width: '78%' },
  nextDisabled: { opacity: 0.35 },
  nextText: {
    color: colors.bg,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.2,
    textAlign: 'center',
  },
  pressed: { opacity: 0.7 },
});

import { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { WebView } from 'react-native-webview';
import { colors, radius, spacing } from '@resiliencia/design-tokens';
import { useAuth } from '../../src/auth/AuthProvider';
import { usePrefs } from '../../src/prefs/PrefsProvider';
import { getRepo } from '../../src/repo';
import { markCompleted, isCompleted } from '../../src/retos/completions';
import { getTodayChallenge, todayKey } from '../../src/retos/service';
import { getCompletedCount } from '../../src/retos/streak';
import { syncAfterLogin } from '../../src/sync/syncService';
import { EXERCISES, DEFAULT_TARGETS, exerciseNameKey } from '../../src/retos/catalog';
import { translate } from '../../src/i18n/translations';
import type { DailyChallenge } from '../../src/retos/types';

const VERIFY_URL = 'https://anibalkozur.github.io/resiliencia/camera-verification.html';

type Mode = 'challenge' | 'free';

export default function CamretoScreen() {
  const router = useRouter();
  const { prefs } = usePrefs();
  const { session } = useAuth();
  const repo = getRepo();
  const [challenge, setChallenge] = useState<DailyChallenge | null>(null);
  const [completed, setCompleted] = useState(false);
  const [count, setCount] = useState(0);
  const webViewRef = useRef<any>(null);
  const [mode, setMode] = useState<Mode>('challenge');
  const [freeExerciseId, setFreeExerciseId] = useState<string>('sentadillas');
  const [freeTarget, setFreeTarget] = useState<number>(DEFAULT_TARGETS.sentadillas);
  const [freeActive, setFreeActive] = useState(false);
  const [freeResult, setFreeResult] = useState<string | null>(null);

  const exercise = challenge ? EXERCISES.find((e) => e.id === challenge.exerciseId) : undefined;
  const lang = prefs?.language ?? 'es';
  const target = challenge?.target ?? 0;
  const unit = exercise?.unit ?? 'reps';

  const freeExercise = EXERCISES.find((e) => e.id === freeExerciseId);
  const freeUnit = freeExercise?.unit ?? 'reps';
  const freeUnitLabel = translate(lang, freeUnit === 'reps' ? 'unit.reps' : 'unit.seconds');
  const challengeReady = !!challenge && !!exercise;

  useEffect(() => {
    async function load() {
      const date = todayKey();
      const alreadyDone = await isCompleted(repo, date);
      if (alreadyDone) setCompleted(true);
      const todayChallenge = await getTodayChallenge(repo);
      setChallenge(todayChallenge);
    }
    load();
  }, [repo]);

  const handleMessage = useCallback(
    (event: any) => {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type !== 'complete') return;
      const reps = Number(data.reps) || 0;
      if (mode === 'free') {
        setFreeResult(translate(lang, 'cam.free_done', { n: reps, unit: freeUnitLabel }));
        return;
      }
      if (reps >= target) {
        const date = todayKey();
        void markCompleted(repo, date);
        void getCompletedCount(repo).then((cnt: number) => setCount(cnt));
        setCompleted(true);
        if (session) {
          void syncAfterLogin(repo, session.user.id);
        }
      }
    },
    [repo, session, target, mode, lang, freeUnitLabel],
  );

  function handleClose() {
    router.back();
  }

  function pickExercise(id: string) {
    setFreeExerciseId(id);
    setFreeTarget(DEFAULT_TARGETS[id] ?? 10);
    setFreeResult(null);
    setFreeActive(false);
  }

  function stepTarget(delta: number) {
    const step = freeUnit === 'reps' ? 1 : 5;
    setFreeTarget((t) => Math.max(1, t + delta * step));
  }

  const showWebView = mode === 'free' ? freeActive : !completed && challengeReady;

  const verificationSource =
    mode === 'free'
      ? { uri: `${VERIFY_URL}?exercise=${freeExerciseId}&target=${freeTarget}&unit=${freeUnit}` }
      : challengeReady
        ? { uri: `${VERIFY_URL}?exercise=${exercise!.id}&target=${target}&unit=${unit}` }
        : undefined;

  return (
    <View style={styles.container}>
      <View style={styles.topSection}>
        <View style={styles.modeRow}>
          <Pressable
            style={[styles.modePill, mode === 'challenge' && styles.modePillActive]}
            onPress={() => setMode('challenge')}
          >
            <Text style={[styles.modePillText, mode === 'challenge' && styles.modePillTextActive]}>
              {translate(lang, 'cam.challenge')}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.modePill, mode === 'free' && styles.modePillActive]}
            onPress={() => setMode('free')}
          >
            <Text style={[styles.modePillText, mode === 'free' && styles.modePillTextActive]}>
              {translate(lang, 'cam.free')}
            </Text>
          </Pressable>
        </View>

        {mode === 'challenge' && challengeReady ? (
          <View style={styles.card}>
            <Text style={styles.exerciseName}>
              {translate(lang, exerciseNameKey(exercise!.id))}
            </Text>
            <Text style={styles.target}>
              {target} {exercise!.unit === 'reps' ? 'reps' : 'seg'}
            </Text>
          </View>
        ) : null}

        {mode === 'free' && !freeActive ? (
          <View style={styles.card}>
            <Text style={styles.freeHint}>{translate(lang, 'cam.free_hint')}</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsRow}
            >
              {EXERCISES.map((e) => {
                const selected = e.id === freeExerciseId;
                return (
                  <Pressable
                    key={e.id}
                    style={[styles.chip, selected && styles.chipSelected]}
                    onPress={() => pickExercise(e.id)}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                      {translate(lang, exerciseNameKey(e.id))}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <View style={styles.targetRow}>
              <Pressable style={styles.stepBtn} onPress={() => stepTarget(-1)}>
                <Text style={styles.stepBtnText}>−</Text>
              </Pressable>
              <Text style={styles.targetValue}>
                {freeTarget} {freeUnitLabel}
              </Text>
              <Pressable style={styles.stepBtn} onPress={() => stepTarget(1)}>
                <Text style={styles.stepBtnText}>+</Text>
              </Pressable>
            </View>
            <Pressable
              style={[styles.cta, styles.ctaBlock]}
              onPress={() => {
                setFreeResult(null);
                setFreeActive(true);
              }}
            >
              <Text style={styles.ctaText}>{translate(lang, 'cam.free_open')}</Text>
            </Pressable>
          </View>
        ) : null}

        {mode === 'free' && freeActive ? (
          <View style={styles.freeHeader}>
            <Text style={styles.freeHeaderTitle}>
              {translate(lang, exerciseNameKey(freeExerciseId))} · {freeTarget} {freeUnitLabel}
            </Text>
            <Pressable
              style={styles.changeBtn}
              onPress={() => {
                setFreeActive(false);
                setFreeResult(null);
              }}
            >
              <Text style={styles.changeBtnText}>{translate(lang, 'cam.free_change')}</Text>
            </Pressable>
          </View>
        ) : null}

        {freeResult ? <Text style={styles.freeResult}>{freeResult}</Text> : null}
      </View>

      <View style={styles.cameraContainer}>
        {mode === 'challenge' && completed ? (
          <View style={styles.resultContainer}>
            <Text style={styles.completeText}>RETO COMPLETADO</Text>
            <Text style={styles.resultCount}>{count} completadas</Text>
            <Pressable style={styles.cta} onPress={handleClose}>
              <Text style={styles.ctaText}>VOLVER</Text>
            </Pressable>
            <Pressable
              style={[styles.cta, styles.ctaGhost, { marginTop: spacing.md }]}
              onPress={() => {
                setMode('free');
                setFreeActive(true);
              }}
            >
              <Text style={styles.ctaGhostText}>{translate(lang, 'cam.free_after_done')}</Text>
            </Pressable>
          </View>
        ) : showWebView ? (
          <WebView
            ref={webViewRef}
            originWhitelist={['*']}
            source={verificationSource}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            allowsInlineMediaPlayback={true}
            mediaPlaybackRequiresUserAction={false}
            onMessage={handleMessage}
            style={styles.webView}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  topSection: { paddingHorizontal: spacing.md },
  modeRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  modePill: {
    flex: 1,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  modePillActive: { borderColor: colors.teal, backgroundColor: '#0D1E18' },
  modePillText: { color: colors.silverDim, fontSize: 13, fontWeight: '700' },
  modePillTextActive: { color: colors.teal },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
    marginTop: spacing.md,
  },
  exerciseName: { color: colors.silver, fontSize: 22, fontWeight: '800' },
  target: { color: colors.teal, fontSize: 30, fontWeight: '800', marginTop: spacing.xs },
  freeHint: { color: colors.silverDim, fontSize: 13, marginBottom: spacing.sm },
  chipsRow: { gap: spacing.sm, paddingRight: spacing.lg },
  chip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  chipSelected: { borderColor: colors.teal, backgroundColor: '#0D1E18' },
  chipText: { color: colors.silverDim, fontSize: 13, fontWeight: '600' },
  chipTextSelected: { color: colors.teal, fontWeight: '800' },
  targetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    marginTop: spacing.sm,
  },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: { color: colors.teal, fontSize: 24, fontWeight: '800' },
  targetValue: {
    color: colors.silver,
    fontSize: 20,
    fontWeight: '800',
    minWidth: 120,
    textAlign: 'center',
  },
  cta: {
    backgroundColor: colors.teal,
    borderRadius: radius.pill,
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  ctaBlock: { marginTop: spacing.sm },
  ctaText: { color: colors.bg, fontSize: 15, fontWeight: '800', letterSpacing: 2 },
  ctaGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.teal },
  ctaGhostText: { color: colors.teal, fontSize: 15, fontWeight: '800', letterSpacing: 2 },
  freeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  freeHeaderTitle: { color: colors.silver, fontSize: 15, fontWeight: '800', flex: 1 },
  changeBtn: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.pill,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  changeBtnText: { color: colors.teal, fontSize: 12, fontWeight: '700' },
  freeResult: {
    color: colors.teal,
    fontSize: 13,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  cameraContainer: { flex: 1 },
  resultContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  completeText: { color: colors.teal, fontSize: 28, fontWeight: '800', letterSpacing: 2 },
  resultCount: { color: colors.silver, fontSize: 16, marginTop: spacing.md },
  webView: { flex: 1 },
});

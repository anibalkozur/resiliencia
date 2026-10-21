import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { WebView } from 'react-native-webview';
import { DeviceMotion } from 'expo-sensors';
import { colors, radius, spacing } from '@resiliencia/design-tokens';
import { usePrefs } from '../../src/prefs/PrefsProvider';
import { DEFAULT_TRAINING_DAYS } from '../../src/prefs/service';
import { useAuth } from '../../src/auth/AuthProvider';
import { getRepo } from '../../src/repo';
import {
  DEFAULT_CADENCE_SEC,
  EXERCISES,
  REP_CADENCE,
  exerciseNameKey,
} from '../../src/retos/catalog';
import { isCompleted, markCompleted, getCompletionSyncState } from '../../src/retos/completions';
import type { CompletionSyncState } from '../../src/retos/completions';
import { buildWeek } from '../../src/retos/week';
import { getTodayChallenge, todayKey } from '../../src/retos/service';
import { buildVerifyUri } from '../../src/retos/verify';
import { syncAfterLogin } from '../../src/sync/syncService';
import { translate } from '../../src/i18n/translations';
import { hablarVoz } from '../../src/lib/voz';
import { TECNICA } from '../../src/lib/tecnica';
import { useCameraRestart } from '../../src/retos/useCameraRestart';
import { useScreenFocused } from '../../src/retos/useScreenFocused';
import { useLibreExercise } from '../../src/header/LibreExerciseProvider';
import { useDayKey } from '../../src/retos/DayProvider';
import { usePremium } from '../../src/premium/usePremium';
import type { TranslationKey } from '../../src/i18n/translations';
import type { DailyChallenge } from '../../src/retos/types';

const WEEKDAYS: TranslationKey[] = [
  'weekday.sun',
  'weekday.mon',
  'weekday.tue',
  'weekday.wed',
  'weekday.thu',
  'weekday.fri',
  'weekday.sat',
];

export default function RetosScreen() {
  const router = useRouter();
  const { prefs } = usePrefs();
  const { session } = useAuth();
  const lang = prefs?.language ?? 'es';
  const goal = prefs?.goal ?? 'mantener';
  const trainingDays = prefs?.trainingDays ?? DEFAULT_TRAINING_DAYS;
  const repo = getRepo();
  const dayKey = useDayKey();
  const premium = usePremium();
  const [challenge, setChallenge] = useState<DailyChallenge | null>(null);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [syncState, setSyncState] = useState<Record<string, CompletionSyncState>>({});
  const [retrying, setRetrying] = useState(false);
  // Dos pantallas dentro de la pestaña: 'inicio' muestra el reto del día con su
  // explicación y el botón INICIAR; 'camara' es el ejercicio a pantalla completa.
  const [fase, setFase] = useState<'inicio' | 'camara'>('inicio');
  const restartKey = useCameraRestart();
  const focused = useScreenFocused();
  const { setRetosActive, setRetosSalirHandler } = useLibreExercise();

  const week = useMemo(
    () => buildWeek(goal, trainingDays, new Date(`${dayKey}T00:00:00`)),
    [goal, trainingDays, dayKey],
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const result: Record<string, boolean> = {};
        const states: Record<string, CompletionSyncState> = {};
        for (const day of week) {
          result[day.date] = await isCompleted(repo, day.date);
          const state = await getCompletionSyncState(repo, day.date);
          if (state) {
            states[day.date] = state;
          }
        }
        const todayChallenge = await getTodayChallenge(repo);
        if (!active) return;
        setDone(result);
        setSyncState(states);
        setChallenge(todayChallenge);
      })();
      return () => {
        active = false;
      };
    }, [week, repo]),
  );

  const challengeExercise = challenge
    ? EXERCISES.find((e) => e.id === challenge.exerciseId)
    : undefined;
  const tecnicaGuia = challengeExercise ? TECNICA[challengeExercise.id]?.guia : undefined;
  const date = todayKey();
  const challengeDone = (done[date] ?? false) && !retrying;
  const todayState = syncState[date];
  const isRejected = todayState?.status === 'rejected';
  const doneLabel = isRejected
    ? translate(lang, 'home.completed_rejected')
    : todayState?.status === 'pending'
      ? translate(lang, 'home.completed_pending')
      : translate(lang, 'home.completed');
  const today = week.find((d) => d.isToday);
  const trainingToday = today?.isTraining ?? false;

  // Cierra la cámara del reto: mismo resultado que apretar SALIR dentro del
  // WebView (que además se traba si el cuerpo no está 100% visible).
  const exitChallenge = useCallback(() => {
    setFase('inicio');
    setRetrying(false);
  }, []);

  const handleMessage = useCallback(
    (event: any) => {
      let data: Record<string, unknown>;
      try {
        data = JSON.parse(event.nativeEvent.data);
      } catch {
        return;
      }
      if (data.type === 'voz') {
        hablarVoz(typeof data.text === 'string' ? data.text : '');
        return;
      }
      if (data.type === 'voz_log') return;
      if (data.type === 'exit') {
        exitChallenge();
        return;
      }
      if (data.type === 'repeat') return;
      if (data.type !== 'complete') return;
      // Reto completado: al confirmar la señal de vida el WebView emite
      // `complete` con el resultado ya validado. Marcamos el reto y salimos
      // automáticamente a la pantalla inicial (no dejamos REPETIR activo).
      const reps = Number(data.reps) || 0;
      const target = challenge?.target ?? 0;
      const already = done[date] === true;
      if (reps >= target && (!already || retrying)) {
        // Marcamos el reto como hecho ANTES de volver a Inicio, para que la
        // pantalla inicial muestre el estado "completado" sin un parpadeo.
        setDone((prev) => ({ ...prev, [date]: true }));
        exitChallenge();
        void (async () => {
          const wasRetrying = retrying;
          await markCompleted(
            repo,
            date,
            {
              value: Number(data.value ?? data.reps) || reps,
              unit: data.unit === 'seconds' ? 'seconds' : 'reps',
              target,
              evidence:
                typeof data.evidence === 'object' &&
                data.evidence !== null &&
                !Array.isArray(data.evidence)
                  ? (data.evidence as Record<string, unknown>)
                  : undefined,
            },
            { retry: wasRetrying },
          );
          setRetrying(false);
          setSyncState((prev) => ({ ...prev, [date]: { status: 'pending' } }));
          if (session) {
            await syncAfterLogin(repo, session.user.id);
            const state = await getCompletionSyncState(repo, date);
            if (state) {
              setSyncState((prev) => ({ ...prev, [date]: state }));
            }
          }
        })();
      }
    },
    [repo, challenge, date, retrying, session, done, exitChallenge],
  );

  const webviewRef = useRef<any>(null);

  const challengeBlock = challenge && challengeExercise && trainingToday;

  // El botón nativo de SALIR del header se muestra solo mientras la cámara del
  // reto está montada (fase 'camara' y pestaña enfocada).
  const cameraVisible = Boolean(challengeBlock) && fase === 'camara' && focused;

  useEffect(() => {
    setRetosActive(cameraVisible);
    return () => setRetosActive(false);
  }, [cameraVisible, setRetosActive]);

  useEffect(() => {
    setRetosSalirHandler(exitChallenge);
    return () => setRetosSalirHandler(null);
  }, [setRetosSalirHandler, exitChallenge]);

  useEffect(() => {
    if (!cameraVisible) return;
    let sensorSubscription: { remove: () => void } | null = null;
    let active = true;
    DeviceMotion.isAvailableAsync().then((available) => {
      if (!available || !active) return;
      DeviceMotion.setUpdateInterval(200);
      sensorSubscription = DeviceMotion.addListener(({ accelerationIncludingGravity: g }) => {
        if (!g || !Number.isFinite(g.y) || !Number.isFinite(g.z)) return;
        if (Math.hypot(g.y, g.z) < 1) return;
        const tilt = (Math.atan2(Math.abs(g.z), Math.abs(g.y)) * 180) / Math.PI;
        const vertical = tilt <= 35;
        webviewRef.current?.injectJavaScript(
          `window.__resilienciaSetNativeOrientation && window.__resilienciaSetNativeOrientation(${JSON.stringify({ available: true, vertical, beta: null })})`,
        );
      });
    });
    return () => {
      active = false;
      sensorSubscription?.remove();
    };
  }, [cameraVisible]);

  return (
    <View style={styles.screen}>
      {fase === 'inicio' ? (
        <View style={styles.topSection}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{translate(lang, 'retos.title')}</Text>
            <Text style={styles.planSmall}>
              {translate(lang, 'retos.plan_small', { n: trainingDays.length })}
            </Text>
          </View>
          <View style={styles.weekRow}>
            {week.map((day) => (
              <View
                key={day.date}
                style={[
                  styles.weekCell,
                  day.isTraining ? styles.weekCellTraining : styles.weekCellRest,
                  day.isToday && styles.weekCellToday,
                  done[day.date] && styles.weekCellDone,
                ]}
              >
                <Text
                  style={[
                    styles.weekLabel,
                    done[day.date]
                      ? styles.weekLabelDone
                      : day.isToday
                        ? styles.weekLabelToday
                        : null,
                  ]}
                >
                  {translate(lang, WEEKDAYS[day.dayOfWeek])}
                </Text>
                {done[day.date] ? <View style={styles.dotDone} /> : null}
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {challengeBlock ? (
        // Pantalla del ejercicio: sin encabezado, sin barra del reto y sin la
        // guía técnica, para que la cámara ocupe toda la pantalla.
        fase === 'camara' && premium ? (
          focused ? (
            <View style={styles.cameraContainer}>
              <WebView
                ref={webviewRef}
                key={`stream-${dayKey}-${challenge.exerciseId}-${challenge.target}-${restartKey}`}
                originWhitelist={['*']}
                source={{
                  uri: buildVerifyUri(
                    challenge.exerciseId,
                    challenge.target,
                    challengeExercise.unit,
                    {
                      requireLiveness: true,
                      // Igual que el modo libre: si la pausa entre repes supera
                      // la cadencia, la serie se corta y aparece REPETIR.
                      strict: true,
                      cadenceSec: REP_CADENCE[challenge.exerciseId] ?? DEFAULT_CADENCE_SEC,
                    },
                  ),
                }}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                allowsInlineMediaPlayback={true}
                mediaPlaybackRequiresUserAction={false}
                onPermissionRequest={(request: any) => request.grant()}
                onMessage={handleMessage}
                style={styles.webView}
              />
            </View>
          ) : null
        ) : challengeDone ? (
          <View style={styles.cameraContainer}>
            <View style={styles.doneBox}>
              <Text style={styles.cameraDoneText}>{doneLabel}</Text>
              {isRejected ? (
                <Pressable
                  style={styles.cameraCta}
                  onPress={() => {
                    setRetrying(true);
                    setFase('camara');
                  }}
                >
                  <Text style={styles.cameraCtaText}>{translate(lang, 'home.retry')}</Text>
                </Pressable>
              ) : (
                <Pressable style={styles.cameraCta} onPress={() => router.push('/(tabs)/camretos')}>
                  <Text style={styles.cameraCtaText}>{translate(lang, 'cam.free_after_done')}</Text>
                </Pressable>
              )}
            </View>
          </View>
        ) : (
          <View style={styles.startWrap}>
            <View style={styles.startCard}>
              <Text style={styles.startKicker}>{translate(lang, 'cam.challenge')}</Text>
              <View style={styles.startHead}>
                <Text style={styles.startName}>
                  {translate(lang, exerciseNameKey(challengeExercise.id))}
                </Text>
                <Text style={styles.startTarget}>
                  {challenge.target}{' '}
                  {translate(
                    lang,
                    challengeExercise.unit === 'reps' ? 'unit.reps' : 'unit.seconds',
                  )}
                </Text>
              </View>
              {tecnicaGuia ? <Text style={styles.startGuide}>{tecnicaGuia}</Text> : null}
            </View>
            {premium ? (
              <Pressable
                style={styles.startBtn}
                onPress={() => setFase('camara')}
                accessibilityRole="button"
              >
                <Text style={styles.startBtnText}>{translate(lang, 'cam.free_setup_start')}</Text>
              </Pressable>
            ) : (
              <View style={styles.premiumBox}>
                <Text style={styles.premiumTitle}>{translate(lang, 'retos.premium_title')}</Text>
                <Text style={styles.premiumBody}>{translate(lang, 'retos.premium_body')}</Text>
                <Pressable
                  style={styles.premiumCta}
                  onPress={() =>
                    Alert.alert(
                      translate(lang, 'retos.premium_title'),
                      translate(lang, 'retos.premium_body'),
                    )
                  }
                  accessibilityRole="button"
                >
                  <Text style={styles.premiumCtaText}>{translate(lang, 'retos.premium_cta')}</Text>
                </Pressable>
              </View>
            )}
          </View>
        )
      ) : today && !trainingToday ? (
        <View style={styles.cameraContainer}>
          <View style={styles.restBox}>
            <Text style={styles.restTitle}>{translate(lang, 'retos.rest')}</Text>
            <Text style={styles.cameraDoneText}>{translate(lang, 'retos.rest_note')}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  topSection: {
    paddingHorizontal: spacing.md,
  },
  titleRow: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  title: {
    color: colors.silver,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 1,
  },
  planSmall: {
    color: colors.silverDim,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  weekCell: {
    width: 34,
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekCellTraining: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
  },
  weekCellRest: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
  },
  weekCellToday: {
    borderColor: colors.teal,
  },
  weekCellDone: {
    backgroundColor: colors.teal,
    borderColor: colors.teal,
  },
  weekLabel: {
    color: colors.silver,
    fontSize: 11,
    fontWeight: '700',
  },
  weekLabelToday: {
    color: colors.teal,
  },
  weekLabelDone: {
    color: colors.bg,
  },
  dotDone: {
    position: 'absolute',
    bottom: 3,
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.bg,
  },
  cameraContainer: {
    flex: 1,
  },
  startWrap: {
    flex: 1,
    justifyContent: 'space-between',
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  startCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
  },
  startKicker: {
    color: colors.teal,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  startHead: {
    alignItems: 'baseline',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  startName: {
    color: colors.silver,
    flexShrink: 1,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 1,
  },
  startTarget: {
    color: colors.teal,
    fontSize: 20,
    fontWeight: '800',
  },
  startGuide: {
    color: colors.silverDim,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 21,
    marginTop: spacing.md,
  },
  startBtn: {
    alignItems: 'center',
    backgroundColor: colors.teal,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  startBtnText: {
    color: colors.bg,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 2,
  },
  premiumBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  premiumTitle: {
    color: colors.teal,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 2,
  },
  premiumBody: {
    color: colors.silverDim,
    fontSize: 14,
    lineHeight: 21,
  },
  premiumCta: {
    alignItems: 'center',
    backgroundColor: colors.teal,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.sm,
  },
  premiumCtaText: {
    color: colors.bg,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 2,
  },
  webView: {
    flex: 1,
  },
  doneBox: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  restBox: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  restTitle: {
    color: colors.silver,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: spacing.md,
  },
  cameraDoneText: {
    color: colors.teal,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 1,
    textAlign: 'center',
  },
  cameraCta: {
    backgroundColor: colors.teal,
    borderRadius: radius.pill,
    alignItems: 'center',
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  cameraCtaText: {
    color: colors.bg,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 2,
  },
});

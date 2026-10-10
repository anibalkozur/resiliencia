import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { DeviceMotion } from 'expo-sensors';
import { colors, radius, spacing } from '@resiliencia/design-tokens';
import { usePrefs } from '../../src/prefs/PrefsProvider';
import { useAuth } from '../../src/auth/AuthProvider';
import { getRepo } from '../../src/repo';
import { EXERCISES, REP_CADENCE, exerciseNameKey } from '../../src/retos/catalog';
import { buildVerifyUri } from '../../src/retos/verify';
import { pushFreeSession } from '../../src/retos/freeSessions';
import { todayKey } from '../../src/retos/service';
import { syncAfterLogin } from '../../src/sync/syncService';
import { translate } from '../../src/i18n/translations';
import { hablarVoz } from '../../src/lib/voz';
import { useLibreExercise } from '../../src/header/LibreExerciseProvider';
import { useCameraRestart } from '../../src/retos/useCameraRestart';
import { useScreenFocused } from '../../src/retos/useScreenFocused';
import { usePremium } from '../../src/premium/usePremium';

type Tone = 'ok' | 'bad' | 'plain';

export default function LibreScreen() {
  const { prefs } = usePrefs();
  const { session } = useAuth();
  const lang = prefs?.language ?? 'es';
  const repo = getRepo();
  const { libreExerciseId, libreTarget, setLibreTarget, libreRanked, setLibreRanked } =
    useLibreExercise();
  const premiumActive = usePremium();
  const [sessionOpen, setSessionOpen] = useState(false);
  const [result, setResult] = useState<{ text: string; tone: Tone } | null>(null);
  const restartKey = useCameraRestart();
  const focused = useScreenFocused();

  const freeExercise = EXERCISES.find((e) => e.id === libreExerciseId);
  const freeUnit = freeExercise?.unit ?? 'reps';
  const freeUnitLabel = translate(lang, freeUnit === 'reps' ? 'unit.reps' : 'unit.seconds');
  const isSeconds = freeUnit === 'seconds';
  const targetStep = isSeconds ? 5 : 1;
  const minTarget = isSeconds ? 5 : 1;
  const maxTarget = isSeconds ? 120 : 200;
  const cadence = REP_CADENCE[libreExerciseId] ?? 5;

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
      if (data.type !== 'complete') return;
      const value = Number(data.value ?? data.reps) || 0;
      const ranked = data.ranked === true;
      const seriesOk = data.seriesOk === true;
      const livenessOk = data.livenessOk === true;
      const unitLabel = translate(lang, freeUnit === 'reps' ? 'unit.reps' : 'unit.seconds');
      setSessionOpen(false);
      if (ranked) {
        const eligible = seriesOk && livenessOk && value >= libreTarget;
        setResult({
          tone: eligible ? 'ok' : 'bad',
          text: eligible
            ? translate(lang, 'cam.free_ranked_pending', { n: value, unit: unitLabel })
            : translate(lang, 'cam.free_ranked_bad'),
        });
      } else {
        setResult({
          tone: 'plain',
          text: translate(lang, 'cam.free_done', { n: value, unit: unitLabel }),
        });
      }
      void pushFreeSession(repo, {
        date: todayKey(),
        exerciseId: libreExerciseId,
        value,
        target: libreTarget,
        ranked,
        seriesOk,
        livenessOk,
        evidence:
          typeof data.evidence === 'object' &&
          data.evidence !== null &&
          !Array.isArray(data.evidence)
            ? (data.evidence as Record<string, unknown>)
            : undefined,
      })
        .then(() => {
          if (session) {
            return syncAfterLogin(repo, session.user.id);
          }
        })
        .catch(() => {});
    },
    [repo, lang, freeUnit, libreExerciseId, libreTarget, session],
  );

  const startSession = () => {
    setResult(null);
    // Defensa en profundidad: un ejercicio premium solo corre si el entitlement
    // está activo (usePremium refleja el servidor, fail-closed). Si por estado
    // residual llegara un premium sin entitlement, no dejamos que la sesión se
    // descarte después como premium_required en el server.
    if (freeExercise && freeExercise.tier !== 'free' && !premiumActive) {
      setResult({ tone: 'bad', text: translate(lang, 'header.premium_exercise') });
      return;
    }
    setSessionOpen(true);
  };

  const webviewRef = useRef<any>(null);

  useEffect(() => {
    if (!sessionOpen || !focused) return;
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
  }, [sessionOpen, focused]);

  const resultColor = result?.tone === 'bad' ? colors.ember : colors.teal;

  return (
    <View style={styles.container}>
      <View
        style={[styles.resultBar, result && { borderLeftWidth: 3, borderLeftColor: resultColor }]}
      >
        <Text style={[styles.freeResult, result?.tone === 'bad' && { color: colors.ember }]}>
          {result ? result.text : translate(lang, 'cam.free_hint')}
        </Text>
      </View>

      {!sessionOpen ? (
        <View style={styles.setup}>
          <Text style={styles.exerciseTitle}>
            {translate(lang, exerciseNameKey(libreExerciseId))}
          </Text>
          <Text style={styles.setupLabel}>{translate(lang, 'cam.free_setup_target')}</Text>
          <View style={styles.targetRow}>
            <Pressable
              style={styles.stepBtn}
              onPress={() => setLibreTarget(Math.max(minTarget, libreTarget - targetStep))}
            >
              <Text style={styles.stepBtnText}>−</Text>
            </Pressable>
            <View style={styles.targetBox}>
              <Text style={styles.targetNumber}>{libreTarget}</Text>
              <Text style={styles.targetUnit}>{freeUnitLabel}</Text>
            </View>
            <Pressable
              style={styles.stepBtn}
              onPress={() => setLibreTarget(Math.min(maxTarget, libreTarget + targetStep))}
            >
              <Text style={styles.stepBtnText}>+</Text>
            </Pressable>
          </View>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>{translate(lang, 'cam.free_setup_participate')}</Text>
            <Switch
              value={libreRanked}
              onValueChange={setLibreRanked}
              trackColor={{ true: colors.teal, false: colors.line }}
              thumbColor={libreRanked ? '#ffffff' : colors.silverDim}
            />
          </View>
          {libreRanked ? (
            <>
              <Text style={styles.hint}>{translate(lang, 'cam.free_setup_hint', { cadence })}</Text>
              <Text style={styles.livenessNote}>{translate(lang, 'cam.free_setup_liveness')}</Text>
            </>
          ) : null}
          <Pressable style={styles.startBtn} onPress={startSession}>
            <Text style={styles.startBtnText}>{translate(lang, 'cam.free_setup_start')}</Text>
          </Pressable>
        </View>
      ) : focused ? (
        <View style={styles.cameraContainer}>
          <WebView
            ref={webviewRef}
            key={`${libreExerciseId}-${libreTarget}-${libreRanked ? 'r' : 'f'}-${restartKey}`}
            originWhitelist={['*']}
            source={{
              uri: buildVerifyUri(libreExerciseId, libreTarget, freeUnit, {
                ranked: libreRanked,
                cadenceSec: libreRanked ? cadence : undefined,
              }),
            }}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            allowsInlineMediaPlayback={true}
            mediaPlaybackRequiresUserAction={false}
            onMessage={handleMessage}
            onPermissionRequest={(request: any) => request.grant()}
            style={styles.webView}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  resultBar: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  freeResult: {
    color: colors.silverDim,
    fontSize: 13,
    fontWeight: '600',
  },
  setup: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  exerciseTitle: {
    color: colors.silver,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: spacing.lg,
  },
  setupLabel: {
    color: colors.silverDim,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  targetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  stepBtn: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: {
    color: colors.teal,
    fontSize: 26,
    fontWeight: '800',
    lineHeight: 30,
  },
  targetBox: {
    minWidth: 96,
    alignItems: 'center',
  },
  targetNumber: {
    color: colors.silver,
    fontSize: 44,
    fontWeight: '800',
  },
  targetUnit: {
    color: colors.silverDim,
    fontSize: 13,
    fontWeight: '600',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 320,
    marginBottom: spacing.sm,
  },
  toggleLabel: {
    color: colors.silver,
    fontSize: 15,
    fontWeight: '700',
    flexShrink: 1,
    marginRight: spacing.md,
  },
  hint: {
    color: colors.silverDim,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    marginBottom: spacing.sm,
    maxWidth: 320,
  },
  livenessNote: {
    color: colors.teal,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.lg,
    maxWidth: 320,
  },
  startBtn: {
    backgroundColor: colors.teal,
    borderRadius: radius.pill,
    alignItems: 'center',
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  startBtnText: {
    color: colors.bg,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 2,
  },
  cameraContainer: { flex: 1 },
  webView: { flex: 1 },
});

import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { DeviceMotion } from 'expo-sensors';
import { colors, radius, spacing } from '@resiliencia/design-tokens';
import { usePrefs } from '../../src/prefs/PrefsProvider';
import { useAuth } from '../../src/auth/AuthProvider';
import { getRepo } from '../../src/repo';
import {
  EXERCISES,
  REP_CADENCE,
  DEFAULT_CADENCE_SEC,
  exerciseNameKey,
} from '../../src/retos/catalog';
import { buildVerifyUri } from '../../src/retos/verify';
import { pushFreeSession } from '../../src/retos/freeSessions';
import { todayKey } from '../../src/retos/service';
import { syncAfterLogin } from '../../src/sync/syncService';
import { translate } from '../../src/i18n/translations';
import { hablarVoz } from '../../src/lib/voz';
import { TECNICA } from '../../src/lib/tecnica';
import { useLibreExercise } from '../../src/header/LibreExerciseProvider';
import type { RoutineItem } from '../../src/header/LibreExerciseProvider';
import { useCameraRestart } from '../../src/retos/useCameraRestart';
import { useScreenFocused } from '../../src/retos/useScreenFocused';
import { usePremium } from '../../src/premium/usePremium';

function unitOf(id: string): 'reps' | 'seconds' {
  return EXERCISES.find((e) => e.id === id)?.unit ?? 'reps';
}

export default function LibreScreen() {
  const { prefs } = usePrefs();
  const { session } = useAuth();
  const lang = prefs?.language ?? 'es';
  const repo = getRepo();
  const {
    routine,
    addExercise,
    removeExercise,
    moveExercise,
    setExerciseTarget,
    libreRanked,
    setLibreRanked,
    setLibreActive,
    setSalirHandler,
  } = useLibreExercise();
  const premiumActive = usePremium();
  const [sessionOpen, setSessionOpen] = useState(false);
  const [introOpen, setIntroOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const restartKey = useCameraRestart();
  const focused = useScreenFocused();

  const isMulti = routine.length > 1;
  const first = routine[0];
  const cadence = REP_CADENCE[first?.id ?? ''] ?? DEFAULT_CADENCE_SEC;
  const routineKey = routine.map((it) => `${it.id}:${it.target}`).join(',');
  const canStart = routine.length > 0;
  // setup (armar rutina) → intro (qué hace cada ejercicio) → cámara.
  const stage: 'setup' | 'intro' | 'camera' = sessionOpen
    ? 'camera'
    : introOpen
      ? 'intro'
      : 'setup';

  const instance = (unit: 'reps' | 'seconds') => {
    return {
      isSeconds: unit === 'seconds',
      step: unit === 'seconds' ? 5 : 1,
      min: unit === 'seconds' ? 5 : 1,
      max: unit === 'seconds' ? 120 : 200,
    };
  };

  const startSession = () => {
    // Defensa en profundidad: un ejercicio premium solo corre si el entitlement
    // está activo (usePremium refleja el servidor, fail-closed). Si por estado
    // residual llegara un premium sin entitlement, no dejamos que la sesión se
    // descarte después como premium_required en el server.
    const locked = routine.find((it) => {
      const e = EXERCISES.find((x) => x.id === it.id);
      return e && e.tier !== 'free' && !premiumActive;
    });
    if (locked) {
      Alert.alert(translate(lang, 'header.premium_exercise'));
      return;
    }
    setIntroOpen(true);
  };

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
        setSessionOpen(false);
        return;
      }
      if (data.type === 'repeat') {
        return;
      }
      if (data.type !== 'complete') return;
      // El payload trae el ejercicio completado de la rutina; si no, se infiere
      // por posición (seqIndex) sobre la rutina actual.
      const seqIndex = Math.max(0, Number(data.seqIndex ?? 0) || 0);
      const entry = routine[seqIndex];
      const exerciseId =
        (typeof data.exerciseId === 'string' && data.exerciseId) ||
        entry?.id ||
        routine[0]?.id ||
        'sentadillas';
      const target = entry?.target ?? (Number(data.target) || routine[0]?.target || 10);
      const value = Number(data.value ?? data.reps) || 0;
      const ranked = data.ranked === true;
      const seriesOk = data.seriesOk === true;
      const livenessOk = data.livenessOk === true;
      void pushFreeSession(repo, {
        date: todayKey(),
        exerciseId,
        value,
        target,
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
    [repo, routine, session],
  );

  const webviewRef = useRef<any>(null);

  // El header muestra un botón touch de SALIR mientras la sesión está activa.
  useEffect(() => {
    setLibreActive(sessionOpen && focused);
    return () => setLibreActive(false);
  }, [sessionOpen, focused, setLibreActive]);

  useEffect(() => {
    setSalirHandler(() => setSessionOpen(false));
    return () => setSalirHandler(null);
  }, [setSalirHandler]);

  useEffect(() => {
    if (!sessionOpen || !focused) return;
    let sensorSubscription: { remove: () => void } | null = null;
    let active = true;
    DeviceMotion.isAvailableAsync().then((available) => {
      if (!active) return;
      if (!available) {
        webviewRef.current?.injectJavaScript(
          'window.__resilienciaSetNativeOrientation && window.__resilienciaSetNativeOrientation({ available: false }); true;',
        );
        return;
      }
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

  const ranking = premiumActive && libreRanked;
  const uri = first
    ? isMulti
      ? buildVerifyUri(first.id, first.target, 'reps', {
          seq: routine.map((it) => ({ id: it.id, target: it.target })),
          ranked: ranking,
          cadenceSec: ranking ? cadence : undefined,
        })
      : buildVerifyUri(first.id, first.target, unitOf(first.id), {
          ranked: ranking,
          cadenceSec: ranking ? cadence : undefined,
        })
    : '';

  return (
    <View style={styles.container}>
      {stage === 'setup' ? (
        <View style={styles.setup}>
          <Text style={styles.routineTitle}>
            {translate(lang, 'cam.free_routine', { n: String(routine.length) })}
          </Text>
          {!canStart ? (
            <Text style={styles.hint}>{translate(lang, 'cam.free_setup_empty')}</Text>
          ) : (
            <ScrollView
              style={styles.routineList}
              contentContainerStyle={styles.routineListContent}
              showsVerticalScrollIndicator={false}
            >
              {routine.map((item, index) => {
                const unit = unitOf(item.id);
                const cfg = instance(unit);
                const unitLabel = translate(lang, unit === 'reps' ? 'unit.reps' : 'unit.seconds');
                return (
                  <View key={`${item.id}-${index}`} style={styles.routineItem}>
                    <View style={styles.routineHead}>
                      <Text style={styles.routineIndex}>{index + 1}</Text>
                      <Text style={styles.routineName}>
                        {translate(lang, exerciseNameKey(item.id))}
                      </Text>
                      <View style={styles.routineActions}>
                        <Pressable
                          style={[styles.iconBtn, index === 0 && styles.iconBtnDisabled]}
                          disabled={index === 0}
                          onPress={() => moveExercise(index, -1)}
                          accessibilityRole="button"
                        >
                          <Text style={styles.iconBtnText}>↑</Text>
                        </Pressable>
                        <Pressable
                          style={[
                            styles.iconBtn,
                            index === routine.length - 1 && styles.iconBtnDisabled,
                          ]}
                          disabled={index === routine.length - 1}
                          onPress={() => moveExercise(index, 1)}
                          accessibilityRole="button"
                        >
                          <Text style={styles.iconBtnText}>↓</Text>
                        </Pressable>
                        <Pressable
                          style={[styles.iconBtn, routine.length <= 1 && styles.iconBtnDisabled]}
                          disabled={routine.length <= 1}
                          onPress={() => removeExercise(index)}
                          accessibilityRole="button"
                        >
                          <Text style={styles.iconBtnText}>✕</Text>
                        </Pressable>
                      </View>
                    </View>
                    <View style={styles.targetRow}>
                      <Pressable
                        style={styles.stepBtn}
                        onPress={() =>
                          setExerciseTarget(index, Math.max(cfg.min, item.target - cfg.step))
                        }
                        accessibilityRole="button"
                      >
                        <Text style={styles.stepBtnText}>−</Text>
                      </Pressable>
                      <View style={styles.targetBox}>
                        <Text style={styles.targetNumber}>{item.target}</Text>
                        <Text style={styles.targetUnit}>{unitLabel}</Text>
                      </View>
                      <Pressable
                        style={styles.stepBtn}
                        onPress={() =>
                          setExerciseTarget(index, Math.min(cfg.max, item.target + cfg.step))
                        }
                        accessibilityRole="button"
                      >
                        <Text style={styles.stepBtnText}>+</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          )}
          <Pressable style={styles.addBtn} onPress={() => setAddOpen(true)}>
            <Text style={styles.addBtnText}>{translate(lang, 'cam.free_setup_add')}</Text>
          </Pressable>
          {premiumActive ? (
            <>
              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>
                  {translate(lang, 'cam.free_setup_participate')}
                </Text>
                <Switch
                  value={libreRanked}
                  onValueChange={setLibreRanked}
                  trackColor={{ true: colors.teal, false: colors.line }}
                  thumbColor={libreRanked ? '#ffffff' : colors.silverDim}
                />
              </View>
              {ranking ? (
                <>
                  <Text style={styles.hint}>
                    {translate(lang, 'cam.free_setup_hint', { cadence })}
                  </Text>
                  <Text style={styles.livenessNote}>
                    {translate(lang, 'cam.free_setup_liveness')}
                  </Text>
                </>
              ) : null}
            </>
          ) : null}
          <Pressable
            style={[styles.startBtn, !canStart && styles.startBtnDisabled]}
            disabled={!canStart}
            onPress={startSession}
            accessibilityRole="button"
          >
            <Text style={styles.startBtnText}>{translate(lang, 'cam.free_setup_start')}</Text>
          </Pressable>
          <AddExerciseModal
            open={addOpen}
            onClose={() => setAddOpen(false)}
            onSelect={(id) => {
              addExercise(id);
              setAddOpen(false);
            }}
            premiumActive={premiumActive}
            lang={lang}
            routine={routine}
          />
        </View>
      ) : stage === 'camera' && focused ? (
        <View style={styles.cameraContainer}>
          {uri ? (
            <WebView
              ref={webviewRef}
              key={`${routineKey}-${libreRanked ? 'r' : 'f'}-${restartKey}`}
              originWhitelist={['*']}
              source={{ uri }}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              allowsInlineMediaPlayback={true}
              mediaPlaybackRequiresUserAction={false}
              onMessage={handleMessage}
              onPermissionRequest={(request: any) => request.grant()}
              style={styles.webView}
            />
          ) : null}
        </View>
      ) : stage === 'intro' ? (
        <View style={styles.intro}>
          <ScrollView contentContainerStyle={styles.introList} showsVerticalScrollIndicator={false}>
            <Text style={styles.introTitle}>{translate(lang, 'cam.intro_title')}</Text>
            {routine.map((item, index) => {
              const unit = unitOf(item.id);
              const unitLabel = translate(lang, unit === 'reps' ? 'unit.reps' : 'unit.seconds');
              const guia = TECNICA[item.id]?.guia ?? '';
              return (
                <View key={`${item.id}-${index}`} style={styles.introItem}>
                  <View style={styles.introHead}>
                    <Text style={styles.introIndex}>{index + 1}</Text>
                    <Text style={styles.introName}>
                      {translate(lang, exerciseNameKey(item.id))}
                    </Text>
                    <Text style={styles.introTarget}>
                      {item.target} {unitLabel}
                    </Text>
                  </View>
                  {guia ? <Text style={styles.introGuide}>{guia}</Text> : null}
                </View>
              );
            })}
          </ScrollView>
          <View style={styles.introActions}>
            <Pressable
              style={styles.introBack}
              onPress={() => setIntroOpen(false)}
              accessibilityRole="button"
            >
              <Text style={styles.introBackText}>{translate(lang, 'cam.intro_back')}</Text>
            </Pressable>
            <Pressable
              style={styles.introContinue}
              onPress={() => {
                setIntroOpen(false);
                setSessionOpen(true);
              }}
              accessibilityRole="button"
            >
              <Text style={styles.introContinueText}>{translate(lang, 'cam.intro_continue')}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function AddExerciseModal({
  open,
  onClose,
  onSelect,
  premiumActive,
  lang,
  routine,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (id: string) => void;
  premiumActive: boolean;
  lang: 'es' | 'en' | 'pt';
  routine: RoutineItem[];
}) {
  const inRoutine = (id: string) => routine.some((it) => it.id === id);
  return (
    <Modal transparent visible={open} animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalWrap}>
        <View style={styles.menu}>
          <View style={styles.menuHead}>
            <Text style={styles.menuTitle}>{translate(lang, 'header.pick_exercise')}</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button">
              <Text style={styles.menuClose}>✕</Text>
            </Pressable>
          </View>
          <ScrollView style={styles.menuItems}>
            {EXERCISES.map((e) => {
              const locked = e.tier !== 'free' && !premiumActive;
              const added = inRoutine(e.id);
              return (
                <Pressable
                  key={e.id}
                  disabled={locked || added}
                  style={[
                    styles.menuItem,
                    locked && styles.menuItemLocked,
                    added && styles.menuItemLocked,
                  ]}
                  onPress={() => onSelect(e.id)}
                  accessibilityRole="button"
                >
                  <Text
                    style={[styles.menuItemText, (locked || added) && styles.menuItemTextLocked]}
                  >
                    {locked ? '🔒 ' : ''}
                    {translate(lang, exerciseNameKey(e.id))}
                  </Text>
                  {locked ? (
                    <Text style={styles.menuItemTag}>
                      {translate(lang, 'header.premium_locked')}
                    </Text>
                  ) : added ? (
                    <Text style={styles.menuItemTag}>✓</Text>
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  intro: {
    flex: 1,
  },
  introList: {
    flexGrow: 1,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
  },
  introTitle: {
    color: colors.silver,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: spacing.md,
  },
  introItem: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  introHead: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  introIndex: {
    backgroundColor: colors.teal,
    borderRadius: radius.sm,
    color: colors.bg,
    fontSize: 13,
    fontWeight: '800',
    overflow: 'hidden',
    textAlign: 'center',
    width: 22,
  },
  introName: {
    color: colors.silver,
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '800',
  },
  introTarget: {
    color: colors.teal,
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 'auto',
  },
  introGuide: {
    color: colors.silverDim,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
    marginTop: spacing.sm,
  },
  introActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
  },
  introBack: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  introBackText: {
    color: colors.silver,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
  },
  introContinue: {
    alignItems: 'center',
    backgroundColor: colors.teal,
    borderRadius: radius.pill,
    flex: 1,
    justifyContent: 'center',
    paddingVertical: spacing.md,
  },
  introContinueText: {
    color: colors.bg,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 2,
  },
  setup: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
  },
  routineTitle: {
    color: colors.silver,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: spacing.md,
    textTransform: 'uppercase',
  },
  routineList: {
    alignSelf: 'stretch',
    flexShrink: 1,
  },
  routineListContent: {
    gap: spacing.sm,
  },
  routineItem: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.sm,
  },
  routineHead: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  routineIndex: {
    color: colors.teal,
    fontSize: 15,
    fontWeight: '800',
    marginRight: spacing.sm,
  },
  routineName: {
    color: colors.silver,
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    flexShrink: 1,
  },
  routineActions: {
    flexDirection: 'row',
    gap: 6,
  },
  iconBtn: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnDisabled: {
    opacity: 0.35,
  },
  iconBtnText: {
    color: colors.teal,
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 18,
  },
  targetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  stepBtn: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    width: 44,
    height: 44,
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
    minWidth: 92,
    alignItems: 'center',
  },
  targetNumber: {
    color: colors.silver,
    fontSize: 40,
    fontWeight: '800',
  },
  targetUnit: {
    color: colors.silverDim,
    fontSize: 13,
    fontWeight: '600',
  },
  addBtn: {
    alignSelf: 'stretch',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: radius.md,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
  },
  addBtnText: {
    color: colors.teal,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 1,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 320,
    marginTop: spacing.md,
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
    marginTop: spacing.sm,
    maxWidth: 320,
  },
  livenessNote: {
    color: colors.teal,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: spacing.sm,
    maxWidth: 320,
  },
  startBtn: {
    backgroundColor: colors.teal,
    borderRadius: radius.pill,
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  startBtnDisabled: {
    opacity: 0.5,
  },
  startBtnText: {
    color: colors.bg,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 2,
  },
  cameraContainer: { flex: 1 },
  webView: { flex: 1 },
  modalWrap: {
    alignItems: 'center',
  },
  menu: {
    alignSelf: 'stretch',
    backgroundColor: colors.surface,
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
    maxHeight: '70%',
  },
  menuHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
  },
  menuClose: {
    color: colors.silverDim,
    fontSize: 18,
    fontWeight: '800',
  },
  menuTitle: {
    color: colors.silverDim,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  menuItems: {
    flexShrink: 1,
  },
  menuItem: {
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  menuItemLocked: {
    opacity: 0.55,
  },
  menuItemText: {
    color: colors.silver,
    fontSize: 15,
    fontWeight: '600',
    flexShrink: 1,
  },
  menuItemTextLocked: {
    color: colors.silverDim,
    fontWeight: '600',
  },
  menuItemTag: {
    color: colors.teal,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});

import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
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
  exerciseDescKey,
} from '../../src/retos/catalog';
import { buildVerifyUri } from '../../src/retos/verify';
import { pushFreeSession } from '../../src/retos/freeSessions';
import { todayKey } from '../../src/retos/service';
import { syncAfterLogin } from '../../src/sync/syncService';
import { translate } from '../../src/i18n/translations';
import { hablarVoz } from '../../src/lib/voz';
import { TECNICA } from '../../src/lib/tecnica';
import { useLibreExercise } from '../../src/header/LibreExerciseProvider';
import { useCameraRestart } from '../../src/retos/useCameraRestart';
import { useScreenFocused } from '../../src/retos/useScreenFocused';
import { usePremium } from '../../src/premium/usePremium';
import { useUser } from '../../src/user/UserProvider';
import { exerciseArt } from '../../src/retos/exerciseArt';

function unitOf(id: string): 'reps' | 'seconds' {
  return EXERCISES.find((e) => e.id === id)?.unit ?? 'reps';
}

type Zone = 'all' | 'upper' | 'middle' | 'lower';

const EXERCISE_ZONES: Record<string, Exclude<Zone, 'all'>> = {
  flexiones: 'upper',
  fondos_silla: 'upper',
  abdominales: 'middle',
  plancha: 'middle',
  mountain_climbers: 'middle',
  sentadillas: 'lower',
  zancadas: 'lower',
  puente_gluteo: 'lower',
  sentadilla_isometrica: 'lower',
};

export default function LibreScreen() {
  const { prefs } = usePrefs();
  const { session } = useAuth();
  const { profile } = useUser();
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
  const visualModel = profile?.visualModel ?? 'mujer';
  const [sessionOpen, setSessionOpen] = useState(false);
  const [introOpen, setIntroOpen] = useState(false);
  const [zoneFilter, setZoneFilter] = useState<Zone>('all');
  const restartKey = useCameraRestart();
  const focused = useScreenFocused();

  const isMulti = routine.length > 1;
  const first = routine[0];
  const cadence = REP_CADENCE[first?.id ?? ''] ?? DEFAULT_CADENCE_SEC;
  const routineKey = routine.map((it) => `${it.id}:${it.target}`).join(',');
  const canStart = routine.length > 0;
  const visibleExercises = EXERCISES.filter(
    (exercise) => zoneFilter === 'all' || EXERCISE_ZONES[exercise.id] === zoneFilter,
  );
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

  const ranking = !isMulti && premiumActive && libreRanked;
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
          <ScrollView
            style={styles.setupScroll}
            contentContainerStyle={styles.setupContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.heroCard}>
              <View style={styles.heroAccent} />
              <Text style={styles.heroEyebrow}>{translate(lang, 'cam.free_eyebrow')}</Text>
              <Text style={styles.heroTitle}>{translate(lang, 'cam.free_setup_title')}</Text>
              <Text style={styles.heroBody}>{translate(lang, 'cam.free_setup_subtitle')}</Text>
              <View style={styles.heroStats}>
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatValue}>{routine.length}</Text>
                  <Text style={styles.heroStatLabel}>
                    {translate(lang, 'cam.free_setup_count')}
                  </Text>
                </View>
                <View style={styles.heroStatDivider} />
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatValue}>
                    {translate(lang, ranking ? 'cam.free_setup_on' : 'cam.free_setup_off')}
                  </Text>
                  <Text style={styles.heroStatLabel}>
                    {translate(lang, 'cam.free_setup_ranking')}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionEyebrow}>
                  {translate(lang, 'cam.free_setup_routine')}
                </Text>
                <Text style={styles.sectionHint}>
                  {translate(lang, 'cam.free_setup_edit_hint')}
                </Text>
              </View>
              <Text style={styles.sectionCount}>
                {routine.length}/{EXERCISES.length}
              </Text>
            </View>

            {!canStart ? (
              <View style={styles.emptyRoutine}>
                <Text style={styles.emptyRoutineTitle}>
                  {translate(lang, 'cam.free_setup_empty')}
                </Text>
              </View>
            ) : (
              <View style={styles.routineList}>
                {routine.map((item, index) => {
                  const unit = unitOf(item.id);
                  const cfg = instance(unit);
                  const unitLabel = translate(lang, unit === 'reps' ? 'unit.reps' : 'unit.seconds');
                  return (
                    <View key={`${item.id}-${index}`} style={styles.routineItem}>
                      <View style={styles.routineHead}>
                        <View style={styles.routineIndex}>
                          <Text style={styles.routineIndexText}>{index + 1}</Text>
                        </View>
                        <View style={styles.routineNameWrap}>
                          <Text style={styles.routineName}>
                            {translate(lang, exerciseNameKey(item.id))}
                          </Text>
                          <Text style={styles.routineDesc}>
                            {translate(lang, exerciseDescKey(item.id))}
                          </Text>
                        </View>
                        <View style={styles.routineActions}>
                          <Pressable
                            style={[styles.iconBtn, index === 0 && styles.iconBtnDisabled]}
                            disabled={index === 0}
                            onPress={() => moveExercise(index, -1)}
                            accessibilityRole="button"
                            accessibilityLabel={translate(lang, 'cam.free_move_up')}
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
                            accessibilityLabel={translate(lang, 'cam.free_move_down')}
                          >
                            <Text style={styles.iconBtnText}>↓</Text>
                          </Pressable>
                          <Pressable
                            style={[styles.iconBtn, routine.length <= 1 && styles.iconBtnDisabled]}
                            disabled={routine.length <= 1}
                            onPress={() => removeExercise(index)}
                            accessibilityRole="button"
                            accessibilityLabel={translate(lang, 'cam.free_remove')}
                          >
                            <Text style={styles.removeBtnText}>×</Text>
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
                          accessibilityLabel={translate(lang, 'cam.free_decrease')}
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
                          accessibilityLabel={translate(lang, 'cam.free_increase')}
                        >
                          <Text style={styles.stepBtnText}>+</Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            <View style={styles.libraryHeader}>
              <View>
                <Text style={styles.sectionEyebrow}>
                  {translate(lang, 'cam.free_setup_library')}
                </Text>
                <Text style={styles.sectionHint}>
                  {translate(lang, 'cam.free_setup_library_hint')}
                </Text>
              </View>
              <Text style={styles.libraryTotal}>{EXERCISES.length}</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.zoneFilters}
            >
              {(['all', 'upper', 'middle', 'lower'] as Zone[]).map((zone) => (
                <Pressable
                  key={zone}
                  style={[styles.zoneFilter, zoneFilter === zone && styles.zoneFilterActive]}
                  onPress={() => setZoneFilter(zone)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: zoneFilter === zone }}
                >
                  <Text
                    style={[
                      styles.zoneFilterText,
                      zoneFilter === zone && styles.zoneFilterTextActive,
                    ]}
                  >
                    {translate(
                      lang,
                      `cam.zone_${zone}` as
                        'cam.zone_all' | 'cam.zone_upper' | 'cam.zone_middle' | 'cam.zone_lower',
                    )}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <View style={styles.libraryGrid}>
              {visibleExercises.map((exercise) => {
                const locked = exercise.tier !== 'free' && !premiumActive;
                const added = routine.some((item) => item.id === exercise.id);
                return (
                  <Pressable
                    key={exercise.id}
                    disabled={locked || added}
                    style={[
                      styles.exerciseCard,
                      locked && styles.exerciseCardLocked,
                      added && styles.exerciseCardAdded,
                    ]}
                    onPress={() => addExercise(exercise.id)}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: locked || added, selected: added }}
                  >
                    <View style={styles.exerciseCardImageFrame}>
                      <Image
                        source={exerciseArt(exercise.id, visualModel)}
                        style={styles.exerciseCardImage}
                        resizeMode="contain"
                        accessibilityLabel={translate(lang, exerciseNameKey(exercise.id))}
                      />
                    </View>
                    <View style={styles.exerciseCardTop}>
                      <View
                        style={[
                          styles.zoneDot,
                          { backgroundColor: zoneColor(EXERCISE_ZONES[exercise.id]) },
                        ]}
                      />
                      <Text style={styles.exerciseCardZone}>
                        {translate(
                          lang,
                          `cam.zone_${EXERCISE_ZONES[exercise.id]}` as
                            'cam.zone_upper' | 'cam.zone_middle' | 'cam.zone_lower',
                        )}
                      </Text>
                      {exercise.tier === 'premium' ? (
                        <Text style={styles.premiumTag}>
                          {translate(lang, 'header.premium_locked')}
                        </Text>
                      ) : null}
                    </View>
                    <Text
                      style={[styles.exerciseCardName, locked && styles.exerciseCardTextLocked]}
                    >
                      {translate(lang, exerciseNameKey(exercise.id))}
                    </Text>
                    <Text style={styles.exerciseCardDesc}>
                      {translate(lang, exerciseDescKey(exercise.id))}
                    </Text>
                    <View style={styles.exerciseCardFooter}>
                      <Text style={styles.exerciseCardUnit}>
                        {translate(lang, exercise.unit === 'reps' ? 'unit.reps' : 'unit.seconds')}
                      </Text>
                      <Text
                        style={[
                          styles.exerciseCardAction,
                          (locked || added) && styles.exerciseCardTextLocked,
                        ]}
                      >
                        {locked ? translate(lang, 'header.premium_locked') : added ? '✓' : '+'}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {premiumActive ? (
              <>
                <View style={styles.toggleRow}>
                  <Text style={styles.toggleLabel}>
                    {isMulti
                      ? translate(lang, 'cam.free_setup_ranking_single')
                      : translate(lang, 'cam.free_setup_participate')}
                  </Text>
                  <Switch
                    value={!isMulti && libreRanked}
                    onValueChange={setLibreRanked}
                    disabled={isMulti}
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
          </ScrollView>
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

function zoneColor(zone: Exclude<Zone, 'all'> | undefined): string {
  if (zone === 'upper') return colors.cyan;
  if (zone === 'middle') return colors.blue;
  return colors.teal;
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
  setup: { flex: 1, paddingHorizontal: spacing.md },
  setupScroll: { flex: 1 },
  setupContent: { paddingBottom: spacing.xl, paddingTop: spacing.md },
  heroCard: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    padding: spacing.lg,
  },
  heroAccent: {
    backgroundColor: colors.teal,
    height: 3,
    left: spacing.lg,
    position: 'absolute',
    right: spacing.lg,
    top: 0,
  },
  heroEyebrow: {
    color: colors.teal,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
  },
  heroTitle: { color: colors.silver, fontSize: 27, fontWeight: '900', letterSpacing: -0.5 },
  heroBody: {
    color: colors.silverDim,
    fontSize: 13,
    lineHeight: 19,
    marginTop: spacing.xs,
    maxWidth: 300,
  },
  heroStats: { alignItems: 'center', flexDirection: 'row', marginTop: spacing.lg },
  heroStat: { minWidth: 78 },
  heroStatValue: { color: colors.silver, fontSize: 18, fontWeight: '900' },
  heroStatLabel: {
    color: colors.silverDim,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  heroStatDivider: {
    backgroundColor: colors.line,
    height: 30,
    marginHorizontal: spacing.md,
    width: 1,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  sectionEyebrow: {
    color: colors.silver,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  sectionHint: { color: colors.silverDim, fontSize: 11, marginTop: 3 },
  sectionCount: { color: colors.teal, fontSize: 13, fontWeight: '900' },
  routineTitle: {
    color: colors.silver,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: spacing.md,
    textTransform: 'uppercase',
  },
  routineList: { gap: spacing.sm },
  routineNameWrap: { flex: 1, flexShrink: 1 },
  routineDesc: { color: colors.silverDim, fontSize: 11, marginTop: 2 },
  routineItem: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
  },
  routineHead: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  routineIndex: {
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderColor: colors.teal,
    borderRadius: radius.sm,
    borderWidth: 1,
    height: 28,
    justifyContent: 'center',
    marginRight: spacing.sm,
    width: 28,
  },
  routineIndexText: {
    color: colors.teal,
    fontSize: 13,
    fontWeight: '900',
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
  removeBtnText: { color: colors.ember, fontSize: 22, fontWeight: '500', lineHeight: 22 },
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
  emptyRoutine: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.lg,
  },
  emptyRoutineTitle: { color: colors.silverDim, fontSize: 13, textAlign: 'center' },
  libraryHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  libraryTotal: { color: colors.silverDim, fontSize: 12, fontWeight: '800' },
  zoneFilters: { gap: spacing.sm, paddingBottom: spacing.sm },
  zoneFilter: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  zoneFilterActive: { backgroundColor: colors.teal, borderColor: colors.teal },
  zoneFilterText: { color: colors.silverDim, fontSize: 12, fontWeight: '800' },
  zoneFilterTextActive: { color: colors.bg },
  libraryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  exerciseCard: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radius.md,
    borderWidth: 1,
    minHeight: 252,
    overflow: 'hidden',
    padding: spacing.md,
    width: '48%',
  },
  exerciseCardLocked: { opacity: 0.52 },
  exerciseCardAdded: { borderColor: colors.teal },
  exerciseCardTop: { alignItems: 'center', flexDirection: 'row', minHeight: 18 },
  exerciseCardImageFrame: {
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    height: 106,
    justifyContent: 'center',
    marginBottom: spacing.sm,
    overflow: 'hidden',
    width: '100%',
  },
  exerciseCardImage: { height: '100%', width: '100%' },
  zoneDot: { borderRadius: radius.pill, height: 7, marginRight: spacing.xs, width: 7 },
  exerciseCardZone: {
    color: colors.silverDim,
    flex: 1,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  premiumTag: { color: colors.ember, fontSize: 8, fontWeight: '900', letterSpacing: 0.4 },
  exerciseCardName: {
    color: colors.silver,
    fontSize: 14,
    fontWeight: '900',
    marginTop: spacing.md,
  },
  exerciseCardTextLocked: { color: colors.silverDim },
  exerciseCardDesc: { color: colors.silverDim, fontSize: 11, marginTop: 3 },
  exerciseCardFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 'auto',
    paddingTop: spacing.sm,
  },
  exerciseCardUnit: { color: colors.silverDim, fontSize: 10 },
  exerciseCardAction: { color: colors.teal, fontSize: 21, fontWeight: '500', lineHeight: 21 },
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
});

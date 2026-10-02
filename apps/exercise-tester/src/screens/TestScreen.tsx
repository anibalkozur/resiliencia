import { useCameraPermissions } from 'expo-camera';
import { Accelerometer, type AccelerometerMeasurement } from 'expo-sensors';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

import type { ExerciseConfig } from '../lib/exercises';
import { needsCalibration } from '../lib/exercises';
import { handStreak, livenessDue, livenessRequired, scheduleLiveness } from '../lib/liveness';
import {
  FRONTAL_POINTS,
  SIDE_IDX,
  angleByNames,
  attemptCalibration,
  bilateralKnee,
  checkComplete,
  groundedRatio,
  kneeStandingMargin,
  lateralPoints,
  lineAngle,
  resolveSide,
  torsoHorizontalAngle,
  type Pt,
  type SideKey,
} from '../lib/pose';
import { POSE_BRIDGE_BASE_URL, POSE_VIEW_HTML, type Landmark } from '../lib/poseWorker';
import {
  initEngine,
  postureGate,
  processFrame,
  type Gate,
  type RepEngineState,
  type RepTelemetry,
} from '../lib/repEngine';
import { summarizeExercise, type TestResult } from '../lib/report';
import {
  SENSOR_UPDATE_INTERVAL_MS,
  confirmProgress,
  initialTiltState,
  isVertical,
  pushSample,
  tiltDeg,
  type AccelSample,
  type TiltState,
} from '../lib/tilt';

type LogLine = { id: number; text: string; kind: 'info' | 'ok' | 'warn' };

type Session = {
  engine: RepEngineState | null;
  telemetry: RepTelemetry[];
  calibBuf: number[];
  sideBuf: number[];
  handStreak: number;
  startedAt: number;
  liveness: { active: boolean; passed: boolean; holdMs: number; scheduledAt: number | null };
  accel: AccelSample;
  evidence: { rep: number; uri: string; at: number }[];
  /** Lado confirmado en perfil lateral, para dibujar y medir el mismo lado. */
  useRight: boolean;
};

function newSession(cfg: ExerciseConfig, accel: AccelSample): Session {
  return {
    engine: initEngine(cfg),
    telemetry: [],
    calibBuf: [],
    sideBuf: [],
    handStreak: 0,
    startedAt: Date.now(),
    liveness: { active: false, passed: false, holdMs: 0, scheduledAt: null },
    accel,
    evidence: [],
    useRight: false,
  };
}

type Props = {
  exercise: ExerciseConfig | null;
  exerciseId: string;
  onExit: () => void;
  onFinish: (r: TestResult) => void;
};

export function TestScreen({ exercise: cfg, exerciseId, onExit, onFinish }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<'front' | 'back'>('front');
  const [running, setRunning] = useState(false);
  const [reps, setReps] = useState(0);
  const [holdMs, setHoldMs] = useState(0);
  const [gate, setGate] = useState<Gate>('landmarks');
  const [message, setMessage] = useState('Presioná Iniciar');
  const [angle, setAngle] = useState(0);
  const [tilt, setTilt] = useState<TiltState>(initialTiltState());
  const [backend, setBackend] = useState<string | null>(null);
  const [poseState, setPoseState] = useState('cargando MediaPipe…');
  const [calibInfo, setCalibInfo] = useState('sin calibrar');
  const [livenessUi, setLivenessUi] = useState({
    active: false,
    passed: false,
    holdMs: 0,
    type: 'hand' as 'hand' | 'hold',
  });
  const [logs, setLogs] = useState<LogLine[]>([]);

  const webRef = useRef<WebView<object>>(null);
  const sessionRef = useRef<Session | null>(null);
  const logIdRef = useRef(0);
  // El engine corre a la frecuencia del video (~30 fps, igual que producción),
  // pero los setState de UI se agrupan: 30 renders por segundo del árbol entero
  // en el hilo de JS de React Native sí se sienten.
  const uiRef = useRef<{ t: number }>({ t: 0 });

  const required = cfg ? livenessRequired(cfg) : false;

  const log = useCallback((text: string, kind: LogLine['kind'] = 'info') => {
    setLogs((prev) => [{ id: ++logIdRef.current, text, kind }, ...prev].slice(0, 40));
  }, []);

  /** Puntos a resaltar en el canvas, como los `pts` de producción (HTML:1705-1706). */
  const highlightFor = useCallback(
    (side: SideKey): { title: string; pts: number[] } => {
      if (!cfg) return { title: 'Cuerpo', pts: [...FRONTAL_POINTS] };
      if (cfg.side === 'frontal') return { title: 'Cuerpo', pts: [...FRONTAL_POINTS] };
      return { title: cfg.name, pts: lateralPoints(cfg, side) };
    },
    [cfg],
  );

  const pushHighlight = useCallback(
    (side: SideKey) => {
      const h = highlightFor(side);
      webRef.current?.injectJavaScript(
        `window.__setHighlight(${JSON.stringify(h.title)}, ${JSON.stringify(h.pts)}); true;`,
      );
    },
    [highlightFor],
  );

  useEffect(() => {
    Accelerometer.setUpdateInterval(SENSOR_UPDATE_INTERVAL_MS);
    const sub = Accelerometer.addListener((m: AccelerometerMeasurement) => {
      const sample: AccelSample = { x: m.x, y: m.y, z: m.z };
      if (sessionRef.current) sessionRef.current.accel = sample;
      setTilt((prev) => pushSample(prev, sample, Date.now()));
      // Puente de orientación de producción (HTML:1896-1904): la app lee el
      // sensor y lo inyecta al WebView.
      webRef.current?.injectJavaScript(
        `window.__resilienciaSetNativeOrientation(${JSON.stringify({
          available: true,
          vertical: isVertical(sample),
          beta: tiltDeg(sample),
        })}); true;`,
      );
    });
    return () => sub.remove();
  }, []);

  // Si MediaPipe no announces "ready" en 45 s no va a hacerlo: el WASM y el
  // modelo se quedan colgados sin internet y la pantalla queda en blanco.
  useEffect(() => {
    if (poseState === 'pose lista' || poseState.startsWith('error')) return;
    const t = setTimeout(() => {
      setPoseState('error al cargar');
      log(
        `MediaPipe no cargó en 45 s (${poseState}). Revisá la conexión: el WASM y el modelo vienen de cdn.jsdelivr.net y storage.googleapis.com.`,
        'warn',
      );
    }, 45_000);
    return () => clearTimeout(t);
  }, [poseState, log]);

  const handleFrame = useCallback(
    (lms: Landmark[], now: number) => {
      const s = sessionRef.current;
      if (!cfg || !s || !s.engine) return;
      const pts = lms as Pt[];

      // Lado visible (solo perfil lateral): 15 muestras, ≥6 votos
      let sideOk = true;
      let useRight = false;
      if (cfg.side === 'lateral') {
        const res = resolveSide(pts);
        s.sideBuf = [...s.sideBuf, ...res.buffer].slice(-15);
        const maxV = Math.max(...s.sideBuf);
        const winners = s.sideBuf.filter((v) => v >= 0.4 && v === maxV).length;
        sideOk = winners >= 6;
        useRight = maxV > 0 && s.sideBuf[s.sideBuf.length - 1]! < s.sideBuf[s.sideBuf.length - 2]!;
        if (useRight !== s.useRight) {
          s.useRight = useRight;
          pushHighlight(useRight ? 'back' : 'front');
        }
      }
      const idx: (typeof SIDE_IDX)[SideKey] = useRight ? SIDE_IDX.back : SIDE_IDX.front;

      // Mismos puntos que `sides[].points` del prototipo
      const needed =
        cfg.side === 'frontal'
          ? [...FRONTAL_POINTS]
          : lateralPoints(cfg, useRight ? 'back' : 'front');
      const bodyOk = checkComplete(pts, needed);

      // Métrica del ejercicio: el triángulo viene de la config (`sides[].angle` o
      // `knee` del prototipo), no de un if por ejercicio.
      let rawAngle = 0;
      let secondAngle: number | undefined;
      let notGrounded = true;
      let notStanding = true;
      let lineOk = true;

      if (cfg.side === 'frontal') {
        const knees = bilateralKnee(pts);
        rawAngle = knees.left;
        secondAngle = knees.right;
      } else {
        if (cfg.lineMin !== undefined) {
          lineOk = lineAngle(pts, idx.shoulder, idx.hip, idx.ankle) >= cfg.lineMin;
        }
        if (cfg.groundedMax !== undefined) {
          notGrounded = !(groundedRatio(pts, idx.hip, idx.ankle) > cfg.groundedMax);
        }
        if (cfg.standingKneeMargin !== undefined) {
          notStanding = !(kneeStandingMargin(pts, idx.hip, idx.knee) > cfg.standingKneeMargin);
        }
        // mountain_climbers cuenta por pliegue de rodilla, no por el ángulo del
        // ejercicio (camera-verification.html:1591-1618)
        rawAngle = cfg.knee
          ? angleByNames(pts, cfg.knee, useRight ? 'back' : 'front')
          : cfg.angle
            ? angleByNames(pts, cfg.angle, useRight ? 'back' : 'front')
            : 0;
      }

      // Calibración de reposo: el gate de torso usa `restTorsoMax`, pero el
      // ángulo que se calibra es la MÉTRICA del ejercicio (codo / cadera), no
      // el torso. Ver camera-verification.html:1642 (calibra `smoothed`).
      let calibDone = true;
      if (needsCalibration(cfg)) {
        const torso = torsoHorizontalAngle(pts, idx.shoulder, idx.hip);
        const inRest = cfg.restTorsoMax === undefined ? true : torso <= cfg.restTorsoMax;
        if (!inRest) {
          s.calibBuf = [];
          s.engine = { ...s.engine, restAngle: null };
          setCalibInfo('posición de reposo no válida');
        } else {
          const { buf, calib } = attemptCalibration(rawAngle, s.calibBuf, cfg);
          s.calibBuf = buf;
          if (calib) {
            s.engine = {
              ...s.engine,
              restAngle: calib.restAngle,
              down: calib.down,
              up: calib.up,
            };
            setCalibInfo(`calibrado ${calib.restAngle.toFixed(1)}°`);
            log(
              `calibración reposo ${calib.restAngle.toFixed(1)}° → down ${calib.down.toFixed(1)} up ${calib.up.toFixed(1)}`,
              'ok',
            );
          }
        }
        calibDone = s.engine.restAngle !== null;
      }

      const inputAngle = rawAngle;

      const g = postureGate(cfg, {
        sideOk,
        bodyOk,
        notGroundedTooMuch: notGrounded,
        notStanding,
        lineOk,
        verticalOk: isVertical(s.accel),
      });

      // Prueba de vida (disparo único aleatorio 4-13 s)
      const sched = scheduleLiveness(
        { scheduledAt: s.liveness.scheduledAt, passed: s.liveness.passed },
        now,
      );
      s.liveness.scheduledAt = sched.scheduledAt;
      if (
        required &&
        !s.liveness.active &&
        livenessDue({ scheduledAt: s.liveness.scheduledAt, passed: s.liveness.passed }, now)
      ) {
        s.liveness.active = true;
        log(`prueba de vida ${cfg.liveness} activada`, 'warn');
      }
      s.handStreak = handStreak(s.handStreak, s.liveness.active, pts);
      if (cfg.liveness === 'hand' && s.handStreak >= 5 && !s.liveness.passed) {
        s.liveness.passed = true;
        log('prueba de vida confirmada (mano)', 'ok');
      }

      const out = processFrame(
        cfg,
        s.engine,
        {
          angle: inputAngle,
          bodyOk,
          sideOk,
          lineOk,
          notGroundedTooMuch: notGrounded,
          notStanding,
          calibDone,
          now,
          livenessActive: s.liveness.active,
          livenessDownThresh: s.engine.down,
          secondAngle,
        },
        g,
      );

      s.engine = out.state;
      s.liveness.passed = out.livenessPassed;
      s.liveness.holdMs = out.livenessHoldMs;

      if (out.completedRep) {
        s.telemetry.push(out.completedRep);
        log(
          `rep ${out.completedRep.index}: ${out.completedRep.amplitude.toFixed(0)}° en ${Math.round(out.completedRep.durationMs)}ms`,
          'ok',
        );
        webRef.current?.injectJavaScript('window.__snap(); true;');
      }

      // El engine ya corrió con este cuadro; la UI se refresca a ~12 fps.
      if (now - uiRef.current.t > 80) {
        uiRef.current.t = now;
        setReps(out.result.reps);
        setHoldMs(out.result.holdMs);
        setGate(out.result.gate);
        setMessage(out.result.message);
        setAngle(inputAngle);
        setLivenessUi({
          active: s.liveness.active,
          passed: s.liveness.passed,
          holdMs: s.liveness.holdMs,
          type: cfg.liveness,
        });
      }
    },
    [cfg, log, pushHighlight, required],
  );

  const onWebMessage = useCallback(
    (event: { nativeEvent: { data: string } }) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(event.nativeEvent.data) as Record<string, unknown>;
      } catch {
        return;
      }
      const type = String(msg['type'] ?? '');

      if (type === 'stage') {
        const s = String(msg['stage'] ?? '');
        setPoseState(
          s === 'script'
            ? 'bajando MediaPipe…'
            : s === 'modelo'
              ? 'bajando modelo…'
              : s === 'wasm'
                ? 'cargando WASM…'
                : s === 'camara'
                  ? 'pidiendo cámara…'
                  : s,
        );
        return;
      }
      if (type === 'log') {
        log(String(msg['text'] ?? ''));
        return;
      }
      if (type === 'orientation') {
        return;
      }
      if (type === 'sensor_request') {
        return;
      }
      if (type === 'ready') {
        setBackend(String(msg['backend'] ?? '?'));
        setPoseState('pose lista');
        log(`pose lista (${String(msg['backend'] ?? '?')})`, 'ok');
        return;
      }
      if (type === 'running') {
        setPoseState('pose lista');
        return;
      }
      if (type === 'fatal') {
        setPoseState(`error: ${String(msg['error'] ?? '?')}`);
        log(`pose: ${String(msg['error'] ?? '?')}`, 'warn');
        return;
      }
      if (type === 'snap') {
        const s = sessionRef.current;
        const uri = String(msg['uri'] ?? '');
        if (s && uri.startsWith('data:image')) {
          s.evidence.push({ rep: s.telemetry.length, uri, at: Date.now() });
        }
        return;
      }
      if (type === 'pose') {
        const flat = (msg['flat'] as number[] | undefined) ?? [];
        if (!running || !cfg) return;
        if (flat.length === 0) {
          uiRef.current.t = Number(msg['t'] ?? 0);
          return;
        }
        const lms: Landmark[] = [];
        for (let i = 0; i + 3 < flat.length; i += 4) {
          lms.push({ x: flat[i]!, y: flat[i + 1]!, z: flat[i + 2]!, visibility: flat[i + 3]! });
        }
        handleFrame(lms, Number(msg['t'] ?? Date.now()));
        return;
      }
    },
    [cfg, log, running, handleFrame],
  );
  const start = useCallback(() => {
    if (!cfg) return;
    const accel = sessionRef.current?.accel ?? { x: 0, y: 1, z: 0 };
    sessionRef.current = newSession(cfg, accel);
    uiRef.current.t = 0;
    setReps(0);
    setHoldMs(0);
    setCalibInfo('sin calibrar');
    setLivenessUi({ active: false, passed: false, holdMs: 0, type: cfg.liveness });
    setLogs([]);
    pushHighlight('front');
    setRunning(true);
    webRef.current?.injectJavaScript('window.__start(); true;');
    log(`sesión iniciada: ${cfg.name}, objetivo ${cfg.target}`);
  }, [cfg, log, pushHighlight]);

  const finish = useCallback(() => {
    if (!cfg) return;
    setRunning(false);
    webRef.current?.injectJavaScript('window.__stop(); true;');
    const s = sessionRef.current;
    const result = summarizeExercise(cfg, {
      reps: s?.engine?.reps ?? 0,
      holdMs: s?.engine?.holdMs ?? 0,
      restAngle: s?.engine?.restAngle ?? null,
      livenessRequired: required,
      livenessPassed: s?.liveness.passed ?? false,
      telemetry: s?.telemetry ?? [],
      finalMetrics: {
        down: s?.engine?.down ?? 0,
        up: s?.engine?.up ?? 0,
        tilt: tiltDeg(s?.accel ?? { x: 0, y: 1, z: 0 }),
      },
      finishedAt: Date.now(),
    });
    log(`informe: ${result.summary}`, result.reached ? 'ok' : 'warn');
    onFinish(result);
  }, [cfg, onFinish, required, log]);

  const flip = useCallback(() => {
    const next = facing === 'front' ? 'back' : 'front';
    setFacing(next);
    webRef.current?.injectJavaScript(`window.__facing(${JSON.stringify(next)}); true;`);
  }, [facing]);

  const gateColor = useMemo(() => {
    if (gate === 'ok') return '#39D98A';
    if (gate === 'calibrando' || gate === 'landmarks') return '#F4C542';
    return '#FF6B6B';
  }, [gate]);

  if (!cfg) {
    return (
      <View style={styles.box}>
        <Text style={styles.msg}>Ejercicio desconocido: {exerciseId}</Text>
        <Pressable style={styles.btn} onPress={onExit}>
          <Text style={styles.btnText}>Volver</Text>
        </Pressable>
      </View>
    );
  }

  if (!permission) return <View style={styles.box} />;

  if (!permission.granted) {
    return (
      <View style={styles.box}>
        <Text style={styles.msg}>
          El banco de pruebas necesita la cámara para seguir tus movimientos.
        </Text>
        <Pressable style={styles.btn} onPress={requestPermission}>
          <Text style={styles.btnText}>Dar permiso</Text>
        </Pressable>
      </View>
    );
  }

  const value =
    cfg.kind === 'isometrico'
      ? `${Math.round(holdMs / 1000)}s / ${cfg.target}s`
      : `${reps} / ${cfg.target}`;

  return (
    <ScrollView style={styles.wrap} contentContainerStyle={styles.scrollContent}>
      {/* La caja de la cámara replica .video-wrap (HTML:66-74): relación 3/4.
          El WebView ES la vista de cámara, igual que el <video> del prototipo. */}
      <View style={styles.camStack}>
        <View style={styles.camBox}>
          <WebView<object>
            ref={webRef}
            source={{ html: POSE_VIEW_HTML, baseUrl: POSE_BRIDGE_BASE_URL }}
            originWhitelist={['*']}
            javaScriptEnabled
            domStorageEnabled
            allowsInlineMediaPlayback
            // No hace falta onPermissionRequest: react-native-webview concede
            // getUserMedia internamente mapeando RESOURCE_VIDEO_CAPTURE a
            // Manifest.permission.CAMERA (RNCWebChromeClient.java:143). Lo que sí
            // importa es el permiso runtime, que da useCameraPermissions arriba.
            onMessage={onWebMessage}
            onError={(e) => {
              setPoseState('error de red');
              log(`WebView de pose no pudo cargar: ${e.nativeEvent.description}`, 'warn');
            }}
            style={styles.cam}
          />

          <View style={styles.overlayTop} pointerEvents="none">
            <Text style={styles.exName}>{cfg.name}</Text>
            <Text style={styles.counter}>{value}</Text>
            <Text style={[styles.gate, { color: gateColor }]}>{message}</Text>
            <Text style={styles.meta}>
              ángulo {angle.toFixed(0)}° · tilt {tilt.lastDeg.toFixed(0)}° (
              {tilt.vertical ? 'vertical' : 'NO vertical'})
            </Text>
            <Text style={styles.meta}>
              {poseState}
              {backend ? ` (${backend})` : ''} · {calibInfo}
            </Text>
          </View>

          {livenessUi.active && !livenessUi.passed ? (
            <View style={styles.banner} pointerEvents="none">
              <Text style={styles.bannerText}>
                PRUEBA DE VIDA:{' '}
                {livenessUi.type === 'hand' ? 'levantá la mano' : 'bajá y aguantá 2 s'}
                {livenessUi.type === 'hold' && livenessUi.holdMs > 0
                  ? ` (${Math.round(livenessUi.holdMs / 100) / 10}s)`
                  : ''}
              </Text>
            </View>
          ) : null}

          {!tilt.confirmed ? (
            <View style={styles.tiltWarn} pointerEvents="none">
              <Text style={styles.tiltWarnText}>
                Vertical — {Math.round(confirmProgress(tilt) * 100)}%
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.controls}>
        <Pressable style={styles.btnSmall} onPress={flip}>
          <Text style={styles.btnTextSmall}>Girar cámara</Text>
        </Pressable>
        <Pressable style={styles.btnSmall} onPress={() => (running ? finish() : start())}>
          <Text style={styles.btnTextSmall}>{running ? 'Terminar' : 'Iniciar'}</Text>
        </Pressable>
      </View>

      <View style={styles.logBox}>
        {logs.slice(0, 8).map((l) => (
          <Text
            key={l.id}
            style={[
              styles.logLine,
              l.kind === 'ok' && styles.logOk,
              l.kind === 'warn' && styles.logWarn,
            ]}
          >
            {l.text}
          </Text>
        ))}
      </View>

      <Pressable style={styles.back} onPress={onExit}>
        <Text style={styles.backText}>← Salir del test</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#05070A' },
  scrollContent: { padding: 12, paddingBottom: 24 },
  box: { padding: 18, paddingTop: 20 },
  msg: { color: '#9FB0C6', fontSize: 13, lineHeight: 19, marginBottom: 14 },
  // La caja de la cámara replica .video-wrap del prototipo (HTML:66-74):
  // relación 3/4, fondo negro y esquinas redondeadas. El alto NO puede ser
  // flex:1: eso reparte el espacio con los controles y el log, y con pantallas
  // bajas la cámara queda en cero.
  camBox: {
    width: '100%',
    aspectRatio: 0.75,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  // Wrapper sin bordered para que los HUD absolutos se midan contra la caja de
  // la cámara y no contra la ventana del ScrollView.
  camStack: { width: '100%', aspectRatio: 0.75 },
  cam: { flex: 1, backgroundColor: '#000' },
  overlayTop: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(3,4,5,0.62)',
    padding: 8,
    borderRadius: 8,
  },
  banner: {
    position: 'absolute',
    bottom: 150,
    left: 10,
    right: 10,
    backgroundColor: 'rgba(244,197,66,0.94)',
    padding: 10,
    borderRadius: 8,
  },
  bannerText: { color: '#1A1200', fontWeight: '800', fontSize: 13, textAlign: 'center' },
  tiltWarn: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(255,107,107,0.94)',
    padding: 8,
    borderRadius: 8,
    maxWidth: 130,
  },
  tiltWarnText: { color: '#2A0A0A', fontWeight: '800', fontSize: 11, textAlign: 'center' },
  exName: { color: '#EAF2FF', fontSize: 13, fontWeight: '700' },
  counter: { color: '#39D98A', fontSize: 28, fontWeight: '800', marginTop: 2 },
  gate: { fontSize: 12, fontWeight: '700' },
  meta: { color: '#9FB0C6', fontSize: 10, marginTop: 2 },
  controls: { flexDirection: 'row', gap: 10, marginTop: 12 },
  btn: { backgroundColor: '#39D98A', paddingVertical: 13, borderRadius: 10, alignItems: 'center' },
  btnText: { color: '#06210F', fontWeight: '800', fontSize: 14 },
  btnSmall: {
    flex: 1,
    backgroundColor: '#1E2630',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnTextSmall: { color: '#EAF2FF', fontWeight: '700', fontSize: 13 },
  logBox: {
    marginTop: 12,
    backgroundColor: '#070A0E',
    borderRadius: 10,
    padding: 10,
    minHeight: 90,
  },
  logLine: { color: '#6E7F96', fontSize: 11, lineHeight: 16 },
  logOk: { color: '#39D98A' },
  logWarn: { color: '#F4C542' },
  back: { paddingVertical: 12, alignItems: 'center' },
  backText: { color: '#39D98A', fontSize: 13, fontWeight: '700' },
});

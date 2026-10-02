import { CameraView, useCameraPermissions, type CameraType } from 'expo-camera';
import { Accelerometer, type AccelerometerMeasurement } from 'expo-sensors';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

import type { ExerciseConfig } from '../lib/exercises';
import { needsCalibration } from '../lib/exercises';
import { handStreak, livenessDue, livenessRequired, scheduleLiveness } from '../lib/liveness';
import {
  CALIB_RANGE_MAX,
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
import { POSE_BRIDGE_BASE_URL, POSE_BRIDGE_HTML, type Landmark } from '../lib/poseWorker';
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

const CAPTURE_INTERVAL_MS = 700;

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
  const [facing, setFacing] = useState<CameraType>('front');
  const [running, setRunning] = useState(false);
  const [reps, setReps] = useState(0);
  const [holdMs, setHoldMs] = useState(0);
  const [gate, setGate] = useState<Gate>('landmarks');
  const [message, setMessage] = useState('Presioná Iniciar');
  const [angle, setAngle] = useState(0);
  const [tilt, setTilt] = useState<TiltState>(initialTiltState());
  const [backend, setBackend] = useState<string | null>(null);
  const [poseState, setPoseState] = useState('cargando modelo…');
  const [calibInfo, setCalibInfo] = useState('sin calibrar');
  const [livenessUi, setLivenessUi] = useState({
    active: false,
    passed: false,
    holdMs: 0,
    type: 'hand' as 'hand' | 'hold',
  });
  const [logs, setLogs] = useState<LogLine[]>([]);

  const camRef = useRef<CameraView>(null);
  const webRef = useRef<WebView<object>>(null);
  const sessionRef = useRef<Session | null>(null);
  const pendingRef = useRef(new Map<number, (v: Landmark[] | null) => void>());
  const idRef = useRef(0);
  const logIdRef = useRef(0);

  const required = cfg ? livenessRequired(cfg) : false;

  const log = useCallback((text: string, kind: LogLine['kind'] = 'info') => {
    setLogs((prev) => [{ id: ++logIdRef.current, text, kind }, ...prev].slice(0, 40));
  }, []);

  useEffect(() => {
    Accelerometer.setUpdateInterval(SENSOR_UPDATE_INTERVAL_MS);
    const sub = Accelerometer.addListener((m: AccelerometerMeasurement) => {
      const sample: AccelSample = { x: m.x, y: m.y, z: m.z };
      if (sessionRef.current) sessionRef.current.accel = sample;
      setTilt((prev) => pushSample(prev, sample, Date.now()));
    });
    return () => sub.remove();
  }, []);

  // Si MediaPipe no announces "ready" en 45 s no va a hacerlo: el WASM y el
  // modelo se quedan colgados sin internet y la pantalla queda en blanco.
  useEffect(() => {
    if (poseState === 'pose lista' || poseState === 'error al cargar') return;
    const t = setTimeout(() => {
      setPoseState('error al cargar');
      log(
        `MediaPipe no cargó en 45 s (${poseState}). Revisá la conexión: el WASM y el modelo vienen de cdn.jsdelivr.net y storage.googleapis.com.`,
        'warn',
      );
    }, 45_000);
    return () => clearTimeout(t);
  }, [poseState, log]);

  const onWebMessage = useCallback(
    (event: { nativeEvent: { data: string } }) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(event.nativeEvent.data) as Record<string, unknown>;
      } catch {
        return;
      }
      if (msg['type'] === 'stage') {
        const s = String(msg['stage'] ?? '');
        const label =
          s === 'arrancando'
            ? 'iniciando pose…'
            : s === 'script'
              ? 'bajando MediaPipe…'
              : s === 'wasm'
                ? 'cargando WASM…'
                : s === 'modelo'
                  ? 'bajando modelo…'
                  : s;
        setPoseState(label);
        return;
      }
      if (msg['type'] === 'log') {
        log(String(msg['text'] ?? ''), 'warn');
        return;
      }
      if (msg['type'] === 'ready') {
        const be = String(msg['backend'] ?? '?');
        setPoseState('pose lista');
        setBackend(be);
        log(`pose lista (${be})`, 'ok');
        return;
      }
      if (msg['type'] === 'fatal') {
        setPoseState('error al cargar');
        log(`pose no pudo cargar: ${String(msg['error'] ?? '?')}`, 'warn');
        return;
      }
      const cb = pendingRef.current.get(Number(msg['id']));
      if (cb) {
        pendingRef.current.delete(Number(msg['id']));
        const ok = msg['ok'] === true;
        cb(ok ? ((msg['landmarks'] as Landmark[]) ?? null) : null);
      }
    },
    [log],
  );

  const analyze = useCallback((base64: string): Promise<Landmark[] | null> => {
    const id = ++idRef.current;
    return new Promise((resolve) => {
      pendingRef.current.set(id, resolve);
      webRef.current?.injectJavaScript(`window.__analyze(${id}, ${JSON.stringify(base64)}); true;`);
      setTimeout(() => {
        if (pendingRef.current.has(id)) {
          pendingRef.current.delete(id);
          resolve(null);
        }
      }, 5000);
    });
  }, []);

  const snapshot = useCallback(async (rep: number) => {
    try {
      const photo = await camRef.current?.takePictureAsync({ quality: 0.5, base64: false });
      if (photo?.uri && sessionRef.current) {
        sessionRef.current.evidence.push({ rep, uri: photo.uri, at: Date.now() });
      }
    } catch {
      // evidencia best-effort: no debe cortar el conteo
    }
  }, []);

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
          setGate('calibrando');
          setMessage(
            cfg.restTorsoMax === 35
              ? 'Acomodate acostado para calibrar'
              : 'Acomodate en posición para calibrar',
          );
        } else {
          const { buf, calib } = attemptCalibration(rawAngle, s.calibBuf, cfg);
          s.calibBuf = buf;
          if (calib) {
            s.engine = { ...s.engine, restAngle: calib.restAngle, down: calib.down, up: calib.up };
            setCalibInfo(`calibrado ${calib.restAngle.toFixed(1)}° (rango ≤${CALIB_RANGE_MAX}°)`);
            log(
              `calibración reposo ${calib.restAngle.toFixed(1)}° → down ${calib.down.toFixed(1)} up ${calib.up.toFixed(1)}`,
              'ok',
            );
          } else {
            setCalibInfo(`calibrando ${buf.length}/10…`);
          }
        }
        calibDone = s.engine.restAngle !== null;
      }

      // El motor compara el ángulo CRUDO contra umbrales derivados de la
      // calibración; no hay que restar el reposo (como en producción).
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
        void snapshot(out.completedRep.index);
      }

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
    },
    [cfg, log, snapshot, required],
  );

  useEffect(() => {
    if (!running || !cfg) return;
    let alive = true;
    const tick = async () => {
      while (alive && sessionRef.current) {
        const now = Date.now();
        try {
          const photo = await camRef.current?.takePictureAsync({ quality: 0.3, base64: true });
          if (photo?.base64) {
            const lms = await analyze(photo.base64);
            if (lms && lms.length > 0) handleFrame(lms, now);
            else log('sin pose en el frame', 'warn');
          }
        } catch (e) {
          log(`error de captura: ${String(e)}`, 'warn');
        }
        await new Promise((r) => setTimeout(r, CAPTURE_INTERVAL_MS));
      }
    };
    void tick();
    return () => {
      alive = false;
    };
  }, [running, cfg, analyze, handleFrame, log]);

  const start = useCallback(() => {
    if (!cfg) return;
    const accel = sessionRef.current?.accel ?? { x: 0, y: 1, z: 0 };
    sessionRef.current = newSession(cfg, accel);
    setReps(0);
    setHoldMs(0);
    setCalibInfo('sin calibrar');
    setLivenessUi({ active: false, passed: false, holdMs: 0, type: cfg.liveness });
    setLogs([]);
    setRunning(true);
    log(`sesión iniciada: ${cfg.name}, objetivo ${cfg.target}`);
  }, [cfg, log]);

  const finish = useCallback(() => {
    if (!cfg) return;
    setRunning(false);
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
        <Text style={styles.msg}>El banco de pruebas necesita la cámara para contar reps.</Text>
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
    <View style={styles.wrap}>
      <View style={styles.camBox}>
        <CameraView
          ref={camRef}
          style={styles.cam}
          facing={facing}
          mode="picture"
          animateShutter={false}
        />
        <View style={styles.overlayTop}>
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
          <View style={styles.banner}>
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
          <View style={styles.tiltWarn}>
            <Text style={styles.tiltWarnText}>
              Vertical — {Math.round(confirmProgress(tilt) * 100)}%
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.controls}>
        <Pressable
          style={styles.btnSmall}
          onPress={() => setFacing(facing === 'front' ? 'back' : 'front')}
        >
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

      <WebView<object>
        ref={webRef}
        source={{ html: POSE_BRIDGE_HTML, baseUrl: POSE_BRIDGE_BASE_URL }}
        originWhitelist={['*']}
        javaScriptEnabled
        onMessage={onWebMessage}
        onError={(e) => {
          setPoseState('error de red');
          log(`WebView de pose no pudo cargar: ${e.nativeEvent.description}`, 'warn');
        }}
        style={styles.hidden}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  box: { padding: 18, paddingTop: 20 },
  msg: { color: '#9FB0C6', fontSize: 13, lineHeight: 19, marginBottom: 14 },
  camBox: { height: 420, borderRadius: 14, overflow: 'hidden', backgroundColor: '#000' },
  cam: { flex: 1 },
  overlayTop: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(3,4,5,0.62)',
    padding: 8,
    borderRadius: 8,
  },
  exName: { color: '#EAF2FF', fontSize: 13, fontWeight: '700' },
  counter: { color: '#39D98A', fontSize: 28, fontWeight: '800', marginTop: 2 },
  gate: { fontSize: 12, fontWeight: '700' },
  meta: { color: '#9FB0C6', fontSize: 10, marginTop: 2 },
  banner: {
    position: 'absolute',
    bottom: 60,
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
  // El WebView tiene que existir "de verdad" para que Android no lo pause:
  // 1x1 con opacity 0.01 lo deja en 1 fps o lo congela, y entonces la imagen
  // nunca termina de decodificar. Va 2x2 casi transparente y fuera de pantalla.
  hidden: { width: 2, height: 2, opacity: 0.02, position: 'absolute', left: -30, top: -30 },
});

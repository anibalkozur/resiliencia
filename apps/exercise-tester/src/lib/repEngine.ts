// Motor de conteo. Traduce los umbrales por ejercicio a un estado de máquina
// con los mismos gates del prototipo, pero portable (WebView de tests) y con
// telemetría completa para poder ajustar umbrales: guarda ángulo de fondo, pico,
// valle y duración de cada rep.

import { ASYMMETRY_MAX_DEG, RollingMean, mean } from './pose';
import type { ExerciseConfig } from './exercises';
import { needsCalibration } from './exercises';

export const MIN_REP_INTERVAL_MS = 350;
/** Cuadros de cuerpo visible antes de habilitar el conteo (CONFIRM_FRAMES). */
export const CONFIRM_FRAMES = 4;
/** Cuadros que un candidato (abajo/arriba) debe sostenerse (STATE_CONFIRM_FRAMES). */
export const STATE_CONFIRM_FRAMES = 3;

export type Phase = 'reposo' | 'bajo' | 'arriba';

export type RepTelemetry = {
  index: number;
  /** null cuando el ejercicio usa umbrales absolutos (sin calibración). */
  restAngle: number | null;
  peak: number;
  trough: number;
  amplitude: number;
  durationMs: number;
  startedAt: number;
  finishedAt: number;
  livenessOk: boolean;
};

export type Gate =
  | 'ok'
  | 'landmarks'
  | 'lado'
  | 'postura'
  | 'linea'
  | 'de_pie'
  | 'calibrando'
  | 'vertical'
  | 'orientacion'
  | 'asimetria';

export type RepResult = {
  reps: number;
  phase: Phase;
  holdMs: number;
  candidate: 'down' | 'up' | null;
  candidateStreak: number;
  metrics: Record<string, number>;
  gate: Gate;
  message: string;
  repCountInitialized: boolean;
  lastRepAt: number | null;
};

export type RepEngineState = {
  calibBuf: number[];
  restAngle: number | null;
  down: number;
  up: number;
  phase: Phase;
  candidate: 'down' | 'up' | null;
  candidateStreak: number;
  bodyOkStreak: number;
  reps: number;
  holdMs: number;
  /** Marca de tiempo del último cuadro en posición (isométricos por segundos). */
  holdMark: number | null;
  lastRepAt: number | null;
  repStartAt: number | null;
  peak: number;
  trough: number;
  livenessOk: boolean;
  livenessHoldStart: number | null;
  smoothed: RollingMean;
};

/**
 * Ventana de suavizado del ángulo, igual que el prototipo:
 * - mountain_climbers suaviza el ángulo de rodilla con 5 (HTML:1594)
 * - frontal usa 5, lateral 7 (HTML:1394, 1629)
 */
export function smoothWindow(cfg: ExerciseConfig): number {
  if (cfg.kneeFold !== undefined) return 5;
  return cfg.side === 'frontal' ? 5 : 7;
}

export function initEngine(cfg: ExerciseConfig): RepEngineState {
  return {
    calibBuf: [],
    restAngle: null,
    down: cfg.downThresh,
    up: cfg.upThresh,
    phase: 'reposo',
    candidate: null,
    candidateStreak: 0,
    bodyOkStreak: 0,
    reps: 0,
    holdMs: 0,
    holdMark: null,
    lastRepAt: null,
    repStartAt: null,
    peak: 0,
    trough: Number.POSITIVE_INFINITY,
    livenessOk: false,
    livenessHoldStart: null,
    smoothed: new RollingMean(smoothWindow(cfg)),
  };
}

export type FrameInput = {
  /** Ángulo crudo de la métrica del ejercicio (grados). */
  angle: number;
  /** true si los landmarks visibles son suficientes. */
  bodyOk: boolean;
  /** true si el lado fue confirmado. */
  sideOk: boolean;
  /** true si el cuerpo está alineado (shoulder-hip-ankle). */
  lineOk: boolean;
  /** true si NO está tumbado de más (flexiones/plancha). */
  notGroundedTooMuch: boolean;
  /** true si NO está de pie (abdominales). */
  notStanding: boolean;
  /** false hasta que la calibración de reposo tenga 10 muestras válidas. */
  calibDone: boolean;
  now: number;
  livenessActive: boolean;
  /** Umbral efectivo de la prueba de vida tipo hold (ángulo de abajo). */
  livenessDownThresh: number;
  /**
   * Segunda pierna, solo en vista frontal (sentadillas). El prototipo exige que
   * AMBAS rodillas cruz el umbral: max para abajo, min para arriba.
   */
  secondAngle?: number;
};

export type FrameResult = {
  state: RepEngineState;
  result: RepResult;
  /** Rep recién contada en este frame (para foto/evidencia). */
  completedRep: RepTelemetry | null;
  /** Milisegundos acumulados de la prueba de vida tipo hold. */
  livenessHoldMs: number;
  livenessPassed: boolean;
};

/**
 * Gate de pose: devuelve el bloqueo actual o 'ok'. Cada gate resetea el estado
 * de conteo, igual que en el prototipo (evita contar reps con cuerpo roto).
 */
export function postureGate(
  cfg: ExerciseConfig,
  flags: {
    sideOk: boolean;
    bodyOk: boolean;
    notGroundedTooMuch: boolean;
    notStanding: boolean;
    lineOk: boolean;
    verticalOk: boolean;
  },
): Gate {
  if (!flags.verticalOk) return 'orientacion';
  if (cfg.side === 'lateral') {
    if (!flags.sideOk) return 'lado';
    if (!flags.bodyOk) return 'landmarks';
    if (cfg.groundedMax !== undefined && !flags.notGroundedTooMuch) return 'postura';
    if (cfg.standingKneeMargin !== undefined && !flags.notStanding) return 'de_pie';
    if (cfg.lineMin !== undefined && !flags.lineOk) return 'linea';
  } else {
    if (!flags.bodyOk) return 'landmarks';
  }
  return 'ok';
}

export function gateMessage(gate: Gate): string {
  switch (gate) {
    case 'orientacion':
      return 'Poné el celular parado en vertical';
    case 'lado':
      return 'Ubicá el celular de perfil';
    case 'landmarks':
      return 'No se detecta cuerpo — pausado';
    case 'postura':
      return 'Alineá el cuerpo';
    case 'de_pie':
      return 'No te pongas de pie: acostate';
    case 'linea':
      return 'Alineá el cuerpo';
    case 'calibrando':
      return 'Calibrando postura de reposo…';
    case 'asimetria':
      return 'Igualá las dos piernas';
    default:
      return 'Listo';
  }
}

/**
 * Procesa un frame. `angle` ya viene calculada por la pantalla (frontal:
 * flexión de cadera; lateral: delta contra calibración).
 */
export function processFrame(
  cfg: ExerciseConfig,
  state: RepEngineState,
  input: FrameInput,
  gate: Gate,
): FrameResult {
  let s = state;
  let completedRep: RepTelemetry | null = null;

  if (gate !== 'ok') {
    // Cualquier bloqueo resetea el conteo en curso (como processPose del prototipo).
    const reset: RepEngineState = {
      ...initEngine(cfg),
      smoothed: new RollingMean(smoothWindow(cfg)),
      reps: s.reps,
      lastRepAt: s.lastRepAt,
      livenessOk: s.livenessOk,
      livenessHoldStart: s.livenessHoldStart,
    };
    s = reset;
    return {
      state: s,
      result: {
        reps: s.reps,
        phase: 'reposo',
        holdMs: 0,
        candidate: null,
        candidateStreak: 0,
        metrics: {},
        gate,
        message: gateMessage(gate),
        repCountInitialized: false,
        lastRepAt: s.lastRepAt,
      },
      completedRep: null,
      livenessHoldMs: 0,
      livenessPassed: s.livenessOk,
    };
  }

  // --- Confirmación de cuerpo visible ---
  // Producción exige CONFIRM_FRAMES = 4 cuadros consecutivos con los landmarks
  // completos antes de habilitar el conteo (HTML:1405-1408 frontal, :1519-1520
  // lateral). Sin esto un único cuadro con las rodillas visibles alcanza para
  // contar, y el conteo arranca con la postura apenas asetada.
  const bodyStreak = Math.min(s.bodyOkStreak + 1, CONFIRM_FRAMES);
  s = { ...s, bodyOkStreak: bodyStreak };
  if (bodyStreak < CONFIRM_FRAMES) {
    return {
      state: s,
      result: {
        reps: s.reps,
        phase: 'reposo',
        holdMs: 0,
        candidate: null,
        candidateStreak: 0,
        metrics: {},
        gate: 'landmarks',
        message: `Confirmando cuerpo… ${bodyStreak}/${CONFIRM_FRAMES}`,
        repCountInitialized: s.repStartAt !== null,
        lastRepAt: s.lastRepAt,
      },
      completedRep: null,
      livenessHoldMs: 0,
      livenessPassed: s.livenessOk,
    };
  }

  let angle = s.smoothed.push(input.angle);
  s = { ...s };
  const holdStart = s.livenessHoldStart;

  // Orientación de la métrica: en TODOS los ejercicios de producción "abajo" es
  // ángulo MENOR que el umbral (rodilla de sentadilla, codo de flexión, cadera
  // de abdominales). Solo el puente de glúteos lo invierte, porque ahí subir la
  // cadera es "bajar". Ver camera-verification.html:1686-1692.
  const downIsLess = !cfg.bridge;
  const down = s.down;
  const up = s.up;

  // --- Liveness (prueba de vida) ---
  let livenessHoldMs = 0;
  if (input.livenessActive) {
    if (cfg.liveness === 'hold') {
      const isDownPos = downIsLess
        ? angle < input.livenessDownThresh
        : angle > input.livenessDownThresh;
      if (isDownPos) {
        const from = holdStart ?? input.now;
        if (holdStart === null) s = { ...s, livenessHoldStart: from };
        livenessHoldMs = input.now - from;
        if (livenessHoldMs >= 2000 && !s.livenessOk) s = { ...s, livenessOk: true };
      } else {
        s = { ...s, livenessHoldStart: null };
        livenessHoldMs = 0;
      }
    }
    // tipo 'hand' lo confirma la pantalla (muñeca por encima de la nariz)
  }

  // --- Vista frontal: el prototipo exige que AMBAS rodillas crucen el umbral
  // (max para abajo, min para arriba) y bloquea si se asimetría > 35°. ---
  let asymDiff = 0;
  if (input.secondAngle !== undefined) {
    asymDiff = Math.abs(angle - input.secondAngle);
    if (asymDiff > ASYMMETRY_MAX_DEG) {
      return {
        state: s,
        result: {
          reps: s.reps,
          phase: 'reposo',
          holdMs: 0,
          candidate: null,
          candidateStreak: 0,
          metrics: { angle, second: input.secondAngle, diff: asymDiff, down, up },
          gate: 'asimetria',
          message: `Piernas desiguales (${asymDiff.toFixed(0)}°)`,
          repCountInitialized: s.repStartAt !== null,
          lastRepAt: s.lastRepAt,
        },
        completedRep: null,
        livenessHoldMs,
        livenessPassed: s.livenessOk,
      };
    }
    // la pierna "peor" manda: ambas tienen que cruzar el umbral
    angle = downIsLess ? Math.max(angle, input.secondAngle) : Math.min(angle, input.secondAngle);
  }

  // --- Perfil deltas: recalcular umbrales desde la calibración. Mountain
  // climbers y los isométricos en segundos también la exigen (ver
  // needsCalibration en exercises.ts).
  if (needsCalibration(cfg) && (!input.calibDone || s.restAngle === null)) {
    return {
      state: s,
      result: {
        reps: s.reps,
        phase: 'reposo',
        holdMs: 0,
        candidate: null,
        candidateStreak: 0,
        metrics: {},
        gate: 'calibrando',
        message: gateMessage('calibrando'),
        repCountInitialized: false,
        lastRepAt: s.lastRepAt,
      },
      completedRep: null,
      livenessHoldMs,
      livenessPassed: s.livenessOk,
    };
  }

  // mountain_climbers: cuenta por pliegue de rodilla contra un umbral fijo,
  // sin calibración ni transición abajo/arriba (camera-verification.html:1591-1618)
  if (cfg.kneeFold !== undefined) {
    let kPhase: Phase = s.phase;
    let kReps = s.reps;
    let kPeak = s.peak;
    let kTrough = s.trough;
    let kStart = s.repStartAt;
    let kLast = s.lastRepAt;
    let kneeRep: RepTelemetry | null = null;

    const folded = angle < cfg.kneeFold;
    const tooFastK = kLast !== null && input.now - kLast < MIN_REP_INTERVAL_MS;
    if (folded && kPhase !== 'bajo') {
      kPhase = 'bajo';
      kStart = input.now;
      kPeak = angle;
      kTrough = angle;
    } else if (!folded && kPhase === 'bajo') {
      kPhase = 'arriba';
      const dur = kStart === null ? 0 : input.now - kStart;
      const finished = kStart;
      kStart = null;
      if (!tooFastK) {
        kReps += 1;
        kLast = input.now;
        const r1 = (v: number) => Math.round(v * 10) / 10;
        kneeRep = {
          index: kReps,
          restAngle: null,
          peak: r1(kPeak),
          trough: r1(kTrough),
          amplitude: r1(Math.abs(kPeak - kTrough)),
          durationMs: dur,
          startedAt: finished ?? input.now,
          finishedAt: input.now,
          livenessOk: s.livenessOk,
        };
      }
    }
    if (kPhase !== 'reposo') {
      kPeak = Math.max(kPeak, angle);
      kTrough = Math.min(kTrough, angle);
    }
    return {
      state: {
        ...s,
        phase: kPhase,
        reps: kReps,
        repStartAt: kStart,
        lastRepAt: kLast,
        peak: kPeak,
        trough: kTrough,
      },
      result: {
        reps: kReps,
        phase: kPhase,
        holdMs: 0,
        candidate: null,
        candidateStreak: 0,
        metrics: { angle, peak: kPeak, trough: kTrough, fold: cfg.kneeFold },
        gate: 'ok',
        message: folded ? 'RODILLA AL PECHO' : 'ARRIBA',
        repCountInitialized: true,
        lastRepAt: kLast,
      },
      completedRep: kneeRep,
      livenessHoldMs,
      livenessPassed: s.livenessOk,
    };
  }

  const isDown = downIsLess ? angle < down : angle > down;
  const isUp = downIsLess ? angle > up : angle < up;

  // --- Candidato con confirmación por frames ---
  const cand: 'down' | 'up' | null = isDown ? 'down' : isUp ? 'up' : null;
  let streak =
    cand !== null && cand === s.candidate ? s.candidateStreak + 1 : cand === null ? 0 : 1;
  s = { ...s, candidate: cand, candidateStreak: streak };

  let phase: Phase = s.phase;
  let reps = s.reps;
  let holdMs = s.holdMs;
  let repStartAt = s.repStartAt;
  let lastRepAt = s.lastRepAt;
  let peak = s.peak;
  let trough = s.trough;

  // --- Isométricos por segundos: el hold depende de la vista, igual que el
  // prototipo. Frontal: `holdOk = cand === 'down'`, o sea AMBAS rodillas bajo
  // `downThresh` (HTML:1450 + 1420-1422). Lateral: `smoothed >
  // dynamicUpThresh`, o sea el ángulo por encima del tope calibrado
  // (HTML:1669). En ambos casos se suma el tiempo transcurrido y no hay reps.
  if (cfg.unit === 'seconds') {
    const holding = cfg.side === 'frontal' ? angle < cfg.downThresh : angle > up;
    if (holding) {
      const from = s.holdMark ?? input.now;
      holdMs += input.now - from;
      s = { ...s, holdMark: input.now };
    } else {
      s = { ...s, holdMark: null };
    }
    return {
      state: { ...s, holdMs, phase: holding ? 'bajo' : 'arriba' },
      result: {
        reps,
        phase: holding ? 'bajo' : 'arriba',
        holdMs,
        candidate: null,
        candidateStreak: 0,
        metrics: { angle, down, up },
        gate: 'ok',
        message: holding ? `SOSTENÉ ${Math.floor(holdMs / 1000)}s` : 'Fuera de posición',
        repCountInitialized: true,
        lastRepAt: s.lastRepAt,
      },
      completedRep: null,
      livenessHoldMs,
      livenessPassed: s.livenessOk,
    };
  }

  if (streak >= STATE_CONFIRM_FRAMES) {
    if (cand === 'down' && phase !== 'bajo') {
      phase = 'bajo';
      repStartAt = input.now;
      peak = angle;
      trough = angle;
      holdMs = 0;
    } else if (cand === 'up' && phase === 'bajo') {
      // transición abajo→arriba cuenta rep (o segundos, si isométrico)
      const durationMs = repStartAt === null ? 0 : input.now - repStartAt;
      const tooFast = lastRepAt !== null && input.now - lastRepAt < MIN_REP_INTERVAL_MS;
      if (cfg.kind === 'isometrico') {
        holdMs += durationMs;
      } else if (!tooFast) {
        reps += 1;
        lastRepAt = input.now;
        const r1 = (v: number) => Math.round(v * 10) / 10;
        completedRep = {
          index: reps,
          restAngle: s.restAngle === null ? null : r1(s.restAngle),
          peak: r1(peak),
          trough: r1(trough),
          amplitude: r1(Math.abs(peak - trough)),
          durationMs,
          startedAt: repStartAt ?? input.now,
          finishedAt: input.now,
          livenessOk: s.livenessOk,
        };
      }
      phase = 'arriba';
      repStartAt = null;
    }
  }

  // Pico/valle de la rep: se.trackea el máximo y el mínimo del ángulo, sin
  // depender de la orientación (así la amplitud siempre es positiva).
  if (phase !== 'reposo') {
    peak = Math.max(peak, angle);
    trough = Math.min(trough, angle);
  }

  if (cfg.kind === 'isometrico' && phase === 'bajo' && repStartAt !== null) {
    holdMs = input.now - repStartAt;
  }

  const metrics: Record<string, number> = { angle, peak, trough, down, up };
  if (s.restAngle !== null) metrics.restAngle = s.restAngle;

  const finalState: RepEngineState = {
    ...s,
    phase,
    reps,
    holdMs,
    repStartAt,
    lastRepAt,
    peak,
    trough,
    down,
    up,
  };

  return {
    state: finalState,
    result: {
      reps,
      phase,
      holdMs,
      candidate: cand,
      candidateStreak: streak,
      metrics,
      gate: 'ok',
      message: phase === 'bajo' ? 'Abajo' : phase === 'arriba' ? 'Arriba' : 'En movimiento',
      repCountInitialized: true,
      lastRepAt,
    },
    completedRep,
    livenessHoldMs,
    livenessPassed: finalState.livenessOk,
  };
}

/** Reporte serializable de una prueba de ejercicio. */
export type ExerciseReport = {
  exerciseId: string;
  startedAt: number;
  finishedAt: number;
  target: number;
  reps: number;
  holdMs: number;
  reached: boolean;
  restAngle: number | null;
  livenessPassed: boolean;
  livenessRequired: boolean;
  telemetry: RepTelemetry[];
  finalMetrics: Record<string, number>;
};

export function avgAmplitude(t: RepTelemetry[]): number {
  return mean(t.map((r) => r.amplitude));
}

export function avgDuration(t: RepTelemetry[]): number {
  return mean(t.map((r) => r.durationMs));
}

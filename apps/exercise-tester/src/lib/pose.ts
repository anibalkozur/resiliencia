// Geometría de pose: mismas fórmulas y constantes que camera-verification.html
// (VIS=0.65, CALIB_WINDOW=10, CALIB_RANGE_MAX=9, buffers de suavizado).

import type { ExerciseConfig, Triangle } from './exercises';

export const VIS = 0.65;
export const CALIB_WINDOW = 10;
export const CALIB_RANGE_MAX = 9;
export const FRONTAL_SMOOTH_WINDOW = 5;
export const LATERAL_SMOOTH_WINDOW = 7;
export const HISTORY_WINDOW = 5;
export const SIDE_VOTES_WINDOW = 15;
export const SIDE_VOTES_NEEDED = 6;
export const SIDE_AVG_VIS = 0.4;
/** Diferencia máxima entre las dos rodillas antes de bloquear (prototipo). */
export const ASYMMETRY_MAX_DEG = 35;

export type Pt = { x: number; y: number; visibility?: number };

export const INDICES = {
  nose: 0,
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
} as const;

/**
 * Esqueleto completo, equivalente a `PoseLandmarker.POSE_CONNECTIONS`. La app
 * real lo dibuja con `DrawingUtils.drawConnectors` sobre un canvas (HTML:1708);
 * acá el mismo grafo se arma con Views porque la cámara es nativa y el WebView
 * de inferencia está oculto, así que no hay canvas donde pintar.
 */
export const POSE_CONNECTIONS: readonly (readonly [number, number])[] = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 7],
  [0, 4],
  [4, 5],
  [5, 6],
  [6, 8],
  [9, 10],
  [11, 12],
  [11, 13],
  [13, 15],
  [15, 17],
  [15, 19],
  [15, 21],
  [17, 19],
  [12, 14],
  [14, 16],
  [16, 18],
  [16, 20],
  [16, 22],
  [18, 20],
  [11, 23],
  [12, 24],
  [23, 24],
  [23, 25],
  [25, 27],
  [24, 26],
  [26, 28],
  [27, 29],
  [29, 31],
  [28, 30],
  [30, 32],
  [27, 31],
  [28, 32],
  [0, 11],
  [0, 12],
] as const;

/** Etiquetas de los 33 landmarks, para el checklist de completitud. */
export const LANDMARK_LABELS: readonly string[] = [
  'nariz',
  'ojo izq int',
  'ojo izq',
  'ojo izq ext',
  'ojo der int',
  'ojo der',
  'ojo der ext',
  'oreja izq',
  'oreja der',
  'boca izq',
  'boca der',
  'hombro izq',
  'hombro der',
  'codo izq',
  'codo der',
  'muñeca izq',
  'muñeca der',
  'meñique izq',
  'meñique der',
  'índice izq',
  'índice der',
  'pulgar izq',
  'pulgar der',
  'cadera izq',
  'cadera der',
  'rodilla izq',
  'rodilla der',
  'tobillo izq',
  'tobillo der',
  'talón izq',
  'talón der',
  'punta izq',
  'punta der',
] as const;

/** Puntos que exige el prototipo en vista frontal (ambas piernas). */
export const FRONTAL_POINTS = [
  INDICES.leftShoulder,
  INDICES.rightShoulder,
  INDICES.leftHip,
  INDICES.rightHip,
  INDICES.leftKnee,
  INDICES.rightKnee,
  INDICES.leftAnkle,
  INDICES.rightAnkle,
] as const;

/**
 * Puntos que el prototipo exige visibles por lado. Sale de `cfg.points`
 * (copia literal de `sides[].points` del HTML) para que agregar un ejercicio
 * no pueda olvidarse de un landmark.
 */
export function lateralPoints(cfg: ExerciseConfig, side: SideKey): number[] {
  const names = cfg.points ?? ['shoulder', 'hip', 'knee'];
  const idx = SIDE_IDX[side] as unknown as Record<string, number>;
  return names.map((n) => idx[n]).filter((i) => i !== undefined);
}

export type SideKey = 'front' | 'back';

export const SIDE_IDX: Record<
  SideKey,
  Record<'shoulder' | 'elbow' | 'wrist' | 'hip' | 'knee' | 'ankle', number>
> = {
  front: {
    shoulder: INDICES.leftShoulder,
    elbow: INDICES.leftElbow,
    wrist: INDICES.leftWrist,
    hip: INDICES.leftHip,
    knee: INDICES.leftKnee,
    ankle: INDICES.leftAnkle,
  },
  back: {
    shoulder: INDICES.rightShoulder,
    elbow: INDICES.rightElbow,
    wrist: INDICES.rightWrist,
    hip: INDICES.rightHip,
    knee: INDICES.rightKnee,
    ankle: INDICES.rightAnkle,
  },
};

/** Índice por nombre de landmark del prototipo. */
export const NAME_TO_IDX: Record<string, number> = {
  nose: INDICES.nose,
  left_shoulder: INDICES.leftShoulder,
  right_shoulder: INDICES.rightShoulder,
  left_elbow: INDICES.leftElbow,
  right_elbow: INDICES.rightElbow,
  left_wrist: INDICES.leftWrist,
  right_wrist: INDICES.rightWrist,
  left_hip: INDICES.leftHip,
  right_hip: INDICES.rightHip,
  left_knee: INDICES.leftKnee,
  right_knee: INDICES.rightKnee,
  left_ankle: INDICES.leftAnkle,
  right_ankle: INDICES.rightAnkle,
};

export function angleBetween(a: Pt, b: Pt, c: Pt): number {
  const v1x = a.x - b.x;
  const v1y = a.y - b.y;
  const v2x = c.x - b.x;
  const v2y = c.y - b.y;
  const dot = v1x * v2x + v1y * v2y;
  const m1 = Math.hypot(v1x, v1y);
  const m2 = Math.hypot(v2x, v2y);
  if (m1 === 0 || m2 === 0) return 0;
  const cos = Math.max(-1, Math.min(1, dot / (m1 * m2)));
  return (Math.acos(cos) * 180) / Math.PI;
}

export function avgVis(lms: Pt[], idxs: readonly number[]): number {
  let sum = 0;
  for (const i of idxs) {
    const lm = lms[i];
    if (!lm) return 0;
    sum += lm.visibility ?? 0;
  }
  return sum / idxs.length;
}

export function checkComplete(lms: Pt[], idxs: readonly number[]): boolean {
  for (const i of idxs) {
    const lm = lms[i];
    if (!lm || (lm.visibility ?? 0) < VIS) return false;
  }
  return true;
}

/**
 * Sentadillas (frontal): ángulo de rodilla porpierna,
 * angleBetween(hip, knee, ankle) — el mismo triángulo del prototipo.
 */
export function kneeAngle(lms: Pt[], hipIdx: number, kneeIdx: number, ankleIdx: number): number {
  return angleBetween(lms[hipIdx]!, lms[kneeIdx]!, lms[ankleIdx]!);
}

/**
 * Las dos rodillas y la guarda de asimetría del prototipo: se exige que
 * AMBAS rodillas superen el umbral (max para abajo, min para arriba) y se
 * bloquea si la diferencia entre piernas supera ASYMMETRY_MAX_DEG.
 */
export function bilateralKnee(lms: Pt[]): {
  left: number;
  right: number;
  diff: number;
  asymmetric: boolean;
  bothDown: number | null;
  bothUp: number | null;
} {
  const left = kneeAngle(lms, INDICES.leftHip, INDICES.leftKnee, INDICES.leftAnkle);
  const right = kneeAngle(lms, INDICES.rightHip, INDICES.rightKnee, INDICES.rightAnkle);
  const diff = Math.abs(left - right);
  return {
    left,
    right,
    diff,
    asymmetric: diff > ASYMMETRY_MAX_DEG,
    bothDown: Math.max(left, right),
    bothUp: Math.min(left, right),
  };
}

/** Flexiones: ángulo de codo angleBetween(shoulder, elbow, wrist). */
export function elbowAngle(lms: Pt[], shoulder: number, elbow: number, wrist: number): number {
  return angleBetween(lms[shoulder]!, lms[elbow]!, lms[wrist]!);
}

/** Lateral: línea hombro→cadera→tobillo; ~180° = cuerpo alineado. */
export function lineAngle(lms: Pt[], shoulder: number, hip: number, ankle: number): number {
  return angleBetween(lms[shoulder]!, lms[hip]!, lms[ankle]!);
}

/** abs(hip.y - ankle.y) / dist(shoulder, hip): > 0.9 = tumbado. */
export function groundedRatio(lms: Pt[], hip: number, ankle: number): number {
  const h = lms[hip]!;
  const a = lms[ankle]!;
  const s = lms[INDICES.leftShoulder]!;
  return Math.abs(h.y - a.y) / Math.hypot(s.x - h.x, s.y - h.y);
}

/** Ángulo del torso contra la horizontal, en grados (0 = horizontal). */
export function torsoHorizontalAngle(lms: Pt[], shoulder: number, hip: number): number {
  const s = lms[shoulder]!;
  const h = lms[hip]!;
  return (Math.atan2(Math.abs(s.y - h.y), Math.abs(s.x - h.x)) * 180) / Math.PI;
}

/** (knee.y - hip.y) / torso: > 0.45 = se puso de pie (anti-pararse en abdominales). */
export function kneeStandingMargin(lms: Pt[], hip: number, knee: number): number {
  const h = lms[hip]!;
  const k = lms[knee]!;
  const s = lms[INDICES.leftShoulder]!;
  return (k.y - h.y) / Math.hypot(s.x - h.x, s.y - h.y);
}

/** Triángulo genérico por nombres de landmark, como `sides[].angle` del prototipo. */
export function angleByNames(lms: Pt[], tri: Triangle, side: SideKey): number {
  const idx = SIDE_IDX[side] as unknown as Record<string, number>;
  const pts = tri.map((name) => {
    const i = idx[name];
    return i === undefined ? null : (lms[i] ?? null);
  });
  if (pts.some((p) => p === null)) return 0;
  return angleBetween(pts[0]!, pts[1]!, pts[2]!);
}

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}

/** Ventana móvil simple, como el suavizado por frames del prototipo. */
export class RollingMean {
  private buf: number[] = [];

  constructor(private readonly size: number) {}

  push(v: number): number {
    this.buf.push(v);
    if (this.buf.length > this.size) this.buf.shift();
    return mean(this.buf);
  }

  reset(): void {
    this.buf = [];
  }
}

/** Autodetección de lado visible (votes de avgVis >= 0.4). */
export function resolveSide(lms: Pt[]): { side: 'left' | 'right' | null; buffer: number[] } {
  const left = avgVis(lms, [INDICES.leftShoulder, INDICES.leftHip, INDICES.leftAnkle]);
  const right = avgVis(lms, [INDICES.rightShoulder, INDICES.rightHip, INDICES.rightAnkle]);
  const buffer = [left, right];
  const winner: 'left' | 'right' = left >= right ? 'left' : 'right';
  const votes = buffer.filter((v) => v >= SIDE_AVG_VIS && v === Math.max(left, right)).length;
  return { side: votes >= SIDE_VOTES_NEEDED ? winner : null, buffer };
}

export type CalibResult = { restAngle: number; down: number; up: number } | null;

/** Calibración en reposo: 10 muestras con rango <= 9°. */
export function attemptCalibration(
  angle: number,
  buf: number[],
  cfg: { downDelta: number; upDelta: number; bridge?: boolean },
): { buf: number[]; calib: CalibResult } {
  const next = [...buf, angle];
  if (next.length > CALIB_WINDOW) next.shift();
  if (next.length < CALIB_WINDOW) return { buf: next, calib: null };
  const range = Math.max(...next) - Math.min(...next);
  if (range > CALIB_RANGE_MAX) return { buf: next, calib: null };
  const restAngle = mean(next);
  // Igual que camera-verification.html:934-936, el delta se RESTA al reposo
  // (la.flexión de codo/columna cierra el ángulo) y se suma solo en puente.
  if (cfg.bridge) {
    return {
      buf: next,
      calib: { restAngle, down: restAngle + cfg.downDelta, up: restAngle + cfg.upDelta },
    };
  }
  return {
    buf: next,
    calib: { restAngle, down: restAngle - cfg.downDelta, up: restAngle - cfg.upDelta },
  };
}

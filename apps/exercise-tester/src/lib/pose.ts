// Geometría de pose: mismas fórmulas y constantes que camera-verification.html
// (VIS=0.65, CALIB_WINDOW=10, CALIB_RANGE_MAX=9, buffers de suavizado).

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

/** Puntos que exige el prototipo en vista lateral por lado. */
export const LATERAL_POINTS = {
  flexiones: ['shoulder', 'elbow', 'wrist', 'hip', 'ankle'],
  abdominales: ['shoulder', 'hip', 'knee'],
  puente_gluteo: ['shoulder', 'hip', 'ankle'],
} as const;

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

/** Alineación de la rodilla contra el torso (para flexiones). */
export function kneeLineAngle(lms: Pt[], hip: number, knee: number): number {
  return angleBetween(lms[INDICES.leftHip]!, lms[hip]!, lms[knee]!);
}

/** Choque de rodilla contra el pecho (para abdominales). */
export function kneeChestApproach(lms: Pt[], hip: number, knee: number): number {
  return angleBetween(lms[knee]!, lms[hip]!, lms[INDICES.leftShoulder]!);
}

/** Plancha: espalda plana = línea hombro→cadera→tobillo cerca de 180. */
export function backFlatDeg(lms: Pt[], hip: number, ankle: number): number {
  return 180 - lineAngle(lms, INDICES.leftShoulder, hip, ankle);
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
  if (cfg.bridge) {
    return {
      buf: next,
      calib: { restAngle, down: restAngle - cfg.downDelta, up: restAngle - cfg.upDelta },
    };
  }
  return {
    buf: next,
    calib: { restAngle, down: restAngle + cfg.downDelta, up: restAngle - cfg.upDelta },
  };
}

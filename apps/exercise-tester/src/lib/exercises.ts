// Configuración de ejercicios copiada de la implementación vigente
// (camera-verification.html:609-764) y de apps/mobile/src/retos/catalog.ts,
// para que el tester arranque con los mismos umbrales que usa la app real y los
// ajustes se porten 1:1.
//
// Si tocás un número acá, cambialo también en camera-verification.html: el
// tester sirve para encontrar el valor, la app es la que manda.

export type ExerciseKind = 'dinamico' | 'isometrico';

export type ViewerSide = 'frontal' | 'lateral';

export type ExerciseUnit = 'reps' | 'seconds';

/** Triángulo de landmarks, con los mismos nombres que el prototipo. */
export type Triangle = readonly [string, string, string];

export type ExerciseConfig = {
  id: string;
  name: string;
  kind: ExerciseKind;
  /** 'reps' cuenta repeticiones; 'seconds' cuenta tiempo sostenido. */
  unit: ExerciseUnit;
  /**
   * Unidad declarada en apps/mobile/src/retos/catalog.ts. Si difiere de `unit`,
   * el motor y el catálogo no coinciden y el reporte lo deja asentado.
   */
  catalogUnit?: ExerciseUnit;
  /** 'frontal' o 'lateral': define el set de landmarks que hay que exigir. */
  side: ViewerSide;
  /** free o premium, igual que el catálogo de la app. */
  tier: 'free' | 'premium';
  /** Objetivo por defecto (catalog.ts: DEFAULT_TARGETS). */
  target: number;
  /** Perfil de conteo: angles = umbral absoluto; deltas = umbral vs calibración. */
  profile: 'angles' | 'deltas';
  /** Umbral de "abajo" (grading) en grados. */
  downThresh: number;
  /** Umbral de "arriba" (topping) en grados. */
  upThresh: number;
  /** Delta respecto de la calibración (perfil deltas). */
  downDelta: number;
  upDelta: number;
  /** Triángulo de la métrica (lateral). */
  angle?: Triangle;
  /** Triángulo de la rodilla, solo mountain_climbers. */
  knee?: Triangle;
  /**
   * Landmarks que el prototipo exige visibles por lado (`sides[].points`).
   * Es la lista real de completitud de la pose, no la del triángulo: puente
   * también pide el tobillo aunque no lo use en el ángulo.
   */
  points?: readonly string[];
  /** Umbral de pliegue de rodilla (mountain_climbers, :745). */
  kneeFold?: number;
  /** Umbral de línea hombro-cadera-tobillo en grados (alineación del cuerpo). */
  lineMin?: number;
  /** Ratio de cadera a tobillo sobre torso: > 0.9 = está tumbado (push-ups). */
  groundedMax?: number;
  /** (knee.y - hip.y) / torso: > 0.45 = se puso de pie (sit-ups). */
  standingKneeMargin?: number;
  /** Ángulo de torso horizontal en reposo; > esto = no está en posición. */
  restTorsoMax?: number;
  /** Invierte la lectura de "abajo" (puente: subir la cadera es bajar). */
  bridge?: boolean;
  /** Tipo de prueba de vida anti-video. */
  liveness: 'hand' | 'hold';
  /** Mensaje de la app cuando la postura no es válida. */
  postureMsg?: string;
  /** Mensaje de arranque (se muestra mientras calibra). */
  startMsg?: string;
};

export const EXERCISES: ExerciseConfig[] = [
  {
    id: 'sentadillas',
    name: 'Sentadillas',
    kind: 'dinamico',
    unit: 'reps',
    side: 'frontal',
    tier: 'free',
    target: 20,
    profile: 'angles',
    downThresh: 100,
    upThresh: 160,
    downDelta: 0,
    upDelta: 0,
    liveness: 'hand',
  },
  {
    id: 'flexiones',
    name: 'Flexiones',
    kind: 'dinamico',
    unit: 'reps',
    side: 'lateral',
    tier: 'free',
    target: 10,
    profile: 'deltas',
    downThresh: 0,
    upThresh: 0,
    downDelta: 40,
    upDelta: 12,
    angle: ['shoulder', 'elbow', 'wrist'],
    points: ['shoulder', 'elbow', 'wrist', 'hip', 'ankle'],
    lineMin: 150,
    groundedMax: 0.9,
    liveness: 'hold',
    postureMsg: 'Ponete en plancha horizontal para contar flexiones',
    startMsg: 'Extendé los brazos en plancha, quieto un segundo',
  },
  {
    id: 'abdominales',
    name: 'Abdominales',
    kind: 'dinamico',
    unit: 'reps',
    side: 'lateral',
    tier: 'free',
    target: 15,
    profile: 'deltas',
    downThresh: 0,
    upThresh: 0,
    downDelta: 25,
    upDelta: 10,
    angle: ['shoulder', 'hip', 'knee'],
    points: ['shoulder', 'hip', 'knee'],
    standingKneeMargin: 0.45,
    restTorsoMax: 35,
    liveness: 'hand',
    postureMsg: 'Recostate en el piso para contar abdominales — te detectamos de pie',
    startMsg: 'Recostate boca arriba, quieto un segundo',
  },
  {
    id: 'plancha',
    name: 'Plancha',
    kind: 'isometrico',
    unit: 'seconds',
    side: 'lateral',
    tier: 'premium',
    target: 30,
    profile: 'deltas',
    downThresh: 0,
    upThresh: 0,
    downDelta: 0,
    upDelta: 12,
    angle: ['shoulder', 'elbow', 'wrist'],
    points: ['shoulder', 'elbow', 'wrist', 'hip', 'ankle'],
    lineMin: 150,
    groundedMax: 0.9,
    liveness: 'hold',
    postureMsg: 'Pará en plancha con los brazos extendidos',
    startMsg: 'Entrá en plancha, quitá el cuerpo y aguantá',
  },
  {
    id: 'zancadas',
    name: 'Zancadas',
    kind: 'dinamico',
    unit: 'reps',
    side: 'frontal',
    tier: 'premium',
    target: 24,
    profile: 'angles',
    downThresh: 115,
    upThresh: 160,
    downDelta: 0,
    upDelta: 0,
    liveness: 'hand',
  },
  {
    id: 'puente_gluteo',
    name: 'Puente de glúteo',
    kind: 'dinamico',
    unit: 'reps',
    side: 'lateral',
    tier: 'premium',
    target: 15,
    profile: 'deltas',
    downThresh: 0,
    upThresh: 0,
    downDelta: 28,
    upDelta: 10,
    bridge: true,
    angle: ['shoulder', 'hip', 'knee'],
    points: ['shoulder', 'hip', 'knee', 'ankle'],
    restTorsoMax: 38,
    liveness: 'hand',
    postureMsg: 'Recostate boca arriba con las rodillas flexionadas',
    startMsg: 'Recostate boca arriba, quieto un segundo',
  },
  {
    id: 'mountain_climbers',
    name: 'Mountain Climbers',
    kind: 'dinamico',
    // DISCREPANCIA CONOCIDA: camera-verification.html:723 declara unit:'reps' y
    // cuenta una rep por rodilla al pecho, pero apps/mobile/src/retos/catalog.ts:20
    // declara unit:'seconds'. Acá va 'reps' porque el tester reproduce el motor
    // real; el reporte lo marca como diferencia contra el catálogo.
    unit: 'reps',
    catalogUnit: 'seconds',
    side: 'lateral',
    tier: 'premium',
    target: 30,
    profile: 'angles',
    downThresh: 0,
    upThresh: 0,
    downDelta: 0,
    upDelta: 0,
    knee: ['hip', 'knee', 'ankle'],
    points: ['shoulder', 'elbow', 'wrist', 'hip', 'ankle'],
    kneeFold: 105,
    lineMin: 150,
    groundedMax: 0.9,
    liveness: 'hand',
    postureMsg: 'Pará en plancha apoyando las manos',
    startMsg: 'Entrá en plancha para arrancar',
  },
  {
    id: 'sentadilla_isometrica',
    name: 'Sentadilla isométrica',
    kind: 'isometrico',
    unit: 'seconds',
    side: 'frontal',
    tier: 'premium',
    target: 25,
    profile: 'angles',
    downThresh: 100,
    upThresh: 160,
    downDelta: 0,
    upDelta: 0,
    liveness: 'hand',
  },
];

/** Los 3 free, en el orden de la app (catalog.ts:41). */
export const FREE_EXERCISE_IDS = ['sentadillas', 'flexiones', 'abdominales'] as const;

export type FreeExerciseId = (typeof FREE_EXERCISE_IDS)[number];

export function exerciseById(id: string): ExerciseConfig | null {
  return EXERCISES.find((e) => e.id === id) ?? null;
}

/**
 * Si el ejercicio exige "quedate quieto" para calibrar antes de contar.
 * - perfil 'deltas': umbrales relativos al reposo (flexiones, abdominales,
 *   puente, plancha)
 * - mountain_climbers: calibra con deltas 0/0 solo para confirmar la postura
 *   (camera-verification.html:1597-1607)
 * - todo ejercicio en segundos: pide calibración antes de arrancar aunque
 *   use umbrales fijos (camera-verification.html:1435-1449)
 */
export function needsCalibration(cfg: ExerciseConfig): boolean {
  return cfg.profile === 'deltas' || cfg.kneeFold !== undefined || cfg.unit === 'seconds';
}

/** Cadencia objetivo en segundos por rep (catalog.ts: REP_CADENCE). */
export const REP_CADENCE: Record<string, number> = {
  sentadillas: 5,
  flexiones: 5,
  abdominales: 3,
};

export function cadenceSec(id: string): number | null {
  return REP_CADENCE[id] ?? null;
}

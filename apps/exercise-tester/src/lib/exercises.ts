// Configuración de ejercicios copiada de la implementación vigente
// (camera-verification.html:609-764) para que el tester arranque con los mismos
// umbrales que usa la app real y los ajustes se porten 1:1.
//
// Si tocás un número acá, cambialo también en camera-verification.html: el
// tester sirve para encontrar el valor, la app es la que manda.

export type ExerciseKind = 'dinamico' | 'isometrico';

export type ViewerSide = 'frontal' | 'lateral';

export type ExerciseConfig = {
  id: string;
  name: string;
  kind: ExerciseKind;
  /** 'frontal' o 'lateral': define el set de landmarks que hay que exigir. */
  side: ViewerSide;
  /** Objetivo por defecto para probar (spec móvil). */
  target: number;
  /** Perfil de conteo: angles = flexión de cadera; deltas = delta vs calibración. */
  profile: 'angles' | 'deltas';
  /** Umbral de "abajo" (grading) en grados. */
  downThresh: number;
  /** Umbral de "arriba" (topping) en grados. */
  upThresh: number;
  /** Delta respecto de la calibración (perfil deltas). */
  downDelta: number;
  upDelta: number;
  /** Umbral de línea hombro-cadera-tobillo en grados (alineación del cuerpo). */
  lineMin?: number;
  /** Ratio de cadera a Tobillo sobre torso: > 0.9 = está tumbado (push-ups). */
  groundedMax?: number;
  /** (knee.y - hip.y) / torso: > 0.45 = se puso de pie (sit-ups). */
  standingKneeMargin?: number;
  /** Ángulo de torso horizontal en reposo; > esto = no está en posición. */
  restTorsoMax?: number;
  /** Umbral de espalda plana en puente de glúteos. */
  backFlatMax?: number;
  /** Invierte la lectura de "abajo" (puente: subir la cadera es bajar). */
  bridge?: boolean;
  /** Tipo de prueba de vida anti-video. */
  liveness: 'hand' | 'hold';
};

export const EXERCISES: ExerciseConfig[] = [
  {
    id: 'sentadillas',
    name: 'Sentadillas',
    kind: 'dinamico',
    side: 'frontal',
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
    side: 'lateral',
    target: 10,
    profile: 'deltas',
    downThresh: 0,
    upThresh: 0,
    downDelta: 40,
    upDelta: 12,
    lineMin: 150,
    groundedMax: 0.9,
    liveness: 'hold',
  },
  {
    id: 'abdominales',
    name: 'Abdominales',
    kind: 'dinamico',
    side: 'lateral',
    target: 15,
    profile: 'deltas',
    downThresh: 0,
    upThresh: 0,
    downDelta: 25,
    upDelta: 10,
    standingKneeMargin: 0.45,
    restTorsoMax: 35,
    liveness: 'hand',
  },
];

export const FREE_EXERCISE_IDS = ['sentadillas', 'flexiones', 'abdominales'] as const;

export type FreeExerciseId = (typeof FREE_EXERCISE_IDS)[number];

export function exerciseById(id: string): ExerciseConfig | null {
  return EXERCISES.find((e) => e.id === id) ?? null;
}

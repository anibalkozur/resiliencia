// Catálogo del banco de pruebas.
//
// Mismos ids, unidades, tiers y objetivos por defecto que la app real
// (apps/mobile/src/retos/catalog.ts). El conteo y los umbrales NO se replican
// acá: viven en camera-verification.html, que es la página que el banco carga
// tal cual la carga la app.

export type ExerciseUnit = 'reps' | 'seconds';

export type ExerciseInfo = {
  id: string;
  name: string;
  /** Unidad del motor productivo (CFG en camera-verification.html). */
  unit: ExerciseUnit;
  /**
   * Unidad declarada en apps/mobile/src/retos/catalog.ts cuando difiere de
   * `unit`. Si está, el informe lo marca como discrepancia al portar.
   */
  catalogUnit?: ExerciseUnit;
  tier: 'free' | 'premium';
  /** Objetivo por defecto (catalog.ts: DEFAULT_TARGETS). */
  target: number;
  /**
   * Paso del selector de objetivo. Por defecto 1 (reps) o 5 (segundos).
   * Zancadas usa 2 para que el objetivo sea siempre par y se trabajen las dos
   * piernas la misma cantidad.
   */
  step?: number;
  liveness: 'hand' | 'hold';
};

export const EXERCISES: ExerciseInfo[] = [
  {
    id: 'sentadillas',
    name: 'Sentadillas',
    unit: 'reps',
    tier: 'free',
    target: 20,
    liveness: 'hand',
  },
  { id: 'flexiones', name: 'Flexiones', unit: 'reps', tier: 'free', target: 10, liveness: 'hold' },
  {
    id: 'abdominales',
    name: 'Abdominales',
    unit: 'reps',
    tier: 'free',
    target: 15,
    liveness: 'hand',
  },
  {
    id: 'elevacion_piernas',
    name: 'Elevación de piernas',
    unit: 'reps',
    tier: 'premium',
    target: 15,
    liveness: 'hand',
  },
  {
    id: 'plancha',
    name: 'Plancha',
    unit: 'seconds',
    tier: 'premium',
    target: 30,
    liveness: 'hold',
  },
  {
    id: 'zancadas',
    name: 'Zancadas',
    unit: 'reps',
    tier: 'premium',
    target: 24,
    step: 2,
    liveness: 'hand',
  },
  {
    id: 'puente_gluteo',
    name: 'Puente de glúteo',
    unit: 'reps',
    tier: 'premium',
    target: 15,
    liveness: 'hand',
  },
  {
    id: 'mountain_climbers',
    name: 'Mountain Climbers',
    // camera-verification.html declara reps y cuenta una rep por rodilla al
    // pecho; catalog.ts declara seconds. El banco reproduce el motor (reps) y
    // lo marca como discrepancia.
    unit: 'reps',
    catalogUnit: 'seconds',
    tier: 'premium',
    target: 30,
    liveness: 'hand',
  },
  {
    id: 'sentadilla_isometrica',
    name: 'Sentadilla isométrica',
    unit: 'seconds',
    tier: 'premium',
    target: 25,
    liveness: 'hand',
  },
  {
    id: 'zancada_reversa',
    name: 'Zancada reversa',
    unit: 'reps',
    tier: 'premium',
    target: 20,
    step: 2,
    liveness: 'hand',
  },
  {
    id: 'zancada_lateral',
    name: 'Zancada lateral',
    unit: 'reps',
    tier: 'premium',
    target: 16,
    step: 2,
    liveness: 'hand',
  },
  {
    id: 'sentadilla_bulgara',
    name: 'Sentadilla búlgara',
    unit: 'reps',
    tier: 'premium',
    target: 12,
    liveness: 'hand',
  },
  {
    id: 'patada_gluteo',
    name: 'Patada de glúteo',
    unit: 'reps',
    tier: 'premium',
    target: 20,
    step: 2,
    liveness: 'hand',
  },
  {
    id: 'elevacion_lateral_pierna',
    name: 'Elevación lateral de pierna',
    unit: 'reps',
    tier: 'premium',
    target: 15,
    liveness: 'hand',
  },
  {
    id: 'flexion_rodillas',
    name: 'Flexión de rodillas',
    unit: 'reps',
    tier: 'premium',
    target: 12,
    liveness: 'hold',
  },
  {
    id: 'flexion_declinada',
    name: 'Flexión declinada',
    unit: 'reps',
    tier: 'premium',
    target: 10,
    liveness: 'hold',
  },
  {
    id: 'flexion_pica',
    name: 'Flexión pica',
    unit: 'reps',
    tier: 'premium',
    target: 8,
    liveness: 'hold',
  },
  {
    id: 'fondos_silla',
    name: 'Fondos en silla',
    unit: 'reps',
    tier: 'premium',
    target: 12,
    liveness: 'hand',
  },
  { id: 'superman', name: 'Superman', unit: 'reps', tier: 'premium', target: 15, liveness: 'hand' },
  {
    id: 'encogimiento_inverso',
    name: 'Encogimiento inverso',
    unit: 'reps',
    tier: 'premium',
    target: 15,
    liveness: 'hand',
  },
  {
    id: 'encogimiento_bicicleta',
    name: 'Encogimiento bicicleta',
    unit: 'reps',
    tier: 'premium',
    target: 20,
    liveness: 'hand',
  },
  { id: 'burpee', name: 'Burpee', unit: 'reps', tier: 'premium', target: 10, liveness: 'hand' },
  {
    id: 'rodillas_altas',
    name: 'Rodillas altas',
    unit: 'reps',
    tier: 'premium',
    target: 30,
    liveness: 'hand',
  },
];

/** Los 3 free, en el orden de la app. */
export const FREE_EXERCISE_IDS = ['sentadillas', 'flexiones', 'abdominales'] as const;

export function exerciseById(id: string): ExerciseInfo | null {
  return EXERCISES.find((e) => e.id === id) ?? null;
}

/**
 * Un ejercicio cualquiera, para cuando un id no está en el catálogo: la pantalla
 * de prueba siempre tiene algo que cargar.
 */
export const FIRST_EXERCISE: ExerciseInfo = EXERCISES[0] ?? {
  id: 'sentadillas',
  name: 'Sentadillas',
  unit: 'reps',
  tier: 'free',
  target: 20,
  liveness: 'hand',
};

/** Cadencia objetivo en segundos por rep (catalog.ts: REP_CADENCE). */
export const REP_CADENCE: Record<string, number> = {
  sentadillas: 5,
  flexiones: 5,
  abdominales: 3,
};

export function cadenceSec(id: string): number | null {
  return REP_CADENCE[id] ?? null;
}

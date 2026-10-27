import type { VisualModel } from '../repo';

const EXERCISE_ART: Record<string, Record<VisualModel, number>> = {
  sentadillas: {
    mujer: require('../../assets/exercises/sentadillas-mujer.png'),
    hombre: require('../../assets/exercises/sentadillas-hombre.png'),
  },
  flexiones: {
    mujer: require('../../assets/exercises/flexiones-mujer.png'),
    hombre: require('../../assets/exercises/flexiones-hombre.png'),
  },
  abdominales: {
    mujer: require('../../assets/exercises/abdominales-mujer.png'),
    hombre: require('../../assets/exercises/abdominales-hombre.png'),
  },
  plancha: {
    mujer: require('../../assets/exercises/plancha-mujer.png'),
    hombre: require('../../assets/exercises/plancha-hombre.png'),
  },
  zancadas: {
    mujer: require('../../assets/exercises/zancadas-mujer.png'),
    hombre: require('../../assets/exercises/zancadas-hombre.png'),
  },
  puente_gluteo: {
    mujer: require('../../assets/exercises/puente-gluteo-mujer.png'),
    hombre: require('../../assets/exercises/puente-gluteo-hombre.png'),
  },
  mountain_climbers: {
    mujer: require('../../assets/exercises/mountain-climbers-mujer.png'),
    hombre: require('../../assets/exercises/mountain-climbers-hombre.png'),
  },
  sentadilla_isometrica: {
    mujer: require('../../assets/exercises/sentadilla-isometrica-mujer.png'),
    hombre: require('../../assets/exercises/sentadilla-isometrica-hombre.png'),
  },
  fondos_silla: {
    mujer: require('../../assets/exercises/fondos-silla-mujer.png'),
    hombre: require('../../assets/exercises/fondos-silla-hombre.png'),
  },
};

export function exerciseArt(exerciseId: string, visualModel: VisualModel): number | undefined {
  return EXERCISE_ART[exerciseId]?.[visualModel];
}

// Guia de tecnica por ejercicio, extraida de la tabla HOWTO de
// camera-verification.html (que es la que se muestra en pantalla).
//
// Vive aca tambien porque el chat es React Native y no puede leer el HTML. Si
// se toca una guia, se toca en los dos lados.
//
// `resumen` son las dos primeras frases: lo que tiene que CABER en una
// locucion. La guia completa es demasiado larga para hablar y recien ahi
// empieza "cada bajada cuenta como 1", que ya lo dice el contador de la pagina.

export type Tecnica = {
  /** Texto largo, para pantalla. */
  guia: string;
  /** Texto corto, para hablar. */
  resumen: string;
};

export const TECNICA: Record<string, Tecnica> = {
  sentadillas: {
    guia: 'Parate derecho frente a la cámara con los pies al ancho de los hombros. Bajá llevando la cadera hacia atrás hasta que tus rodillas queden cerca de 90° y volvé a subir. Cada bajada y subida completa cuenta como 1.',
    resumen:
      'Parate derecho frente a la cámara con los pies al ancho de los hombros. Bajá llevando la cadera hacia atrás hasta que tus rodillas queden cerca de 90° y volvé a subir.',
  },
  flexiones: {
    guia: 'Apoyá las manos a la altura de los hombros y estirá el cuerpo en plancha. Bajá el pecho doblando los codos hasta casi tocar el piso y volvé arriba empujando. Mantené el cuerpo recto todo el tiempo. Para arrancar, ponete en cuclillas listo para tomar la posición de plancha: tenés 10 segundos para hacer la primera flexión.',
    resumen:
      'Apoyá las manos a la altura de los hombros y estirá el cuerpo en plancha. Bajá el pecho doblando los codos hasta casi tocar el piso y volvé arriba empujando.',
  },
  abdominales: {
    guia: 'Recostate boca arriba con las rodillas flexionadas y los pies apoyados. Llevá el pecho hacia las rodillas contrayendo el abdomen y volvé a apoyar la espalda. Cada subida completa cuenta como 1.',
    resumen:
      'Recostate boca arriba con las rodillas flexionadas y los pies apoyados. Llevá el pecho hacia las rodillas contrayendo el abdomen y volvé a apoyar la espalda.',
  },
  plancha: {
    guia: 'Pará en plancha con los brazos extendidos y el cuerpo formando una línea recta de la cabeza a los pies. Mantené la posición sin bajar la cadera hasta completar el tiempo.',
    resumen:
      'Pará en plancha con los brazos extendidos y el cuerpo formando una línea recta de la cabeza a los pies. Mantené la posición sin bajar la cadera hasta completar el tiempo.',
  },
  zancadas: {
    guia: 'Ponete de perfil a la cámara, mirando hacia un costado. Da un paso largo hacia adelante y bajá flexionando las rodillas hasta cerca de 90°; volvé a subir y repetí alternando la pierna. Cada subida completa cuenta como 1.',
    resumen:
      'Ponete de perfil a la cámara, mirando hacia un costado. Da un paso largo hacia adelante y bajá flexionando las rodillas hasta cerca de 90°; volvé a subir y repetí alternando la pierna.',
  },
  puente_gluteo: {
    guia: 'Recostate boca arriba con las rodillas flexionadas y los pies apoyados. Elevá la cadera apretando los glúteos, mantené un segundo y bajá hasta apoyarla. Cada subida cuenta como 1.',
    resumen:
      'Recostate boca arriba con las rodillas flexionadas y los pies apoyados. Elevá la cadera apretando los glúteos, mantené un segundo y bajá hasta apoyarla.',
  },
  mountain_climbers: {
    guia: 'Ponete de perfil a la cámara (de costado), en plancha apoyando las manos. Llevá una rodilla rápido al pecho y volvé, alternando las piernas en ritmo continuo. Cada rodilla al pecho cuenta como 1.',
    resumen:
      'Ponete de perfil a la cámara (de costado), en plancha apoyando las manos. Llevá una rodilla rápido al pecho y volvé, alternando las piernas en ritmo continuo.',
  },
  sentadilla_isometrica: {
    guia: 'Parate derecho y bajá a una sentadilla hasta que tus rodillas queden cerca de 90°. Mantené la posición sin subir hasta completar el tiempo.',
    resumen:
      'Parate derecho y bajá a una sentadilla hasta que tus rodillas queden cerca de 90°. Mantené la posición sin subir hasta completar el tiempo.',
  },
};
// Guia de tecnica por ejercicio, extraida de la tabla HOWTO de
// camera-verification-bench.html (que es la que se muestra en pantalla).
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
  elevacion_piernas: {
    guia: 'Recostate boca arriba con las piernas extendidas y los brazos a los costados. Mantené la espalda baja apoyada y elevá las piernas rectas hasta que queden perpendiculares al torso; bajalas con control sin tocar el piso. Cada subida completa cuenta como 1.',
    resumen:
      'Recostate boca arriba con las piernas extendidas y los brazos a los costados. Mantené la espalda baja apoyada y elevá las piernas rectas hasta que queden perpendiculares al torso; bajalas con control sin tocar el piso.',
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
  zancada_reversa: {
    guia: 'Ponete de perfil a la cámara, mirando hacia un costado. Da un paso largo hacia atrás y bajá flexionando las rodillas hasta cerca de 90°; volvé a subir y repetí alternando la pierna. Cada subida completa cuenta como 1.',
    resumen:
      'Ponete de perfil a la cámara, mirando hacia un costado. Da un paso largo hacia atrás y bajá flexionando las rodillas hasta cerca de 90°; volvé a subir y repetí alternando la pierna.',
  },
  zancada_lateral: {
    guia: 'Ponete de perfil (o levemente de costado) a la cámara. Da un paso amplio hacia un costado y bajá flexionando esa rodilla mientras la otra pierna queda estirada; volvé al centro. Cada bajada y subida cuenta como 1.',
    resumen:
      'Ponete de perfil (o levemente de costado) a la cámara. Da un paso amplio hacia un costado y bajá flexionando esa rodilla mientras la otra pierna queda estirada; volvé al centro.',
  },
  sentadilla_bulgara: {
    guia: 'Ponete de perfil a la cámara con el empeine del pie de atrás apoyado en una silla. Bajá flexionando la pierna de adelante hasta cerca de 90° y volvé a subir. Cada subida completa cuenta como 1.',
    resumen:
      'Ponete de perfil a la cámara con el empeine del pie de atrás apoyado en una silla. Bajá flexionando la pierna de adelante hasta cerca de 90° y volvé a subir.',
  },
  patada_gluteo: {
    guia: 'Ponete en cuadrupedia de perfil a la cámara (manos y rodillas apoyadas). Mantené la rodilla flexionada y llevá el pie hacia arriba y atrás apretando el glúteo; volvé sin apoyar. Cada patada cuenta como 1.',
    resumen:
      'Ponete en cuadrupedia de perfil a la cámara (manos y rodillas apoyadas). Mantené la rodilla flexionada y llevá el pie hacia arriba y atrás apretando el glúteo; volvé sin apoyar.',
  },
  elevacion_lateral_pierna: {
    guia: 'Recostate de costado mirando a la cámara, con las piernas juntas y estiradas. Elevá la pierna de arriba sin mover la cadera y bajala con control. Cada elevación cuenta como 1.',
    resumen:
      'Recostate de costado mirando a la cámara, con las piernas juntas y estiradas. Elevá la pierna de arriba sin mover la cadera y bajala con control.',
  },
  flexion_rodillas: {
    guia: 'Apoyá las rodillas en el piso y las manos a la altura de los hombros. Mantené el cuerpo recto desde la cabeza hasta las rodillas, bajá doblando los codos y volvé a subir. Cada flexión completa cuenta como 1.',
    resumen:
      'Apoyá las rodillas en el piso y las manos a la altura de los hombros. Mantené el cuerpo recto desde la cabeza hasta las rodillas, bajá doblando los codos y volvé a subir.',
  },
  flexion_declinada: {
    guia: 'Ponete de perfil en plancha con los pies elevados sobre una silla y las manos en el piso. Bajá el pecho doblando los codos y volvé a subir manteniendo el cuerpo recto. Cada flexión completa cuenta como 1.',
    resumen:
      'Ponete de perfil en plancha con los pies elevados sobre una silla y las manos en el piso. Bajá el pecho doblando los codos y volvé a subir manteniendo el cuerpo recto.',
  },
  flexion_pica: {
    guia: 'Ponete de perfil con las manos y los pies en el piso y la cadera bien alta (V invertida). Bajá la cabeza doblando los codos y volvé a subir. Cada flexión cuenta como 1.',
    resumen:
      'Ponete de perfil con las manos y los pies en el piso y la cadera bien alta (V invertida). Bajá la cabeza doblando los codos y volvé a subir.',
  },
  fondos_silla: {
    guia: 'Ponete de perfil a la cámara sentado al borde de una silla, con las manos apoyadas en el borde por detrás. Bajá la cadera flexionando los codos y volvé a subir. Cada fondo cuenta como 1.',
    resumen:
      'Ponete de perfil a la cámara sentado al borde de una silla, con las manos apoyadas en el borde por detrás. Bajá la cadera flexionando los codos y volvé a subir.',
  },
  superman: {
    guia: 'Recostate boca abajo con brazos y piernas extendidos. Elevá al mismo tiempo brazos y piernas del piso apretando la espalda baja y bajá con control. Cada elevación cuenta como 1.',
    resumen:
      'Recostate boca abajo con brazos y piernas extendidos. Elevá al mismo tiempo brazos y piernas del piso apretando la espalda baja y bajá con control.',
  },
  encogimiento_inverso: {
    guia: 'Recostate boca arriba con las rodillas flexionadas sobre la cadera. Llevá las rodillas hacia el pecho despegando la cadera del piso y bajá con control. Cada subida cuenta como 1.',
    resumen:
      'Recostate boca arriba con las rodillas flexionadas sobre la cadera. Llevá las rodillas hacia el pecho despegando la cadera del piso y bajá con control.',
  },
  encogimiento_bicicleta: {
    guia: 'Recostate boca arriba con las manos en la nuca. Llevá el codo hacia la rodilla opuesta alternando, como pedaleando. Cada vez que llevás un codo a la rodilla contraria cuenta como 1.',
    resumen:
      'Recostate boca arriba con las manos en la nuca. Llevá el codo hacia la rodilla opuesta alternando, como pedaleando.',
  },
  burpee: {
    guia: 'Ponete de perfil a la cámara. De parado, bajá a apoyar las manos, pateá los pies hacia atrás a plancha, hacé una flexión, volvé con los pies a las manos y saltá arriba. Cada repetición completa cuenta como 1.',
    resumen:
      'Ponete de perfil a la cámara. De parado, bajá a apoyar las manos, pateá los pies hacia atrás a plancha, hacé una flexión, volvé con los pies a las manos y saltá arriba.',
  },
  rodillas_altas: {
    guia: 'Ponete de perfil a la cámara, parado. Corré en el lugar elevando las rodillas a la altura de la cadera, alternando las piernas. Cada rodilla que sube cuenta como 1.',
    resumen:
      'Ponete de perfil a la cámara, parado. Corré en el lugar elevando las rodillas a la altura de la cadera, alternando las piernas.',
  },
};

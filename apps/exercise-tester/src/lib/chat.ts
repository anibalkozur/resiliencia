//Dominio del chat del entrenador, en el banco de pruebas.
//
// Acá NO hay modelo todavía. Es un resolvedor de intenciones sobre un dominio
// cerrado: la app, los ejercicios, los modos de ejecución y los datos del
// perfil. Todo lo que responde sale de este archivo, así que no puede inventar
// ni dar consejo de salud.
//
// Las tres reglas que NO son negociables, y que están coded acá para que no
// dependan de que el modelo se porte bien:
//
// 1. Puerta de edad: si la edad es menor a 18 el chat no responde nada del
//    perfil ni entra en modo libre. Un modelo chico no es quien decide esto.
// 2. Los datos del perfil no se hablan: van en texto. El TTS de Android por
//    defecto es el de Google, que es cloud, y decir "pesás 84 kilos" por ahí
//    manda el dato fuera del teléfono aunque el modelo sea local.
// 3. El perfil no genera consejo. Puede LEER un dato si lo piden; no puede
//    derivar una recomendación de peso, edad u objetivo.

import { EXERCISES } from './exercises';
import { TECNICA } from './tecnica';

export type Nivel = 'principiante' | 'intermedio' | 'avanzado';

export interface UserProfile {
  nombre: string;
  edad: number;
  pesoKg: number;
  alturaCm: number;
  objetivo: string;
  nivel: Nivel;
}

// Perfil falso para probar el chat sin una cuenta real. El banco es un
// laboratorio: estos valores no salen de ninguna base.
export const PERFIL_FALSO: UserProfile = {
  nombre: 'Aníbal',
  edad: 34,
  pesoKg: 84,
  alturaCm: 178,
  objetivo: 'Bajar 6 kilos y mejorar la resistencia',
  nivel: 'intermedio',
};

// Copia con edad de menor, para probar la puerta sin tocar el perfil principal.
export const PERFIL_MENOR: UserProfile = { ...PERFIL_FALSO, edad: 13 };

export const EDAD_MINIMA = 18;

export type Intent =
  | 'saludo'
  | 'como_empezar'
  | 'como_reiniciar'
  | 'que_ejercicios'
  | 'como_hacer_ejercicio'
  | 'modos'
  | 'prueba_vida'
  | 'voz'
  | 'perfil_dato'
  | 'perfil_consejo'
  | 'para_que_sirve'
  | 'fuera_de_dominio'
  | 'menor_de_edad';

export interface ChatReply {
  texto: string;
  /** false si el texto va solo en pantalla: no se manda al TTS. */
  habla: boolean;
  intencion: Intent;
  /** Marca de que esta respuesta NO la generó el modelo. */
  regla: true;
}

/** Campos del perfil que la IA puede leer en voz alta si se los piden. */
export const CAMPOS_PERFIL = ['nombre', 'edad', 'peso', 'altura', 'objetivo', 'nivel'] as const;

export type CampoPerfil = (typeof CAMPOS_PERFIL)[number];

function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[¿?¡!.,;]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const contiene = (n: string, ...palabras: string[]) => palabras.some((p) => n.includes(p));

function datoPerfil(perfil: UserProfile, campo: CampoPerfil): string {
  switch (campo) {
    case 'nombre':
      return `Te llamás ${perfil.nombre}.`;
    case 'edad':
      return `Tenés ${perfil.edad} años.`;
    case 'peso':
      return `Pesás ${perfil.pesoKg} kilos.`;
    case 'altura':
      return `Mirá ${perfil.alturaCm} centímetros.`;
    case 'objetivo':
      return `Tu objetivo es: ${perfil.objetivo}.`;
    case 'nivel':
      return `Estás en el nivel ${perfil.nivel}.`;
  }
}

function buscarCampo(n: string): CampoPerfil | null {
  // Nombre
  if (contiene(n, 'como me llamo', 'mi nombre', 'cual es mi nombre', 'quien soy yo')) {
    return 'nombre';
  }
  // Edad
  if (
    contiene(
      n,
      'mi edad',
      'cuantos anos tengo',
      'cuantos años tengo',
      'que edad tengo',
      'cuanta edad tengo',
    )
  ) {
    return 'edad';
  }
  // Peso: exige referencia explícita al usuario. NO matchea "cuánto pesa un X".
  if (
    contiene(
      n,
      'mi peso',
      'cuanto peso tengo',
      'cuantos kilos peso',
      'cuantos kilos tengo',
      'cuanto estoy pesando',
      'cuantos kilos estoy pesando',
      'peso tengo',
    )
  ) {
    return 'peso';
  }
  // Altura: 'mido' es primera persona. No incluye 'mide' (tercera).
  if (
    contiene(
      n,
      'mi altura',
      'que altura tengo',
      'cual es mi altura',
      'cuanto mido',
      'cuantos centimetros mido',
      'cuantos cm mido',
      'cuantos centimetros tengo',
      'cuantos cm tengo',
    )
  ) {
    return 'altura';
  }
  // Objetivo/meta
  if (
    contiene(
      n,
      'mi objetivo',
      'mi meta',
      'cual es mi objetivo',
      'que objetivo tengo',
      'para que entreno yo',
      'cual es mi meta',
    )
  ) {
    return 'objetivo';
  }
  // Nivel
  if (contiene(n, 'mi nivel', 'que nivel tengo', 'cual es mi nivel', 'en que nivel estoy')) {
    return 'nivel';
  }
  return null;
}
/**
 * Ficha de un ejercicio. Responde lo que un usuario que todavía no eligió
 * reps necesita: cómo se hace la posición, cómo arranca, cómo da la señal de
 * vida y cómo reinicia.
 *
 * NO dice cuántas reps, porque en la pantalla de selección todavía no se
 * eligieron, y NO dice el tier: "premium" es jerga de la app, no información
 * para alguien que pregunta cómo se hace una sentadilla.
 */
function fichaEjercicio(n: string, ranked: boolean): ChatReply | null {
  const ejercicio = EXERCISES.find(
    (e) => normalizar(e.name).includes(n) || n.includes(normalizar(e.name)),
  );
  if (!ejercicio) return null;
  const tec = TECNICA[ejercicio.id];
  const posicion = tec ? tec.resumen : `${ejercicio.name}: no hay guía cargada.`;
  const segundos = ejercicio.unit === 'seconds';

  const arranque =
    'Para arrancar, levantá la mano arriba de la cabeza y esperá la cuenta de 5 a 1.';
  const vida =
    ranked && !segundos
      ? 'Con la prueba de vida activada tenés que llegar a 6 segundos entre reps y el sistema te avisa cada 12 segundos levantando la mano.'
      : segundos
        ? 'Como es un ejercicio por tiempo, no hay cuenta de reps ni límite de segundos entre repeticiones.'
        : 'No hay límite de tiempo entre repeticiones en este modo.';
  const cierre =
    'Cuando termines, volvés a levantar la mano: pasa al siguiente ejercicio de la secuencia, o repetís este si era el único.';

  const texto =
    `${ejercicio.name}. ${posicion} ${arranque} ${vida} ${cierre}` +
    (segundos ? ' Mientras lo aguantás no te hablo: la fonación rompe la postura.' : '');

  return { texto, habla: true, intencion: 'como_hacer_ejercicio', regla: true };
}

/** Mismas tres cosas (arranque, vida, cierre) sin nombre de ejercicio. */
function guiaEjercicio(ranked: boolean): string {
  return (
    'Para arrancar cualquier ejercicio, levantá la mano arriba de la cabeza y esperá la cuenta de 5 a 1. ' +
    (ranked
      ? 'Con la prueba de vida activada tenés que llegar a 6 segundos entre reps y te avisa cada 12 segundos. '
      : 'En verificación simple no hay límite de tiempo entre repeticiones. ') +
    'Cuando termines, levantás la mano otra vez para pasar al siguiente o para repetir.'
  );
}

const MENOR =
  'Esta conversación está disponible a partir de los 18 años. ' +
  'Puedo igual responderte cómo se usa la app si querés.';

/**
 * Resuelve una entrada. Devuelve siempre una respuesta de regla: cuando el
 * modelo esté conectado, esta función pasa a ser el fallback y la validación.
 */
export function responder(
  entrada: string,
  perfil: UserProfile = PERFIL_FALSO,
  ranked = false,
): ChatReply {
  const n = normalizar(entrada);
  const menor = perfil.edad < EDAD_MINIMA;

  // 1. Puerta de edad: se evalúa antes que todo lo demás.
  if (menor) {
    return { texto: MENOR, habla: true, intencion: 'menor_de_edad', regla: true };
  }

  // 2. Pedir un dato del perfil: se LEE y ahora también se habla.
  const campo = buscarCampo(n);
  if (campo) {
    return {
      texto: datoPerfil(perfil, campo),
      habla: true,
      intencion: 'perfil_dato',
      regla: true,
    };
  }

  // 3. Pedir consejo a partir del perfil: se rechaza siempre.
  if (
    contiene(
      n,
      'deberia',
      'me conviene',
      'me recomendas',
      'que hago con mi peso',
      'cuanto tengo que bajar',
    )
  ) {
    return {
      texto:
        'Eso lo hablamos con quien te pueda dar indicaciones de salud, no conmigo. ' +
        'Yo te puedo explicar cómo se usa la app y cómo se hace cada ejercicio.',
      habla: true,
      intencion: 'perfil_consejo',
      regla: true,
    };
  }

  // 4. Ficha de ejercicio.
  const ficha = fichaEjercicio(n, ranked);
  if (ficha) return ficha;

  // 5. Intenciones del dominio.
  if (contiene(n, 'hola', 'buenas', 'que tal')) {
    return {
      texto: `Hola ${perfil.nombre}. Preguntame cómo se hace un ejercicio o cómo funciona la app.`,
      habla: true,
      intencion: 'saludo',
      regla: true,
    };
  }
  if (
    contiene(
      n,
      'como empiezo',
      'como arranco',
      'como empiezo',
      'que hago primero',
      'como arranco el ejercicio',
      'como se empieza',
    )
  ) {
    return {
      texto:
        'Elegís hasta 8 ejercicios, les ajustás las reps, los ordenás y tocás Iniciar. ' +
        guiaEjercicio(ranked),
      habla: true,
      intencion: 'como_empezar',
      regla: true,
    };
  }
  if (contiene(n, 'como reinicio', 'como repito', 'como vuelvo a empezar', 'reiniciar la serie')) {
    return {
      texto:
        'Con la mano. Cuando terminás levantás la mano arriba de la cabeza y el sistema ' +
        'entiende que querés seguir: pasa al siguiente ejercicio de la secuencia, o empezás de nuevo ' +
        'el mismo si era el único. Si la serie se rompe por una pausa larga, la misma mano reintenta ese ejercicio.',
      habla: true,
      intencion: 'como_reiniciar',
      regla: true,
    };
  }
  if (contiene(n, 'que ejercicios hay', 'que hay', 'cuales son los ejercicios', 'lista')) {
    const libres = EXERCISES.filter((e) => e.tier === 'free');
    const pago = EXERCISES.filter((e) => e.tier === 'premium');
    return {
      texto:
        `Tenés ${EXERCISES.length} ejercicios: ${libres.length} gratuitos ` +
        `y ${pago.length} premium. Decime el nombre de uno y te explico cómo se hace.`,
      habla: true,
      intencion: 'que_ejercicios',
      regla: true,
    };
  }
  if (contiene(n, 'modo', 'ranking', 'cadencia', 'competicion')) {
    return {
      texto:
        'Hay dos modos. En verificación simple no hay límite de tiempo y la secuencia avanza sola. ' +
        'Con ranking tenés que llegar a 6 segundos entre reps y la prueba de vida salta cada 12 segundos.',
      habla: true,
      intencion: 'modos',
      regla: true,
    };
  }
  if (contiene(n, 'prueba de vida', 'senal de vida', 'gesto', 'mano', 'antifraude')) {
    return {
      texto:
        'La señal de vida es levantar la mano arriba de la cabeza, igual que para arrancar. ' +
        (ranked
          ? 'Con ranking activada salta cada 12 segundos para confirmar que seguís ahí, y además te ' +
            'exige llegar a 6 segundos entre reps.'
          : 'En verificación simple no salta sola, pero la mano sigue siendo la que pasa al siguiente ejercicio.') +
        ' Cuando terminás, levantás la mano otra vez para avanzar o para repetir.',
      habla: true,
      intencion: 'prueba_vida',
      regla: true,
    };
  }
  if (
    contiene(
      n,
      'para que sirve',
      'que hace la app',
      'que es esta app',
      'como funciona',
      'como funciona la app',
      'para que sirve este banco',
      'que es el banco',
      'para que sirve el banco',
      'explicame la app',
    )
  ) {
    return {
      texto:
        'Es un banco de pruebas para verificar ejercicios con cámara. Podés elegir hasta 8 ejercicios, ajustar las reps o segundos, ponerlos en orden y hacer una secuencia. Cuenta las repeticiones con detección de pose, tiene ranking con prueba de vida y un entrenador de voz con frases determinísticas. Todo corre en el teléfono, sin API ni costo.',
      habla: true,
      intencion: 'para_que_sirve',
      regla: true,
    };
  }
  if (contiene(n, 'la voz', 'frases', 'habla', 'me habla', 'voces', 'va a decir', 'me dice')) {
    return {
      texto:
        'Durante la serie no hay inteligencia artificial: son 40 frases escritas que van rotando. ' +
        'En los isométricos no te hablo dentro de la serie porque la fonación rompe la postura. ' +
        'Los números siempre los pone el programa, nunca la frase.',
      habla: true,
      intencion: 'voz',
      regla: true,
    };
  }

  // 6. Fuera de dominio: no inventar.
  return {
    texto:
      'Eso no lo manejo. Te puedo responder sobre los ejercicios, los modos de ejecución, ' +
      'la secuencia y tus datos guardados.',
    habla: true,
    intencion: 'fuera_de_dominio',
    regla: true,
  };
}

/** Sugerencias de la pantalla: los cuatro intents más usados del dominio. */
export const ATAJOS: { etiqueta: string; consulta: string }[] = [
  { etiqueta: '¿Cómo empiezo?', consulta: '¿Cómo empiezo?' },
  { etiqueta: 'Modos', consulta: '¿Qué diferencia hay entre los modos?' },
  { etiqueta: 'Prueba de vida', consulta: '¿Qué es la prueba de vida?' },
  { etiqueta: 'La voz', consulta: '¿Qué me va a decir?' },
];

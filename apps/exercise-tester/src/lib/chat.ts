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
  | 'que_ejercicios'
  | 'como_hacer_ejercicio'
  | 'modos'
  | 'prueba_vida'
  | 'voz'
  | 'perfil_dato'
  | 'perfil_consejo'
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
  if (contiene(n, 'como me llamo', 'mi nombre', 'quien soy')) return 'nombre';
  if (contiene(n, 'mi edad', 'cuantos anos tengo', 'que edad')) return 'edad';
  if (contiene(n, 'mi peso', 'cuanto peso', 'cuanto pesa')) return 'peso';
  if (contiene(n, 'mi altura', 'cuanto mido', 'cuanto alto')) return 'altura';
  if (contiene(n, 'mi objetivo', 'mi meta', 'para que entreno')) return 'objetivo';
  if (contiene(n, 'mi nivel', 'que nivel')) return 'nivel';
  return null;
}

/** "¿Cómo hago sentadillas?" → la ficha del ejercicio, con la advertencia real. */
function fichaEjercicio(n: string): ChatReply | null {
  const ejercicio = EXERCISES.find(
    (e) => normalizar(e.name).includes(n) || n.includes(normalizar(e.name)),
  );
  if (!ejercicio) return null;
  const unidad = ejercicio.unit === 'seconds' ? 'segundos' : 'reps';
  const vida = ejercicio.liveness === 'hold' ? 'aguantando la posición' : 'levantando la mano';
  const extra =
    ejercicio.unit === 'seconds'
      ? ' Mientras lo aguantás no te hablo: la fonación rompe el braceo.'
      : '';
  return {
    texto:
      `${ejercicio.name}: objetivo ${ejercicio.target} ${unidad}. ` +
      `Es del tier ${ejercicio.tier === 'free' ? 'gratuito' : 'premium'}. ` +
      `La señal de vida es ${vida}.${extra}`,
    habla: true,
    intencion: 'como_hacer_ejercicio',
    regla: true,
  };
}

const MENOR =
  'Esta conversación está disponible a partir de los 18 años. ' +
  'Puedo igual responderte cómo se usa la app si querés.';

/**
 * Resuelve una entrada. Devuelve siempre una respuesta de regla: cuando el
 * modelo esté conectado, esta función pasa a ser el fallback y la validación.
 */
export function responder(entrada: string, perfil: UserProfile = PERFIL_FALSO): ChatReply {
  const n = normalizar(entrada);
  const menor = perfil.edad < EDAD_MINIMA;

  // 1. Puerta de edad: se evalúa antes que todo lo demás.
  if (menor) {
    return { texto: MENOR, habla: true, intencion: 'menor_de_edad', regla: true };
  }

  // 2. Pedir un dato del perfil: se LEE, nunca se habla.
  const campo = buscarCampo(n);
  if (campo) {
    return {
      texto: datoPerfil(perfil, campo),
      // Sin TTS: el dato del perfil no sale por una voz que puede ser cloud.
      habla: false,
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
  const ficha = fichaEjercicio(n);
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
  if (contiene(n, 'como empiezo', 'como arranco', 'como empiezo', 'que hago primero')) {
    return {
      texto:
        'Elegís hasta 8 ejercicios, les ajustás las reps, los ordenás y tocás Iniciar. ' +
        'La cámara se enciende sola y contás las reps con el modelo de pose.',
      habla: true,
      intencion: 'como_empezar',
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
        'La prueba de vida es levantar la mano arriba de la cabeza. En ranking salta cada 12 segundos ' +
        'para confirmar que seguís ahí, y también sirve para pasar al siguiente ejercicio.',
      habla: true,
      intencion: 'prueba_vida',
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

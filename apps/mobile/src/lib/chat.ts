// Dominio del chat del entrenador, en la app ResiliencIA.
//
// Misma arquitectura que el banco de pruebas: acá NO hay modelo. Es un
// resolvedor de intenciones sobre un dominio cerrado: la app, los ejercicios,
// los modos de ejecución y los datos reales del perfil. Todo lo que responde
// sale de este archivo, así que no puede inventar ni dar consejo de salud.
//
// Las tres reglas que NO son negociables, y que están codeadas acá para que no
// dependan de que un modelo se porte bien:
//
// 1. Puerta de edad: menor de 18 no recibe nada del perfil ni entra en modo
//    libre. Un modelo chico no es quien decide esto. Y si el perfil no tiene
//    edad cargada, no se asume mayoría de edad: se pide completar el perfil
//    antes de responder cualquier dato personal.
// 2. El perfil se lee y se habla igual que el resto del chat: el TTS del
//    teléfono. La voz nunca inventa: sale del mismo texto que se muestra.
// 3. El perfil no genera consejo. Puede LEER un dato si lo piden; no puede
//    derivar una recomendación de peso, edad u objetivo.

import { translate } from '../i18n/translations';
import { EXERCISES, REP_CADENCE, exerciseNameKey } from '../retos/catalog';
import { TECNICA } from './tecnica';

export type Nivel = 'principiante' | 'intermedio' | 'avanzado';

/** Perfil que el chat lee. Lo construye la pantalla desde el perfil real. */
export interface ChatPerfil {
  nombre: string;
  /** undefined = el usuario no cargó la edad: se aplica la puerta de edad. */
  edad?: number;
  pesoKg?: number;
  alturaCm?: number;
  /** Texto del objetivo (goal) ya traducido. */
  objetivo?: string;
  /** Derivado de la constancia deportiva (habitScore). */
  nivel?: Nivel;
}

export const EDAD_MINIMA = 18;

/** Nivel derivado de la constancia deportiva (habitScore 0..100). */
export function nivelDesdeHabit(score: number): Nivel {
  if (score <= 0) return 'principiante';
  if (score <= 49) return 'intermedio';
  return 'avanzado';
}

export type Intent =
  | 'saludo'
  | 'como_empezar'
  | 'como_reiniciar'
  | 'que_ejercicios'
  | 'como_hacer_ejercicio'
  | 'modos'
  | 'prueba_vida'
  | 'perfil_dato'
  | 'perfil_sin_edad'
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

/** Campos del perfil que la IA puede leer si se los piden. */
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

function nombreEjercicio(id: string): string {
  return translate('es', exerciseNameKey(id));
}

function noCargado(campo: string, donde: string): string {
  return `No tengo cargado tu ${campo}. Cargalo en ${donde}.`;
}

function datoPerfil(perfil: ChatPerfil, campo: CampoPerfil): string {
  switch (campo) {
    case 'nombre':
      return `Te llamás ${perfil.nombre}.`;
    case 'edad':
      return `Tenés ${perfil.edad} años.`;
    case 'peso':
      return perfil.pesoKg != null
        ? `Pesás ${perfil.pesoKg} kilos.`
        : noCargado('peso', 'la pestaña Perfil');
    case 'altura':
      return perfil.alturaCm != null
        ? `Medís ${perfil.alturaCm} centímetros.`
        : noCargado('altura', 'la pestaña Perfil');
    case 'objetivo':
      return perfil.objetivo
        ? `Tu objetivo es: ${perfil.objetivo}.`
        : noCargado('objetivo', 'la pestaña Perfil');
    case 'nivel':
      return perfil.nivel
        ? `Estás en el nivel ${perfil.nivel}.`
        : 'Todavía no está definido tu nivel. Cargá tus deportes en la pestaña Perfil.';
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
      'cuántos años tengo',
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
      'cuanto peso',
      'cuanto peso tengo',
      'que peso tengo',
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
 * objetivo necesita: cómo se hace la posición, cómo arranca, cómo es la
 * prueba de vida en ranking y cómo se repite.
 *
 * NO dice cuántas reps: eso lo elige el usuario en CamRetos (o el plan del
 * día), y NO dice el tier: "premium" es jerga de la app, no información para
 * alguien que pregunta cómo se hace una sentadilla.
 */
function fichaEjercicio(n: string, ranked: boolean): ChatReply | null {
  const ejercicio = EXERCISES.find(
    (e) => normalizar(nombreEjercicio(e.id)).includes(n) || n.includes(normalizar(nombreEjercicio(e.id))),
  );
  if (!ejercicio) return null;
  const tec = TECNICA[ejercicio.id];
  const posicion = tec ? tec.resumen : `${nombreEjercicio(ejercicio.id)}: no hay guía cargada.`;
  const segundos = ejercicio.unit === 'seconds';

  const arranque =
    'Para arrancar, levantá la mano arriba de la cabeza y esperá la cuenta de 5 a 1.';
  const cad = segundos ? 6 : REP_CADENCE[ejercicio.id] ?? 6;
  const vida =
    ranked && !segundos
      ? `Con el ranking activado tenés que llegar a ${cad} segundos entre reps y el sistema te avisa cada 12 segundos levantando la mano.`
      : segundos
        ? 'Como es un ejercicio por tiempo, no hay cuenta de reps ni límite de segundos entre repeticiones.'
        : 'En verificación simple no hay límite de tiempo entre repeticiones.';
  const cierre =
    'Cuando terminás, la app lo valida y te muestra el resultado; para repetir la serie tocás Empezar de nuevo.';

  const texto =
    `${nombreEjercicio(ejercicio.id)}. ${posicion} ${arranque} ${vida} ${cierre}` +
    (segundos ? ' Mientras lo aguantás no te hablo: la fonación rompe la postura.' : '');

  return { texto, habla: true, intencion: 'como_hacer_ejercicio', regla: true };
}

/** Mismas tres cosas (arranque, vida, cierre) sin nombre de ejercicio. */
function guiaEjercicio(ranked: boolean): string {
  return (
    'Para arrancar cualquier ejercicio, levantá la mano arriba de la cabeza y esperá la cuenta de 5 a 1. ' +
    (ranked
      ? 'Con el ranking activado se mide el límite de segundos entre reps (según el ejercicio) y te avisa cada 12 segundos. '
      : 'En verificación simple no hay límite de tiempo entre repeticiones. ') +
    'Cuando terminás, podés iniciar de nuevo la misma serie en la pantalla.'
  );
}

const MENOR =
  'Esta conversación está disponible a partir de los 18 años. ' +
  'Puedo igual responderte cómo se usa la app si querés.';

const SIN_EDAD =
  'Para responderte sobre tus datos necesito saber tu edad. ' +
  'Cargala en la pestaña Perfil y volvé a preguntar.';

/**
 * Resuelve una entrada. Devuelve siempre una respuesta de regla: cuando el
 * modelo esté conectado, esta función pasa a ser el fallback y la validación.
 */
export function responder(entrada: string, perfil: ChatPerfil, ranked = false): ChatReply {
  const n = normalizar(entrada);
  const sinEdad = perfil.edad == null;
  const menor = perfil.edad != null && perfil.edad < EDAD_MINIMA;

  // 1. Puerta de edad: se evalúa antes que todo lo demás.
  if (menor) {
    return { texto: MENOR, habla: true, intencion: 'menor_de_edad', regla: true };
  }

  // 2. Pedir un dato del perfil. Sin edad cargada no se asume mayoría: se pide
  //    completar el perfil. El dato se responde en texto y se habla (regla 2).
  const campo = buscarCampo(n);
  if (campo) {
    if (sinEdad) {
      return { texto: SIN_EDAD, habla: true, intencion: 'perfil_sin_edad', regla: true };
    }
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
      texto: `Hola ${perfil.nombre}. Preguntame qué ejercicio toca hoy o cómo funciona la app.`,
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
      'que hago primero',
      'como arranco el ejercicio',
      'como se empieza',
    )
  ) {
    return {
      texto:
        'En Inicio vas a ver el reto del día y tocás Empezar para entrenarlo con la cámara. ' +
        guidanceIntro(ranked),
      habla: true,
      intencion: 'como_empezar',
      regla: true,
    };
  }
  if (contiene(n, 'como reinicio', 'como repito', 'como vuelvo a empezar', 'reiniciar la serie')) {
    return {
      texto:
        'Con el botón. Cuando terminás la serie, la app la valida y te muestra el resultado; ' +
        'para repetirla tocás Empezar de nuevo. Si la serie se rompe por una pausa larga en ' +
        'ranking, queda fuera del ranking y la reiniciás desde el mismo botón.',
      habla: true,
      intencion: 'como_reiniciar',
      regla: true,
    };
  }
  if (contiene(n, 'que ejercicios hay', 'que hay', 'cuales son los ejercicios', 'lista')) {
    const libres = EXERCISES.filter((e) => e.tier === 'free').map((e) => nombreEjercicio(e.id));
    const pago = EXERCISES.filter((e) => e.tier === 'premium').map((e) => nombreEjercicio(e.id));
    return {
      texto:
        `Tenés ${EXERCISES.length} ejercicios: ${libres.join(', ')} (gratuitos) y ` +
        `${pago.join(', ')} (premium). Decime el nombre de uno y te explico cómo se hace.`,
      habla: true,
      intencion: 'que_ejercicios',
      regla: true,
    };
  }
  if (contiene(n, 'modo', 'ranking', 'cadencia', 'competicion')) {
    return {
      texto:
        'Hay dos modos. En verificación simple no hay límite de tiempo entre repeticiones y la ' +
        'serie se valida con tu postura. Con ranking se mide el límite de segundos entre reps ' +
        'y la prueba de vida salta cada 12 segundos pidiendo la mano.',
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
          ? 'Con ranking activado salta cada 12 segundos para confirmar que seguís ahí, y además ' +
            'se exige llegar al límite de segundos entre reps en los ejercicios de repeticiones.'
          : 'En verificación simple no salta sola.') +
        ' Cuando terminás la serie podés iniciar otra vez desde la pantalla.',
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
      'explicame la app',
    )
  ) {
    return {
      texto:
        'ResiliencIA te arma un plan semanal: cada día de entrenamiento tenés un reto con un ' +
        'ejercicio y la cámara verifica tu postura y cuenta las repeticiones. En CamRetos podés ' +
        'entrenar el ejercicio que quieras con tu propio objetivo, en verificación simple o en ' +
        'ranking con prueba de vida. La detección de pose corre en el teléfono, sin API.',
      habla: true,
      intencion: 'para_que_sirve',
      regla: true,
    };
  }

  // 6. Fuera de dominio: no inventar.
  return {
    texto:
      'Eso no lo manejo. Te puedo responder sobre los ejercicios, los modos de ejecución, ' +
      'las series y tus datos guardados.',
    habla: true,
    intencion: 'fuera_de_dominio',
    regla: true,
  };
}

function guidanceIntro(ranked: boolean): string {
  return (
    'En CamRetos elegís el ejercicio, ajustás el objetivo y tocás Iniciar. ' + guiaEjercicio(ranked)
  );
}

/** Sugerencias de la pantalla: los intents más usados del dominio. */
export const ATAJOS: { etiqueta: string; consulta: string }[] = [
  { etiqueta: '¿Cómo empiezo?', consulta: '¿Cómo empiezo?' },
  { etiqueta: 'Modos', consulta: '¿Qué diferencia hay entre los modos?' },
  { etiqueta: 'Prueba de vida', consulta: '¿Qué es la prueba de vida?' },
];
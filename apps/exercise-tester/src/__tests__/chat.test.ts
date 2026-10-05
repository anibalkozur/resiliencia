import { describe, expect, it } from '@jest/globals';

import { EDAD_MINIMA, PERFIL_FALSO, PERFIL_MENOR, responder, type ChatReply } from '../lib/chat';
import { EXERCISES } from '../lib/exercises';
import { TECNICA } from '../lib/tecnica';

const r = (texto: string, perfil = PERFIL_FALSO): ChatReply => responder(texto, perfil);

describe('puerta de edad', () => {
  it(`deja pasar a ${EDAD_MINIMA} y frena antes`, () => {
    expect(r('hola', { ...PERFIL_FALSO, edad: EDAD_MINIMA }).intencion).not.toBe('menor_de_edad');
    expect(r('hola', { ...PERFIL_FALSO, edad: EDAD_MINIMA - 1 }).intencion).toBe('menor_de_edad');
  });

  it('un menor no obtiene datos de su perfil aunque los pida', () => {
    for (const q of [
      '¿cuánto peso?',
      '¿cómo me llamo?',
      '¿cuál es mi objetivo?',
      '¿qué edad tengo?',
    ]) {
      const res = r(q, PERFIL_MENOR);
      expect(res.intencion).toBe('menor_de_edad');
      // ni el dato ni el numero aparecen en la respuesta
      expect(res.texto).not.toContain(String(PERFIL_MENOR.pesoKg));
      expect(res.texto).not.toContain(PERFIL_MENOR.nombre);
    }
  });

  it('un menor no recibe consejo de salud por la puerta de atrás', () => {
    const res = r('¿debería hacer sentadillas con 60 kilos?', PERFIL_MENOR);
    expect(res.intencion).toBe('menor_de_edad');
  });
});

describe('datos del perfil: se leen, no se hablan', () => {
  it('marca habla=false en toda respuesta con dato del perfil', () => {
    const preguntas = [
      '¿cuánto peso tengo?',
      '¿cómo me llamo?',
      '¿qué edad tengo?',
      '¿cuánto mido?',
      '¿cuál es mi objetivo?',
      '¿qué nivel tengo?',
    ];
    for (const q of preguntas) {
      expect(r(q).habla).toBe(false);
    }
  });

  it('devuelve el dato correcto', () => {
    expect(r('¿cuánto peso tengo?').texto).toContain(String(PERFIL_FALSO.pesoKg));
    expect(r('¿cómo me llamo?').texto).toContain(PERFIL_FALSO.nombre);
    expect(r('¿qué edad tengo?').texto).toContain(String(PERFIL_FALSO.edad));
  });

  it('aguanta acentos y mayúsculas', () => {
    expect(r('¿CUÁNTO PESO TENGO?').intencion).toBe('perfil_dato');
    expect(r('¿cuánto peso tengo?').intencion).toBe('perfil_dato');
  });

  it('el resto del dominio sí se puede hablar', () => {
    expect(r('¿qué es la prueba de vida?').habla).toBe(true);
    expect(r('hola').habla).toBe(true);
  });
});

describe('el perfil no genera consejo', () => {
  it('rechaza pedir una recomendación a partir del peso o la edad', () => {
    for (const q of [
      '¿debería bajar de peso?',
      '¿me conviene hacer esto?',
      '¿me recomendas sentadillas?',
      '¿cuánto tengo que bajar?',
    ]) {
      expect(r(q).intencion).toBe('perfil_consejo');
    }
  });

  it('la respuesta de rechazo no se presenta como la respuesta', () => {
    expect(r('¿me recomendas sentadillas?').habla).toBe(true);
  });
});

describe('dominio cerrado', () => {
  it('responde las consultas de la app y los modos', () => {
    expect(r('¿cómo empiezo?').intencion).toBe('como_empezar');
    expect(r('¿qué diferencia hay entre los modos?').intencion).toBe('modos');
    expect(r('¿qué es la prueba de vida?').intencion).toBe('prueba_vida');
    expect(r('¿qué me va a decir?').intencion).toBe('voz');
    expect(r('¿qué ejercicios hay?').intencion).toBe('que_ejercicios');
  });

  it('reconoce un ejercicio por nombre', () => {
    const res = r('¿cómo hago sentadillas?');
    expect(res.intencion).toBe('como_hacer_ejercicio');
    expect(res.texto).toContain('Sentadillas');
  });

  it('aclara que en los isométricos no habla dentro de la serie', () => {
    expect(r('¿cómo hago plancha?').texto).toContain('no te hablo');
  });

  it('no inventa fuera del dominio', () => {
    const res = r('¿quién ganó el mundial?');
    expect(res.intencion).toBe('fuera_de_dominio');
    expect(res.habla).toBe(true);
  });
});

describe('toda respuesta viene de regla, no del modelo', () => {
  it('marca regla=true siempre', () => {
    for (const q of ['hola', '¿cuánto peso?', '¿cómo hago plancha?', 'zzz']) {
      expect(r(q).regla).toBe(true);
    }
  });
});

describe('ficha de ejercicio', () => {
  it('responde posición, arranque, vida y reinicio, y nada más', () => {
    const res = responder('como realizo las sentadillas');
    expect(res.texto).toMatch(/levant[aá] la mano/i);
    expect(res.texto).toMatch(/5 a 1/);
    expect(res.texto).toMatch(/6 segundos entre reps|no hay límite de tiempo entre repeticiones/i);
    expect(res.texto).toMatch(/pas(a|á) al siguiente|repite/i);
    // Lo que el usuario pidió que no aparezca.
    expect(res.texto).not.toMatch(/tier/i);
    expect(res.texto).not.toMatch(/gratuito|premium/i);
    expect(res.texto).not.toMatch(/objetivo \d+/i);
    expect(res.texto).not.toMatch(/\d+\s*reps/i);
    expect(res.regla).toBe(true);
  });

  it('no menciona reps ni tier para ningún ejercicio del banco', () => {
    for (const e of EXERCISES) {
      const res = responder(`como hago ${e.name}`);
      expect(res.texto).not.toMatch(/\d+\s*reps?/i);
      expect(res.texto).not.toMatch(/tier/i);
      expect(res.texto).not.toMatch(/gratuito|premium/i);
    }
  });

  it('usa la guía de posición de cada ejercicio', () => {
    for (const e of EXERCISES) {
      const res = responder(`como hago ${e.name}`);
      const tec = TECNICA[e.id];
      // Si falta la guía, esta aserción falla: el chat no puede inventar técnica.
      expect(tec).toBeDefined();
      expect(res.texto).not.toMatch(/no hay guía cargada/);
      expect(res.texto.length).toBeGreaterThan(140);
      const resumen = tec?.resumen.replace(/\s+/g, ' ').trim() ?? '';
      expect(resumen.length).toBeGreaterThan(30);
      expect(res.texto).toContain(resumen.slice(0, 40));
    }
  });

  it('avisa que en los isométricos no habla mientras aguantás', () => {
    const res = responder('como hago plancha');
    expect(res.texto).toMatch(/no te hablo|fonaci/i);
    // Y no le inventa un límite de segundos entre reps.
    expect(res.texto).not.toMatch(/6 segundos entre reps/i);
  });

  it('da el límite entre reps solo en modo ranking', () => {
    expect(responder('como hago sentadillas', PERFIL_FALSO, true).texto).toMatch(
      /6 segundos entre reps/i,
    );
    expect(responder('como hago sentadillas', PERFIL_FALSO, false).texto).not.toMatch(
      /6 segundos entre reps/i,
    );
  });
});

describe('consultas de arranque, vida y reinicio', () => {
  it('"como arranco" explica la mano y la cuenta regresiva', () => {
    const res = responder('como arranco');
    expect(res.texto).toMatch(/levant[aá] la mano/i);
    expect(res.texto).toMatch(/5 a 1/);
  });

  it('"como reinicio" dice que se hace con la mano', () => {
    const res = responder('como reinicio');
    expect(res.texto).toMatch(/mano/i);
    expect(res.texto).toMatch(/siguiente/i);
  });

  it('la señal de vida es la mano y dice qué pasa al terminar', () => {
    const res = responder('como es la senal de vida');
    expect(res.texto).toMatch(/mano/i);
    expect(res.texto).toMatch(/12 segundos|6 segundos entre reps|no salta sola/i);
    expect(res.texto).toMatch(/terminás/i);
    // La gramática rota que reportó el usuario.
    expect(res.texto).not.toMatch(/es levantando/i);
  });
});

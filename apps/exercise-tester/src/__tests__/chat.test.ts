import { describe, expect, it } from '@jest/globals';

import { EDAD_MINIMA, PERFIL_FALSO, PERFIL_MENOR, responder, type ChatReply } from '../lib/chat';

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
      '¿cuánto peso?',
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
    expect(r('¿cuánto pesó?').texto).toContain(String(PERFIL_FALSO.pesoKg));
    expect(r('¿cómo me llamo?').texto).toContain(PERFIL_FALSO.nombre);
    expect(r('¿qué edad tengo?').texto).toContain(String(PERFIL_FALSO.edad));
  });

  it('aguanta acentos y mayúsculas', () => {
    expect(r('¿CUÁNTO PESO?').intencion).toBe('perfil_dato');
    expect(r('cuanto peso').intencion).toBe('perfil_dato');
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

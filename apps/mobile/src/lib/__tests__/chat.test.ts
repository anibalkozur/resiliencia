import { describe, expect, it } from '@jest/globals';
import { ATAJOS, EDAD_MINIMA, nivelDesdeHabit, responder, type ChatPerfil } from '../chat';

function perfil(overrides: Partial<ChatPerfil> = {}): ChatPerfil {
  return {
    nombre: 'Anibal',
    edad: 32,
    pesoKg: 84,
    alturaCm: 178,
    objetivo: 'Perder grasa',
    nivel: 'intermedio',
    ...overrides,
  };
}

describe('puerta de edad', () => {
  it('bloquea todo para menores de 18', () => {
    const r = responder('¿Cuánto peso?', perfil({ edad: 16 }));
    expect(r.intencion).toBe('menor_de_edad');
    expect(r.texto).toContain('18');
  });

  it('sin edad cargada NO asume mayoría y pide completar el perfil', () => {
    const r = responder('¿Cuánto peso?', perfil({ edad: undefined }));
    expect(r.intencion).toBe('perfil_sin_edad');
  });

  it('todos los atajos pasan por la puerta si falta la edad devolviendo el intent sin edad', () => {
    for (const atajo of ATAJOS) {
      const r = responder(atajo.consulta, perfil({ edad: undefined }));
      // Ningún dato del perfil se responde (perfil_dato) sin edad.
      expect(r.intencion).not.toBe('perfil_dato');
    }
  });
});

describe('datos del perfil', () => {
  it('devuelve el peso en texto y lo habla', () => {
    const r = responder('¿Cuánto peso?', perfil());
    expect(r.intencion).toBe('perfil_dato');
    expect(r.texto).toContain('84');
    expect(r.habla).toBe(true);
  });

  it('no matchea contexto de terceros ("¿cuánto pesa un X?")', () => {
    const r = responder('¿Cuánto pesa una barra?', perfil());
    expect(r.intencion).not.toBe('perfil_dato');
  });

  it('edad, altura y objetivo se responden en texto y se hablan', () => {
    for (const consulta of ['¿Qué edad tengo?', '¿Cuánto mido?', '¿Cuál es mi objetivo?']) {
      const r = responder(consulta, perfil());
      expect(r.habla).toBe(true);
    }
  });

  it('consejo derivado del perfil se rechaza', () => {
    const r = responder('¿Debería bajar de peso?', perfil());
    expect(r.intencion).toBe('perfil_consejo');
  });
});

describe('ejercicios', () => {
  it('responde la ficha de un ejercicio con arranque y cadencia', () => {
    const r = responder('¿Cómo hago sentadillas?', perfil(), true);
    expect(r.intencion).toBe('como_hacer_ejercicio');
    expect(r.texto).toContain('Sentadillas');
    expect(r.texto).toContain('mano');
    expect(r.habla).toBe(true);
  });

  it('isométricos aclaran que no se habla dentro de la serie', () => {
    const r = responder('¿Cómo hago plancha?', perfil());
    expect(r.texto).toContain('tiempo');
    expect(r.texto).toContain('no te hablo');
  });
});

describe('dominio cerrado', () => {
  it('fuera de dominio no inventa', () => {
    const r = responder('¿Cuál es la mejor receta de pastel?', perfil());
    expect(r.intencion).toBe('fuera_de_dominio');
  });

  it('saluda con el nombre real', () => {
    const r = responder('hola', perfil());
    expect(r.intencion).toBe('saludo');
    expect(r.texto).toContain('Anibal');
  });

  it('atajos son exactamente 3 (sin tema de la voz)', () => {
    expect(ATAJOS).toHaveLength(3);
    expect(ATAJOS.map((a) => a.etiqueta)).not.toContain('La voz');
  });

  it('la voz no es ni pregunta ni respuesta: queda fuera de dominio', () => {
    const r = responder('¿Qué me va a decir la voz durante la serie?', perfil());
    expect(r.intencion).toBe('fuera_de_dominio');
  });
});

describe('nivel desde constancia deportiva', () => {
  it('mapea el habitScore a principiante/intermedio/avanzado', () => {
    expect(nivelDesdeHabit(0)).toBe('principiante');
    expect(nivelDesdeHabit(49)).toBe('intermedio');
    expect(nivelDesdeHabit(50)).toBe('avanzado');
  });
});

describe('constante de edad', () => {
  it('la mayoría de edad es 18', () => {
    expect(EDAD_MINIMA).toBe(18);
  });
});
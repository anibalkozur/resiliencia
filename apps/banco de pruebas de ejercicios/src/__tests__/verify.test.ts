import { describe, expect, it } from '@jest/globals';

import { buildSequenceUri, buildVerifyUri, VERIFY_URL, VERIFY_VERSION } from '../lib/verify';

describe('buildVerifyUri', () => {
  it('apunta a la copia del banco, no a la pÃ¡gina de producciÃ³n', () => {
    expect(VERIFY_URL).toBe(
      'https://anibalkozur.github.io/resiliencia/camera-verification-bench.html',
    );
    expect(VERIFY_VERSION).toBe(36);
  });

  it('pasa ejercicio, objetivo y unidad', () => {
    expect(buildVerifyUri('sentadillas', 20, 'reps')).toBe(
      'https://anibalkozur.github.io/resiliencia/camera-verification-bench.html?v=36&exercise=sentadillas&target=20&unit=reps',
    );
  });

  it('agrega ranked y cadence solo cuando corresponde', () => {
    const ranked = buildVerifyUri('flexiones', 10, 'reps', { ranked: true, cadenceSec: 5 });
    expect(ranked).toContain('ranked=1');
    expect(ranked).toContain('cadence=5');

    const plain = buildVerifyUri('plancha', 30, 'seconds');
    expect(plain).not.toContain('ranked=1');
    expect(plain).not.toContain('cadence=');
  });
});

describe('buildSequenceUri', () => {
  it('manda los ejercicios en orden, con su objetivo', () => {
    expect(
      buildSequenceUri([
        { id: 'elevacion_piernas', target: 15 },
        { id: 'plancha', target: 30 },
      ]),
    ).toBe(
      'https://anibalkozur.github.io/resiliencia/camera-verification-bench.html?v=36&seq=elevacion_piernas%3A15%2Cplancha%3A30',
    );
  });

  it('respeta el orden elegido y agrega ranked/cadencia', () => {
    const uri = buildSequenceUri(
      [
        { id: 'plancha', target: 45 },
        { id: 'flexiones', target: 8 },
        { id: 'sentadillas', target: 20 },
      ],
      { ranked: true, cadenceSec: 6 },
    );
    expect(uri).toContain('ranked=1');
    expect(uri).toContain('cadence=6');
    expect(new URL(uri).searchParams.get('seq')).toBe('plancha:45,flexiones:8,sentadillas:20');
    // La unidad no viaja: la pÃ¡gina la saca del CFG de cada ejercicio.
    expect(uri).not.toContain('unit=');
  });
});

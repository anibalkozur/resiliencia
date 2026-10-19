import { describe, expect, it } from '@jest/globals';
import { buildVerifyUri, VERIFY_URL, VERIFY_VERSION } from '../verify';

function query(uri: string): URLSearchParams {
  return new URL(uri).searchParams;
}

describe('buildVerifyUri', () => {
  it('arma el ejercicio único con versión y sin banderas opcionales', () => {
    const params = query(buildVerifyUri('sentadillas', 20, 'reps'));
    expect(params.get('v')).toBe(String(VERIFY_VERSION));
    expect(params.get('exercise')).toBe('sentadillas');
    expect(params.get('target')).toBe('20');
    expect(params.get('unit')).toBe('reps');
    expect(params.has('seq')).toBe(false);
    expect(params.has('ranked')).toBe(false);
    expect(params.has('strict')).toBe(false);
    expect(params.has('cadence')).toBe(false);
    expect(params.has('liveness')).toBe(false);
  });

  it('el reto diario pide vida, corte por cadencia (strict) y objetivo', () => {
    const uri = buildVerifyUri('sentadillas', 20, 'reps', {
      requireLiveness: true,
      strict: true,
      cadenceSec: 5,
    });
    const params = query(uri);
    expect(params.get('liveness')).toBe('1');
    expect(params.get('strict')).toBe('1');
    expect(params.get('cadence')).toBe('5');
    expect(params.has('ranked')).toBe(false);
  });

  it('la rutina (seq) no manda exercise y lleva ranked + cadencia', () => {
    const uri = buildVerifyUri('sentadillas', 20, 'reps', {
      seq: [
        { id: 'sentadillas', target: 20 },
        { id: 'flexiones', target: 10 },
      ],
      ranked: true,
      cadenceSec: 5,
    });
    const params = query(uri);
    expect(params.get('seq')).toBe('sentadillas:20,flexiones:10');
    expect(params.has('exercise')).toBe(false);
    expect(params.get('ranked')).toBe('1');
    expect(params.get('cadence')).toBe('5');
  });

  it('usa la URL de producción de la cámara', () => {
    expect(buildVerifyUri('sentadillas', 20, 'reps').startsWith(VERIFY_URL)).toBe(true);
  });
});

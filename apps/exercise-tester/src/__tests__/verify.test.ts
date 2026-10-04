import { describe, expect, it } from '@jest/globals';

import { buildVerifyUri, VERIFY_URL, VERIFY_VERSION } from '../lib/verify';

describe('buildVerifyUri', () => {
  it('apunta a la copia del banco, no a la página de producción', () => {
    expect(VERIFY_URL).toBe(
      'https://anibalkozur.github.io/resiliencia/camera-verification-bench.html',
    );
    expect(VERIFY_VERSION).toBe(25);
  });

  it('pasa ejercicio, objetivo y unidad', () => {
    expect(buildVerifyUri('sentadillas', 20, 'reps')).toBe(
      'https://anibalkozur.github.io/resiliencia/camera-verification-bench.html?v=25&exercise=sentadillas&target=20&unit=reps',
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

import { describe, expect, it } from '@jest/globals';

import {
  classifyOrientation,
  isLandscape,
  isVertical,
  ORIENTATION_TOLERANCE,
} from '../lib/orientation';

const G = 9.81;

/** Vector de gravedad para el celular en vertical, inclinado `deg` grados atrás. */
const vertical = (deg = 0) => ({
  x: 0,
  y: G * Math.cos((deg * Math.PI) / 180),
  z: G * Math.sin((deg * Math.PI) / 180),
});

/** Vector de gravedad para el celular apaisado (girado 90°), inclinado `deg`. */
const landscape = (deg = 0) => ({
  x: G * Math.cos((deg * Math.PI) / 180),
  y: 0,
  z: G * Math.sin((deg * Math.PI) / 180),
});

describe('classifyOrientation', () => {
  it('reconoce el celular parado en vertical', () => {
    expect(classifyOrientation(vertical())).toBe('portrait');
    expect(classifyOrientation({ x: 0, y: -G, z: 0 })).toBe('portrait');
  });

  it('reconoce el celular en horizontal (pantalla apaisada)', () => {
    expect(classifyOrientation(landscape())).toBe('landscape');
    expect(classifyOrientation({ x: -G, y: 0, z: 0 })).toBe('landscape');
  });

  it('el horizontal no pasa por vertical (era el bug del cálculo viejo)', () => {
    // Con `atan2(|gz|,|gy|)` el vector (G, 0, 0) daba 0 grados: "vertical".
    expect(classifyOrientation({ x: G, y: 0, z: 0 })).not.toBe('portrait');
  });

  it('aceorta hasta la tolerancia y la respeta', () => {
    expect(classifyOrientation(vertical(ORIENTATION_TOLERANCE - 1))).toBe('portrait');
    expect(classifyOrientation(vertical(ORIENTATION_TOLERANCE + 5))).not.toBe('portrait');
    expect(classifyOrientation(landscape(ORIENTATION_TOLERANCE - 1))).toBe('landscape');
    expect(classifyOrientation(landscape(ORIENTATION_TOLERANCE + 5))).not.toBe('landscape');
  });

  it('distingue acostado plano de inclinado', () => {
    expect(classifyOrientation({ x: 0, y: 0, z: G })).toBe('flat');
    expect(classifyOrientation({ x: 0, y: 0, z: -G })).toBe('flat');
    // 30° de la mesa: todavía "acostado" (tolerancia de 35°).
    expect(classifyOrientation({ x: 0, y: G * 0.5, z: G * 0.86 })).toBe('flat');
    // 45° de la mesa: ni vertical ni acostado.
    expect(classifyOrientation({ x: 0, y: G * 0.707, z: G * 0.707 })).toBe('tilted');
  });

  it('descarta lecturas sin señal o inválidas', () => {
    expect(classifyOrientation(null)).toBe('unknown');
    expect(classifyOrientation(undefined)).toBe('unknown');
    expect(classifyOrientation({ x: 0, y: 0, z: 0 })).toBe('unknown');
    expect(classifyOrientation({ x: NaN, y: G, z: 0 })).toBe('unknown');
  });
});

describe('isVertical / isLandscape', () => {
  it('son mutuamente excluyentes', () => {
    expect(isVertical('portrait')).toBe(true);
    expect(isLandscape('portrait')).toBe(false);
    expect(isLandscape('landscape')).toBe(true);
    expect(isVertical('landscape')).toBe(false);
    expect(isVertical('flat')).toBe(false);
    expect(isLandscape('flat')).toBe(false);
    expect(isVertical('unknown')).toBe(false);
    expect(isLandscape('unknown')).toBe(false);
  });
});

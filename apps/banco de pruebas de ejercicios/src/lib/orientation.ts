// Orientación del celular a partir de la gravedad (expo-sensors
// DeviceMotion.accelerationIncludingGravity).
//
// Marco del dispositivo (independiente de la rotación de la pantalla):
//   x = derecha del celular
//   y = eje largo (de la base de la pantalla hacia arriba) — el eje "portrait"
//   z = saliendo de la pantalla
//
// La gravedad apunta hacia abajo en el mundo. Con el celular parado en
// vertical la gravedad es casi paralela a `y`; con el celular en horizontal
// (pantalla apaisada) es casi paralela a `x`; acostado plano, a `z`.
//
// Por qué no alcanza el cálculo anterior (`atan2(|gz|,|gy|) <= 35`): ignoraba
// `x`, así que con el celular en horizontal daba 0 (falso "vertical") y el
// guard `hypot(gy, gz) < 1` descartaba la muestra entera (el puente dejaba de
// informar la orientación). Acá la misma tolerancia de 35° se aplica sobre los
// tres ejes y se exige que el eje dominante sea el esperado.

export type DeviceOrientation = 'portrait' | 'landscape' | 'flat' | 'tilted' | 'unknown';

export type Gravity = { x: number; y: number; z: number };

/** Tolerancia en grados: la misma que usaba el puente original. */
export const ORIENTATION_TOLERANCE = 35;

/** Lectura mínima creíble (m/s²): por debajo no hay señal de gravedad. */
const MIN_MAGNITUDE = 2.5;

const deg = (rad: number) => (rad * 180) / Math.PI;

/**
 * Clasifica la postura del celular. No depende de la rotación de la pantalla:
 * el marco del sensor es fijo al cuerpo del aparato.
 */
export function classifyOrientation(g: Gravity | null | undefined): DeviceOrientation {
  if (!g) return 'unknown';
  const { x, y, z } = g;
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return 'unknown';
  if (Math.hypot(x, y, z) < MIN_MAGNITUDE) return 'unknown';

  // Ángulo de la gravedad a cada eje:
  //   tiltYZ = 0 cuando la gravedad cae sobre `y` (celular vertical)
  //   tiltXZ = 0 cuando la gravedad cae sobre `x` (celular apaisado)
  //   tiltZ  = 0 cuando la gravedad cae sobre `z` (celular acostado)
  const tiltYZ = deg(Math.atan2(Math.abs(z), Math.abs(y)));
  const tiltXZ = deg(Math.atan2(Math.abs(z), Math.abs(x)));
  const tiltZ = deg(Math.atan2(Math.hypot(x, y), Math.abs(z)));

  // El eje dominante decide: `y` para vertical, `x` para apaisado. El `|y| >= |x|`
  // evita que un celular en horizontal (donde `y` vale ~0) pase por vertical.
  if (tiltYZ <= ORIENTATION_TOLERANCE && Math.abs(y) >= Math.abs(x)) return 'portrait';
  if (tiltXZ <= ORIENTATION_TOLERANCE && Math.abs(x) >= Math.abs(y)) return 'landscape';
  if (tiltZ <= ORIENTATION_TOLERANCE) return 'flat';
  return 'tilted';
}

/** El celular está parado en vertical (los 22 ejercicios del banco). */
export function isVertical(orientation: DeviceOrientation): boolean {
  return orientation === 'portrait';
}

/** El celular está en horizontal, con la pantalla apaisada. */
export function isLandscape(orientation: DeviceOrientation): boolean {
  return orientation === 'landscape';
}

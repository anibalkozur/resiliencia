export const VERIFY_URL = 'https://anibalkozur.github.io/resiliencia/camera-verification.html';
export const VERIFY_VERSION = 53;

export interface RoutExercise {
  id: string;
  target: number;
}

export interface VerifyOptions {
  ranked?: boolean;
  cadenceSec?: number;
  // Corta la serie si la pausa entre repes supera la cadencia, aun sin rankear
  // (reto diario): la cámara corta la serie y ofrece REPETIR para reiniciar.
  strict?: boolean;
  // Exige la prueba de vida aunque la sesión no se rankee (reto diario): la
  // cámara la pide durante la serie o al finalizarla.
  requireLiveness?: boolean;
  // Rutina de modo libre: varios ejercicios en secuencia (`seq=id:objetivo,...`).
  seq?: readonly RoutExercise[];
}

export function buildVerifyUri(
  exerciseId: string,
  target: number,
  unit: string,
  opts: VerifyOptions = {},
): string {
  const p = new URLSearchParams();
  if (opts.seq && opts.seq.length) {
    p.set('seq', opts.seq.map((s) => `${s.id}:${s.target}`).join(','));
    p.set('unit', unit);
  } else {
    p.set('exercise', exerciseId);
    p.set('target', String(target));
    p.set('unit', unit);
  }
  if (opts.ranked) p.set('ranked', '1');
  if (opts.strict) p.set('strict', '1');
  if (opts.requireLiveness) p.set('liveness', '1');
  if (opts.cadenceSec && opts.cadenceSec > 0) p.set('cadence', String(opts.cadenceSec));
  return `${VERIFY_URL}?v=${VERIFY_VERSION}&${p.toString()}`;
}

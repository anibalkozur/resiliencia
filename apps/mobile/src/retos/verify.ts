export const VERIFY_URL = 'https://anibalkozur.github.io/resiliencia/camera-verification.html';
export const VERIFY_VERSION = 46;

export interface RoutExercise {
  id: string;
  target: number;
}

export interface VerifyOptions {
  ranked?: boolean;
  cadenceSec?: number;
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
  if (opts.cadenceSec && opts.cadenceSec > 0) p.set('cadence', String(opts.cadenceSec));
  return `${VERIFY_URL}?v=${VERIFY_VERSION}&${p.toString()}`;
}

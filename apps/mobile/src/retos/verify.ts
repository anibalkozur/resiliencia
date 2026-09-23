export const VERIFY_URL = 'https://anibalkozur.github.io/resiliencia/camera-verification.html';
export const VERIFY_VERSION = 9;

export interface VerifyOptions {
  ranked?: boolean;
  cadenceSec?: number;
}

export function buildVerifyUri(
  exerciseId: string,
  target: number,
  unit: string,
  opts: VerifyOptions = {},
): string {
  const p = new URLSearchParams({
    exercise: exerciseId,
    target: String(target),
    unit,
  });
  if (opts.ranked) p.set('ranked', '1');
  if (opts.cadenceSec && opts.cadenceSec > 0) p.set('cadence', String(opts.cadenceSec));
  return `${VERIFY_URL}?v=${VERIFY_VERSION}&${p.toString()}`;
}

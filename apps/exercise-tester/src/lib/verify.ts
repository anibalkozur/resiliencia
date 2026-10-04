// Página del BANCO de pruebas: fork de la de producción con los arreglos de
// cadencia en validación. NO es la página que usa la app real
// (`camera-verification.html`), que queda intacta y funciona como está. Cuando
// los arreglos se validen, se portan a mano a la página de producción.
//
// El banco carga la página por URL (no embebe HTML): un documento con
// `source={{ html }}` usa `loadDataWithBaseURL` y no reproduce el origen HTTPS
// que necesita `getUserMedia`.

export const VERIFY_URL =
  'https://anibalkozur.github.io/resiliencia/camera-verification-bench.html';
export const VERIFY_VERSION = 25;

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

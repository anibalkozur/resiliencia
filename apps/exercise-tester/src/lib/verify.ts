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
export const VERIFY_VERSION = 27;

export interface VerifyOptions {
  ranked?: boolean;
  cadenceSec?: number;
}

/** Un ejercicio de la secuencia: id del catálogo + objetivo elegido. */
export interface SequenceItem {
  id: string;
  target: number;
}

/**
 * URL de una sesión con varios ejercicios. La página los recorre en orden sin
 * recargar: al completar cada uno (o al fallar) espera el gesto de mano para
 * pasar al siguiente o reintentar el mismo. La unidad de cada ejercicio sale de
 * su CFG, así que no viaja en la URL.
 */
export function buildSequenceUri(items: SequenceItem[], opts: VerifyOptions = {}): string {
  const p = new URLSearchParams({
    seq: items.map((i) => `${i.id}:${i.target}`).join(','),
  });
  if (opts.ranked) p.set('ranked', '1');
  if (opts.cadenceSec && opts.cadenceSec > 0) p.set('cadence', String(opts.cadenceSec));
  return `${VERIFY_URL}?v=${VERIFY_VERSION}&${p.toString()}`;
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

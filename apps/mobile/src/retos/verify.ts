export const VERIFY_URL = 'https://anibalkozur.github.io/resiliencia/camera-verification.html';
export const VERIFY_VERSION = 5;

export function buildVerifyUri(
  exerciseId: string,
  target: number,
  unit: string,
  mode: 'libre' | 'reto' = 'libre',
): string {
  return `${VERIFY_URL}?v=${VERIFY_VERSION}&exercise=${exerciseId}&target=${target}&unit=${unit}&mode=${mode}`;
}

export const VERIFY_URL = 'https://anibalkozur.github.io/resiliencia/camera-verification.html';
export const VERIFY_VERSION = 6;

export function buildVerifyUri(exerciseId: string, target: number, unit: string): string {
  return `${VERIFY_URL}?v=${VERIFY_VERSION}&exercise=${exerciseId}&target=${target}&unit=${unit}`;
}

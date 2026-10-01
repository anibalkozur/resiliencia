// Inclinación del celular. Replica la fórmula de producción
// (camera-verification.html:1872-1878, inyectada desde
// apps/mobile/app/(tabs)/retos.tsx:149-161):
//
//   tilt = atan2(|z|, |y|) * 180/PI,  vertical = tilt <= 35°
//
// expo-sensors entrega el acelerómetro en g (incluye la gravedad), así que la
// misma fórmula funciona sin transformaciones: con el celu parado, y≈1 y z≈0.

export const VERTICAL_TOLERANCE = 35;
export const SENSOR_CONFIRM_MS = 8000;
export const SENSOR_UPDATE_INTERVAL_MS = 200;

export type AccelSample = { x: number; y: number; z: number };

/** Ángulo de inclinación en grados. */
export function tiltDeg(a: AccelSample): number {
  return (Math.atan2(Math.abs(a.z), Math.abs(a.y)) * 180) / Math.PI;
}

/** El acelerómetro solo sirve si el vector tiene componente en y o z. */
export function accelValid(a: AccelSample): boolean {
  return Math.hypot(a.y, a.z) >= 1;
}

export function isVertical(a: AccelSample): boolean {
  return accelValid(a) && tiltDeg(a) <= VERTICAL_TOLERANCE;
}

export type TiltState = {
  samples: AccelSample[];
  confirmedAt: number | null;
  confirmed: boolean;
  unavailable: boolean;
  lastDeg: number;
  vertical: boolean;
};

/**
 * Exige `SENSOR_CONFIRM_MS` de muestras continuas en vertical antes de dar por
 * buena la sesión (como el chequeo de 8 s del prototipo).
 */
export function pushSample(state: TiltState, sample: AccelSample, now: number): TiltState {
  const samples = [...state.samples, sample];
  const vertical = isVertical(sample);
  if (!vertical) {
    // Salió de vertical: se descarta la ventana de confirmación.
    return {
      ...state,
      samples: [],
      confirmed: false,
      confirmedAt: null,
      lastDeg: tiltDeg(sample),
      vertical: false,
    };
  }
  if (samples.length < Math.ceil(SENSOR_CONFIRM_MS / SENSOR_UPDATE_INTERVAL_MS)) {
    return { ...state, samples, lastDeg: tiltDeg(sample), vertical: true };
  }
  if (!state.confirmed) {
    return {
      ...state,
      samples: [],
      confirmed: true,
      confirmedAt: now,
      lastDeg: tiltDeg(sample),
      vertical: true,
    };
  }
  return { ...state, samples: [], lastDeg: tiltDeg(sample), vertical: true };
}

export function initialTiltState(): TiltState {
  return {
    samples: [],
    confirmedAt: null,
    confirmed: false,
    unavailable: false,
    lastDeg: 0,
    vertical: false,
  };
}

export function confirmProgress(state: TiltState): number {
  if (state.confirmedAt !== null) return 1;
  const need = Math.ceil(SENSOR_CONFIRM_MS / SENSOR_UPDATE_INTERVAL_MS);
  return need === 0 ? 1 : Math.min(1, state.samples.length / need);
}

export function tiltSummary(): string {
  return `Vertical = inclinación <= ${VERTICAL_TOLERANCE}° (misma fórmula que la app: atan2(|z|,|y|)). Se exigen ${SENSOR_CONFIRM_MS / 1000} s continuos en vertical antes de empezar a contar.`;
}

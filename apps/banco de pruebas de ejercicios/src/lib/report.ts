// Informe del banco de pruebas.
//
// A diferencia de la versión anterior, acá NO hay motor de conteo en TypeScript:
// el resultado llega hecho desde la página (mensaje `complete` de
// camera-verification.html:1149-1205). Este módulo solo lo traduce a un informe
// legible y comparable.

import type { ExerciseInfo, ExerciseUnit } from './exercises';

export type TestResult = {
  kind: 'ejercicio';
  exerciseId: string;
  name: string;
  tier: 'free' | 'premium';
  unit: ExerciseUnit;
  target: number;
  finishedAt: number;
  reached: boolean;
  /** El motor mide una unidad distinta de la que declara catalog.ts. */
  unitMismatch: boolean;
  summary: string;
  detail: string[];
  /** Payload crudo de `complete`, tal cual lo mandó la página. */
  payload: Record<string, unknown>;
};

function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function summarizeCompletion(
  cfg: ExerciseInfo,
  payload: Record<string, unknown>,
  finishedAt: number,
): TestResult {
  const unit: ExerciseUnit = payload.unit === 'seconds' ? 'seconds' : cfg.unit;
  const value = num(payload.value) ?? num(payload.reps) ?? 0;
  const unitLabel = unit === 'seconds' ? 's' : 'reps';

  const ranked = payload.ranked === true;
  const seriesOk = payload.seriesOk === true;
  const livenessOk = payload.livenessOk === true;
  const evidence =
    typeof payload.evidence === 'object' &&
    payload.evidence !== null &&
    !Array.isArray(payload.evidence)
      ? (payload.evidence as Record<string, unknown>)
      : {};

  // El objetivo lo puede haber elegido el usuario en el banco: la página lo
  // manda en `evidence.targetVal`. Si no viene, se usa el del catálogo.
  const pageTarget = num(payload.targetVal) ?? num(evidence.targetVal);
  const goal = pageTarget !== null && pageTarget > 0 ? pageTarget : cfg.target;
  const reached = value >= goal;

  const detail: string[] = [];
  detail.push(`objetivo: ${goal} ${unitLabel}`);
  detail.push(`logrado: ${value} ${unitLabel}`);
  detail.push(`progreso: ${Math.min(100, Math.round((value / goal) * 100))}%`);
  detail.push(`detalle de la página: ${String(payload.detail ?? '(sin detalle)')}`);
  if (ranked) {
    detail.push(`ranked: serie ${seriesOk ? 'ok' : 'ROTA'} · vida ${livenessOk ? 'ok' : 'NO'}`);
    const cadence = num(payload.cadence);
    if (cadence) detail.push(`cadencia objetivo: ${cadence} s/rep`);
  } else {
    detail.push('modo: verificado (sin ranking)');
  }
  const verifyVersion = num(evidence.verifyVersion);
  if (verifyVersion !== null) detail.push(`verifyVersion: ${verifyVersion}`);
  const durationMs = num(evidence.durationMs);
  if (durationMs !== null) detail.push(`duración: ${Math.round(durationMs / 1000)}s`);
  if (cfg.catalogUnit && cfg.catalogUnit !== cfg.unit) {
    detail.push(
      `⚠ el motor mide ${cfg.unit} pero catalog.ts declara ${cfg.catalogUnit}: la meta de la app no es la que cuenta la página`,
    );
  }

  return {
    kind: 'ejercicio',
    exerciseId: cfg.id,
    name: cfg.name,
    tier: cfg.tier,
    unit,
    target: goal,
    finishedAt,
    reached,
    unitMismatch: cfg.catalogUnit !== undefined && cfg.catalogUnit !== cfg.unit,
    summary: reached ? 'OK' : `No llegó al objetivo (${value}/${goal})`,
    detail,
    payload,
  };
}

export function verdict(result: TestResult): string {
  const flag = result.unitMismatch ? ' [⚠ unidad]' : '';
  return `${result.reached ? '✅' : '⚠️'} ${result.name}${flag} — ${result.summary}`;
}

export function toJson(results: TestResult[]): string {
  return JSON.stringify({ generatedAt: Date.now(), results }, null, 2);
}

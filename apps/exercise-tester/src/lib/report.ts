// Reportes: qué quedó al final de cada prueba. Sirven para comparar dos
// corridas (antes/después de tocar un umbral) y para portar learnings a la app.

import type { ExerciseConfig, ExerciseUnit } from './exercises';
import { cadenceSec } from './exercises';
import { avgAmplitude, avgDuration, type RepTelemetry } from './repEngine';

export type TestKind = 'ejercicio' | 'vida';

export type TestResult = {
  kind: TestKind;
  exerciseId: string;
  name: string;
  tier: 'free' | 'premium';
  unit: ExerciseUnit;
  target: number;
  finishedAt: number;
  reached: boolean;
  /** El motor no coincide con la unidad del catálogo de la app. */
  unitMismatch: boolean;
  summary: string;
  detail: string[];
  telemetry: RepTelemetry[];
};

export function summarizeExercise(
  cfg: ExerciseConfig,
  args: {
    reps: number;
    holdMs: number;
    restAngle: number | null;
    livenessRequired: boolean;
    livenessPassed: boolean;
    telemetry: RepTelemetry[];
    finalMetrics: Record<string, number>;
    finishedAt: number;
  },
): TestResult {
  // La meta se mide en segundos si el ejercicio es isométrico, en reps si no:
  // es la misma regla que usa la app (catalog.ts: unit).
  const bySeconds = cfg.unit === 'seconds';
  const done = bySeconds ? Math.floor(args.holdMs / 1000) : args.reps;
  const reached = done >= cfg.target;
  const unitLabel = bySeconds ? 's' : 'reps';

  const detail: string[] = [];
  detail.push(`objetivo: ${cfg.target} ${unitLabel}`);
  detail.push(`logrado: ${done} ${unitLabel}`);
  detail.push(`progreso: ${Math.min(100, Math.round((done / cfg.target) * 100))}%`);
  if (cfg.catalogUnit && cfg.catalogUnit !== cfg.unit) {
    detail.push(
      `⚠ motor mide ${cfg.unit} pero catalog.ts declara ${cfg.catalogUnit}: el objetivo de la app no es el mismo que cuenta el motor`,
    );
  }
  if (args.restAngle !== null) detail.push(`ángulo de calibración: ${args.restAngle.toFixed(1)}°`);
  if (args.telemetry.length > 0) {
    detail.push(`amplitud media: ${avgAmplitude(args.telemetry).toFixed(1)}°`);
    detail.push(`duración media/rep: ${Math.round(avgDuration(args.telemetry))} ms`);
    detail.push(`amplitud mín: ${Math.min(...args.telemetry.map((r) => r.amplitude)).toFixed(1)}°`);
    const cad = cadenceSec(cfg.id);
    if (cad) {
      detail.push(`cadencia objetivo: ${cad} s/rep`);
    }
  }
  detail.push(
    `prueba de vida: ${args.livenessRequired ? (args.livenessPassed ? 'ok' : 'NO pasó') : 'no requerida'}`,
  );
  const keys = Object.keys(args.finalMetrics).sort();
  for (const k of keys) {
    const v = args.finalMetrics[k];
    if (typeof v === 'number') detail.push(`${k}: ${v.toFixed(1)}`);
  }
  return {
    kind: 'ejercicio',
    exerciseId: cfg.id,
    name: cfg.name,
    tier: cfg.tier,
    unit: cfg.unit,
    target: cfg.target,
    finishedAt: args.finishedAt,
    reached,
    unitMismatch: cfg.catalogUnit !== undefined && cfg.catalogUnit !== cfg.unit,
    summary: reached ? 'OK' : `No llegó al objetivo (${done}/${cfg.target})`,
    detail,
    telemetry: args.telemetry,
  };
}

export function verdict(result: TestResult): string {
  const flag = result.unitMismatch ? ' [⚠ unidad]' : '';
  return `${result.reached ? '✅' : '⚠️'} ${result.name}${flag} — ${result.summary}`;
}

export function toJson(results: TestResult[]): string {
  return JSON.stringify({ generatedAt: Date.now(), results }, null, 2);
}

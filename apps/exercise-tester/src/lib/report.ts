// Reportes: qué quedó al final de cada prueba. Sirven para comparar dos
// corridas (antes/después de tocar un umbral) y para portar learnings a la app.

import type { ExerciseConfig } from './exercises';
import { avgAmplitude, avgDuration, type RepTelemetry } from './repEngine';

export type TestKind = 'ejercicio' | 'vida';

export type TestResult = {
  kind: TestKind;
  exerciseId: string;
  name: string;
  finishedAt: number;
  reached: boolean;
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
  const reached =
    cfg.kind === 'isometrico' ? args.holdMs >= cfg.target * 1000 : args.reps >= cfg.target;
  const detail: string[] = [];
  detail.push(`objetivo: ${cfg.target} ${cfg.kind === 'isometrico' ? 's' : 'reps'}`);
  detail.push(
    `logrado: ${cfg.kind === 'isometrico' ? `${Math.round(args.holdMs / 1000)} s` : `${args.reps} reps`}`,
  );
  if (args.restAngle !== null) detail.push(`ángulo de calibración: ${args.restAngle.toFixed(1)}°`);
  if (args.telemetry.length > 0) {
    detail.push(`amplitud media: ${avgAmplitude(args.telemetry).toFixed(1)}°`);
    detail.push(`duración media/rep: ${Math.round(avgDuration(args.telemetry))} ms`);
    detail.push(`amplitud mín: ${Math.min(...args.telemetry.map((r) => r.amplitude)).toFixed(1)}°`);
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
    finishedAt: args.finishedAt,
    reached,
    summary: reached ? 'OK' : 'No llegó al objetivo',
    detail,
    telemetry: args.telemetry,
  };
}

export function verdict(result: TestResult): string {
  return `${result.reached ? '✅' : '⚠️'} ${result.name} — ${result.summary}`;
}

export function toJson(results: TestResult[]): string {
  return JSON.stringify({ generatedAt: Date.now(), results }, null, 2);
}

import { describe, expect, it } from '@jest/globals';

import { exerciseById } from '../lib/exercises';
import { summarizeCompletion, verdict } from '../lib/report';

function cfg(id: string) {
  const e = exerciseById(id);
  if (!e) throw new Error(`no existe ${id}`);
  return e;
}

describe('summarizeCompletion', () => {
  it('usa la unidad que manda la página y marca el objetivo', () => {
    const r = summarizeCompletion(
      cfg('plancha'),
      { type: 'complete', value: 31, unit: 'seconds' },
      1,
    );
    expect(r.unit).toBe('seconds');
    expect(r.reached).toBe(true);
    expect(r.summary).toBe('OK');
  });

  it('marca objetivo no alcanzado', () => {
    const r = summarizeCompletion(cfg('sentadillas'), { type: 'complete', reps: 12 }, 1);
    expect(r.reached).toBe(false);
    expect(r.summary).toContain('12/20');
  });

  it('respeta el objetivo elegido en el banco (evidence.targetVal)', () => {
    const r = summarizeCompletion(
      cfg('sentadillas'),
      {
        type: 'complete',
        value: 5,
        reps: 5,
        unit: 'reps',
        evidence: { targetVal: 5, targetMet: true },
      },
      1,
    );
    expect(r.target).toBe(5);
    expect(r.reached).toBe(true);
    expect(r.summary).toBe('OK');
    expect(r.detail.join('\n')).toContain('objetivo: 5 reps');
  });

  it('marca la discrepancia de mountain climbers', () => {
    const r = summarizeCompletion(cfg('mountain_climbers'), { type: 'complete', reps: 30 }, 1);
    expect(r.unitMismatch).toBe(true);
    expect(verdict(r)).toContain('[⚠ unidad]');
    expect(r.detail.join('\n')).toContain('catalog.ts declara seconds');
  });

  it('incluye ranked y evidencia', () => {
    const r = summarizeCompletion(
      cfg('flexiones'),
      {
        type: 'complete',
        reps: 10,
        ranked: true,
        seriesOk: true,
        livenessOk: true,
        cadence: 5,
        evidence: { verifyVersion: 16, durationMs: 42000 },
      },
      1,
    );
    const text = r.detail.join('\n');
    expect(text).toContain('ranked: serie ok');
    expect(text).toContain('verifyVersion: 16');
    expect(text).toContain('duración: 42s');
  });
});

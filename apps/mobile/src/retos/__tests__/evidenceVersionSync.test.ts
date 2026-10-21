import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from '@jest/globals';

import { VERIFY_VERSION } from '../verify';

// Guard de proceso: la version de evidencia que firma la camara (VERIFY_VERSION)
// DEBE estar incluida en ALLOWED_EVIDENCE_VERSIONS de la Edge Function. Si no,
// el servidor rechaza los retos con 'unsupported_evidence_version'. Este test
// atrapa la desincronizacion ANTES de tocar produccion.
const EDGE_INDEX = join(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  '..',
  'supabase',
  'functions',
  'validate_workout',
  'index.ts',
);

function readAllowedEvidenceVersions(): number[] {
  const source = readFileSync(EDGE_INDEX, 'utf8');
  const match = /ALLOWED_EVIDENCE_VERSIONS\s*=\s*new Set\(\[([^\]]*)\]\)/.exec(source);
  if (!match) {
    throw new Error('No se encontro ALLOWED_EVIDENCE_VERSIONS en validate_workout/index.ts');
  }
  return match[1]
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => Number(part));
}

describe('sincronizacion de version de evidencia', () => {
  it('VERIFY_VERSION esta incluida en ALLOWED_EVIDENCE_VERSIONS de la edge', () => {
    const allowed = readAllowedEvidenceVersions();
    expect(allowed).toContain(VERIFY_VERSION);
  });
});

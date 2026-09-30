import { describe, expect, it } from 'vitest';
import {
  defaultConfig,
  makeLocalStore,
  promptFingerprint,
  ratingToFewShot,
  ratingsToDataset,
  removeFewShot,
  removeRating,
  upsertFewShot,
  upsertRating,
} from '../copilot/store';
import type { KV } from '../copilot/store';

function memoryKV(): KV & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    store,
    get: (k) => store.get(k) ?? null,
    set: (k, v) => void store.set(k, v),
  };
}

function rating(
  overrides?: Partial<Parameters<typeof upsertRating>[1]>,
): Parameters<typeof upsertRating>[1] {
  return {
    id: 'r-1',
    sessionId: 's1',
    ts: '2026-09-30T00:00:00.000Z',
    rating: 'good',
    userMessage: '¿Cómo viene el usuario X?',
    assistantText: 'El usuario X tiene premium activo.',
    note: '',
    modelFile: 'Qwen3-1.7B-Q4_K_M.gguf',
    promptVersion: 'abc123',
    ...overrides,
  };
}

describe('defaultConfig', () => {
  it('trae el prompt base con el placeholder de contexto', () => {
    const c = defaultConfig();
    expect(c.systemPrompt).toContain('{contexto_json}');
    expect(c.repo.length).toBeGreaterThan(0);
    expect(c.temperature).toBeGreaterThanOrEqual(0);
  });

  it('trae ejemplos de arranque (few-shots) de premium', () => {
    const c = defaultConfig();
    expect(c.fewShots).toHaveLength(4);
    expect(c.fewShots[0]!.content).toContain('¿Es recomendable pasarme a premium?');
    expect(c.fewShots[2]!.content).toBe('Sí');
  });
});

describe('ratings', () => {
  it('upsert por id sin duplicar', () => {
    const a = rating();
    const b = rating({ note: 'nota actualizada' });
    const list = upsertRating(upsertRating([], a), b);
    expect(list).toHaveLength(1);
    expect(list[0]!.note).toBe('nota actualizada');
  });

  it('removeRating saca el registro indicado', () => {
    const list = upsertRating([], rating());
    const next = removeRating(list, 'r-1');
    expect(next).toHaveLength(0);
  });

  it('ratingToFewShot genera el par user/assistant', () => {
    const pair = ratingToFewShot(rating());
    expect(pair.map((p) => p.role)).toEqual(['user', 'assistant']);
    expect(pair[0]!.content).toContain('usuario');
  });
});

describe('fewShots', () => {
  it('upsert deduplica por contenido (y respeta el orden de los pares)', () => {
    const pair = ratingToFewShot(rating());
    const out = upsertFewShot(upsertFewShot([], pair), pair);
    expect(out).toHaveLength(2);
  });

  it('removeFewShot elimina por índice', () => {
    const fs = [
      { role: 'user' as const, content: 'a' },
      { role: 'assistant' as const, content: 'b' },
    ];
    expect(removeFewShot(fs, 1)).toEqual([{ role: 'user', content: 'a' }]);
  });
});

describe('promptFingerprint', () => {
  it('cambia si cambia el prompt o el modelo', () => {
    const cfg = defaultConfig();
    const v1 = promptFingerprint(cfg, 'a.gguf');
    const v2 = promptFingerprint(cfg, 'b.gguf');
    const v3 = promptFingerprint({ ...cfg, systemPrompt: cfg.systemPrompt + ' extra' }, 'a.gguf');
    expect(v1).not.toBe(v2);
    expect(v1).not.toBe(v3);
  });

  it('es estable para la misma config', () => {
    const cfg = defaultConfig();
    expect(promptFingerprint(cfg, 'a.gguf')).toBe(promptFingerprint(cfg, 'a.gguf'));
  });
});

describe('makeLocalStore', () => {
  it('round-trip de config, ratings y sesión', () => {
    const kv = memoryKV();
    const store = makeLocalStore(kv);

    const cfg = defaultConfig();
    store.saveConfig(cfg);
    expect(store.loadConfig()).toEqual(cfg);

    store.saveRatings([rating()]);
    expect(store.loadRatings()).toHaveLength(1);

    const msgs = [
      { role: 'user' as const, content: 'hola' },
      { role: 'assistant' as const, content: 'hola!' },
    ];
    store.saveSession('s1', msgs);
    expect(store.loadSession('s1')).toEqual(msgs);
  });

  it('devuelve defaults cuando el KV está vacío o corrupto', () => {
    const kv = memoryKV();
    kv.store.set('resiliencia.copilot.config.v1', 'no-json');
    const store = makeLocalStore(kv);
    expect(store.loadConfig()).toEqual(defaultConfig());
    expect(store.loadRatings()).toEqual([]);
    expect(store.loadSession('x')).toEqual([]);
  });
});

describe('ratingsToDataset', () => {
  it('exporta schema, prompt, fewshots y ejemplos', () => {
    const cfg = defaultConfig();
    const json = ratingsToDataset([rating()], cfg, 'a.gguf');
    const parsed = JSON.parse(json) as {
      schema: string;
      systemPrompt: string;
      examples: Array<Record<string, unknown>>;
    };
    expect(parsed.schema).toBe('resiliencia.copilot.dataset.v1');
    expect(parsed.systemPrompt).toContain('{contexto_json}');
    expect(parsed.examples).toHaveLength(1);
    expect(parsed.examples[0]!.rating).toBe('good');
  });
});

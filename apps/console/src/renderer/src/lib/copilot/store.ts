// Persistencia local del harness del Copilot: config, few-shots (ejemplos para
// condicionar el comportamiento) y evaluaciones (respuestas marcadas como
// correctas o inapropiadas). Lógica pura con un adaptador KV inyectable.
import { DEFAULT_MODEL, DEFAULT_SYSTEM_PROMPT, hashText } from '@console/shared/copilot';
import type { Turn } from './prompt';

export interface KV {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

export const CONFIG_KEY = 'resiliencia.copilot.config.v1';
export const RATINGS_KEY = 'resiliencia.copilot.ratings.v1';
export const SESSIONS_KEY = 'resiliencia.copilot.sessions.v1';

export type CopilotConfig = {
  repo: string;
  file: string;
  temperature: number;
  maxTokens: number;
  maxHistoryTurns: number;
  contextEnabled: boolean;
  systemPrompt: string;
  fewShots: Turn[];
};

export function defaultConfig(): CopilotConfig {
  return {
    repo: DEFAULT_MODEL.repo,
    file: DEFAULT_MODEL.file,
    temperature: 0.4,
    maxTokens: 512,
    maxHistoryTurns: 8,
    contextEnabled: true,
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    fewShots: defaultFewShots(),
  };
}

export function defaultFewShots(): Turn[] {
  return [
    {
      role: 'user',
      content: '¿Es recomendable pasarme a premium?',
    },
    {
      role: 'assistant',
      content:
        'Sí. Con premium desbloqueás los 8 ejercicios: los 3 gratis (sentadillas, flexiones, abdominales) más plancha, zancadas, puente glúteo, mountain climbers y sentadilla isométrica, y entrás a todos los rankings y al ranking TOTAL (el free no compite). Vale US$2.99/mes o US$19.99/año (≈US$1.67/mes, ahorrás 44%) con 7 días de prueba gratis en el anual. ¿Arrancamos?',
    },
    {
      role: 'user',
      content: 'Sí',
    },
    {
      role: 'assistant',
      content:
        '¡Dale! Abrí la app, entrá a Premium y activá el plan anual para probar los 7 días gratis (sin cargo durante la prueba). Cuando esté activo, lo verifico desde la Console y seguimos. ¿Algo más?',
    },
  ];
}

export type RatingValue = 'good' | 'bad';

export type RatingRecord = {
  id: string;
  sessionId: string;
  ts: string;
  rating: RatingValue;
  userMessage: string;
  assistantText: string;
  note: string;
  modelFile: string;
  promptVersion: string;
};

export function ratingId(assistantText: string): string {
  return hashText(assistantText);
}

/** Compara dos configs y devuelve qué cambió (para versionar el prompt). */
export function promptFingerprint(config: CopilotConfig, modelFile: string): string {
  const seed = [
    modelFile,
    config.systemPrompt,
    ...config.fewShots.map((f) => `${f.role}:${f.content}`),
  ].join('\u0001');
  return hashText(seed);
}

export function upsertRating(ratings: RatingRecord[], rating: RatingRecord): RatingRecord[] {
  const idx = ratings.findIndex((r) => r.id === rating.id);
  if (idx < 0) return [...ratings, rating];
  const next = [...ratings];
  next[idx] = rating;
  return next;
}

export function removeRating(ratings: RatingRecord[], id: string): RatingRecord[] {
  return ratings.filter((r) => r.id !== id);
}

/** Convierte una evaluación "buena" en ejemplo few-shot (user + assistant). */
export function ratingToFewShot(rating: RatingRecord): Turn[] {
  return [
    { role: 'user' as const, content: rating.userMessage },
    { role: 'assistant' as const, content: rating.assistantText },
  ];
}

export function upsertFewShot(fewShots: Turn[], pair: Turn[]): Turn[] {
  const merged = [...fewShots, ...pair];
  const seen = new Set<string>();
  const out: Turn[] = [];
  for (const t of merged) {
    const key = `${t.role}:${hashText(t.content)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

export function removeFewShot(fewShots: Turn[], index: number): Turn[] {
  return fewShots.filter((_, i) => i !== index);
}

export function makeLocalStore(kv: KV): {
  loadConfig(): CopilotConfig;
  saveConfig(config: CopilotConfig): void;
  loadRatings(): RatingRecord[];
  saveRatings(ratings: RatingRecord[]): void;
  loadSession(sessionId: string): { role: 'user' | 'assistant'; content: string }[];
  saveSession(sessionId: string, messages: { role: 'user' | 'assistant'; content: string }[]): void;
} {
  function readJson<T>(key: string, fallback: T): T {
    const raw = kv.get(key);
    if (!raw) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  return {
    loadConfig: () => readJson(CONFIG_KEY, defaultConfig()),
    saveConfig: (config) => kv.set(CONFIG_KEY, JSON.stringify(config)),
    loadRatings: () => readJson(RATINGS_KEY, [] as RatingRecord[]),
    saveRatings: (ratings) => kv.set(RATINGS_KEY, JSON.stringify(ratings)),
    loadSession: (sessionId) =>
      readJson(
        `${SESSIONS_KEY}:${sessionId}`,
        [] as { role: 'user' | 'assistant'; content: string }[],
      ),
    saveSession: (sessionId, messages) =>
      kv.set(`${SESSIONS_KEY}:${sessionId}`, JSON.stringify(messages)),
  };
}

export const localStorageKV: KV = {
  get: (key) => {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set: (key, value) => {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      /* almacenamiento no disponible: el harness sigue funcionando sin persistir */
    }
  },
};

/** Convierte un set de evaluaciones al formato de dataset exportable. */
export function ratingsToDataset(
  ratings: RatingRecord[],
  config: CopilotConfig,
  modelFile: string,
): string {
  const examples = ratings.map((r) => ({
    sessionId: r.sessionId,
    ts: r.ts,
    rating: r.rating,
    note: r.note,
    expected: r.rating === 'good' ? r.assistantText : '',
    userMessage: r.userMessage,
    assistantText: r.assistantText,
  }));
  return JSON.stringify(
    {
      schema: 'resiliencia.copilot.dataset.v1',
      modelFile,
      promptFingerprint: modelFile ? promptFingerprint(config, modelFile) : null,
      systemPrompt: config.systemPrompt,
      fewShots: config.fewShots,
      examples,
    },
    null,
    2,
  );
}

// Smoke test del motor del Copilot (fuera de Electron): descarga Qwen3-1.7B
// Q4_K_M, lo carga con node-llama-cpp y hace una generación con el mismo flujo
// que apps/console/src/main/copilot.ts (setChatHistory + prompt con streaming).
import { getLlama, LlamaChatSession, LlamaLogLevel } from 'node-llama-cpp';
import { mkdir, stat, rename, rm, open } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import process from 'node:process';

const TMP = 'C:\\Users\\Anibal\\AppData\\Local\\Temp\\opencode\\models';
const REPO = 'ggml-org/Qwen3-1.7B-GGUF';
const FILE = 'Qwen3-1.7B-Q4_K_M.gguf';
const TARGET = join(TMP, FILE);

async function session() {
  try {
    return await getLlama({ gpu: 'vulkan', logLevel: LlamaLogLevel.warn });
  } catch {
    console.log('[smoke] Vulkan no disponible, uso CPU.');
    return await getLlama({ logLevel: LlamaLogLevel.warn });
  }
}

async function ensureModel() {
  const st = await stat(TARGET).catch(() => null);
  if (st?.isFile() && st.size > 0) {
    console.log(`[smoke] Modelo ya descargado (${(st.size / 1e9).toFixed(2)} GB).`);
    return;
  }
  console.log(`[smoke] Descargando ${REPO}/${FILE}…`);
  const url = `https://huggingface.co/${REPO}/resolve/main/${FILE}`;
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
  const total = Number(res.headers.get('content-length')) || null;
  await mkdir(dirname(TARGET), { recursive: true });
  const part = `${TARGET}.part`;
  await rm(part, { force: true }).catch(() => undefined);
  const fh = await open(part, 'w');
  let received = 0;
  const reader = res.body;
  for await (const chunk of reader) {
    await fh.write(chunk);
    received += chunk.byteLength;
    const pct = total ? ((received / total) * 100).toFixed(1) : '?';
    process.stdout.write(
      `\r[smoke] ${(received / 1e6).toFixed(0)} MB / ${total ? (total / 1e6).toFixed(0) + ' MB' : '?'} (${pct}%)   `,
    );
  }
  process.stdout.write('\n');
  await fh.close();
  await rename(part, TARGET);
  console.log('[smoke] Descarga completa.');
}

await ensureModel();

const llama = await session();
console.log('[smoke] Cargando modelo…');
const model = await llama.loadModel({ modelPath: TARGET });
const ctx = await model.createContext({ contextSize: 4096 });
const sequence = ctx.getSequence();
const chat = new LlamaChatSession({
  contextSequence: sequence,
  chatWrapper: 'auto',
  autoDisposeSequence: true,
});

chat.setChatHistory([
  {
    type: 'system',
    text:
      'Sos el "Copilot del Director" de ResiliencIA: asistente admin, analítico, conciso, en español rioplatense.\n' +
      'Solo usás el contexto dado, nunca inventás datos, y solo proponés (no ejecutás nada). Respuestas breves.\n\n' +
      'Contexto de este turno:\n{"rol":"director","suscripciones":{"activas":3,"vencidas":0,"simuladas":5},"flags":{"trial_habilitado":true}}',
  },
]);

const started = Date.now();
console.log('[smoke] Generando…\n');
const out = await chat.prompt(
  'Tenemos 3 suscripciones activas y 5 simuladas en el panel. ¿Cómo analizarías si el simulador está representando bien el flujo real?',
  {
    temperature: 0.4,
    maxTokens: 320,
    onTextChunk: (t) => process.stdout.write(t),
  },
);
const elapsed = Math.round((Date.now() - started) / 100) / 10;
console.log(`\n\n--- fin --- respuesta ${out.length} chars, ${elapsed}s`);
chat.dispose();
process.exit(0);

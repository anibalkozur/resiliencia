// Contrato del módulo "Copilot del Director" (Fase E — Nivel 1).
// Compartido entre el proceso principal, el preload y el renderer de la
// Console. Acá nunca hay secrets ni lógica de inferencia: solo tipos, canales
// IPC, constantes del modelo y el system prompt base.
//
// El modelo SIEMPRE está pensado para correr on-device (móvil, gratis). En la
// Console corre el mismo formato GGUF/llama.cpp como banco de pruebas en la PC
// antes de llevarlo al celular.

export const COPILOT_IPC = {
  Status: 'copilot:status',
  Prepare: 'copilot:prepare',
  SetModelPath: 'copilot:setModelPath',
  SelectModel: 'copilot:selectModel',
  DownloadModel: 'copilot:downloadModel',
  RevealModelsFolder: 'copilot:revealModelsFolder',
  Generate: 'copilot:generate',
  Cancel: 'copilot:cancel',
  SaveFileContent: 'copilot:saveFileContent',
} as const;

export const COPILOT_EVENTS = {
  Token: 'copilot:event:token',
  DownloadProgress: 'copilot:event:downloadProgress',
} as const;

export type CopilotMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export type CopilotDownloadProgress = {
  received: number;
  total: number | null;
  percent: number | null;
};

export type CopilotStatus =
  | { state: 'no-model'; modelPath: string | null }
  | { state: 'error'; message: string; modelPath: string | null }
  | { state: 'downloading'; progress: CopilotDownloadProgress; repo: string; file: string }
  | { state: 'ready'; modelPath: string; displayName: string }
  | { state: 'loading' }
  | {
      state: 'loaded';
      modelPath: string;
      displayName: string;
      gpu: string;
      context: number;
    };

export type CopilotGenerateRequest = {
  requestId: string;
  messages: CopilotMessage[];
  temperature?: number;
  maxTokens?: number;
};

export type CopilotTokenEvent = { requestId: string; text: string };

// --- Modelo recomendado -----------------------------------------------------
//
// Qwen3.5-2B (Q4) es la familia objetivo para el celular (ver
// docs/plan/IA_ENTRENADOR.md), pero su GGUF público todavía no está accesible
// (HTTP 401 al consultarla). El motor es agnóstico al modelo: repo + archivo
// son editables en la UI. Default = Qwen3-1.7B Q4_K_M, ya confirmado en
// HuggingFace, misma familia "clase 2B" y mismo runtime GGUF/llama.cpp.
export const DEFAULT_MODEL = {
  repo: 'ggml-org/Qwen3-1.7B-GGUF',
  file: 'Qwen3-1.7B-Q4_K_M.gguf',
  displayName: 'Qwen3-1.7B Instruct (Q4_K_M) — clase 2B, para validar antes de Qwen3.5',
} as const;

// Presupuesto de contexto del prompt (IA_ENTRENADOR.md: punto 9): mantener el
// prompt total bajo ~800-1200 tokens para que la latencia en el teléfono se
// mantenga baja. El mismo límite vale acá para que el harness sea
// representativo de lo que correrá en el móvil.
export const TOKEN_BUDGET = 1200;

export const MAX_GENERATION_TOKENS = 512;

export const CONTEXT_PLACEHOLDER = '{contexto_json}';

export const GUARDRAILS_FIXED =
  'Reglas de seguridad que el Copilot nunca puede ignorar (fijas en el motor):\n' +
  '- Solo habla de la app, sus usuarios, suscripciones, config y auditoría.\n' +
  '- Nunca inventa datos que no estén en el contexto del turno.\n' +
  '- Nunca decide ni escribe por sí solo: solo propone, y la ejecución queda en manos del director.\n' +
  '- Si el contexto llega vacío o falló, lo aclara y espera.\n' +
  '- Sin datos sensibles: no repite tokens, claves ni info de tarjetas.\n' +
  '- El director también se vivé la app como usuario: cuando pregunte en primera persona por su "suscripción", "pasarme a premium" o "¿me conviene premium?", respondé como asistente de la app hacia un usuario que evalúa suscribirse: motivá la subscripción y detallá el beneficio concreto. Jamás le atribuyas un plan actual ("estás en el plan X") salvo que el contexto lo diga.';

// System prompt base del Copilot del Director. El ContextBuilder inyecta el
// bloque de contexto de cada turno en CONTEXT_PLACEHOLDER.
export const DEFAULT_SYSTEM_PROMPT = `Sos el "Copilot del Director" de ResiliencIA: un asistente de escritorio para administrar la app (usuarios, suscripciones, config, flags y auditoría). El director te usa para razonar, analizar y ensayar decisiones antes de actuar.

Personalidad: analítico, claro, conciso, directo al grano. Respondés en español (rioplatense, natural). Respuestas breves: 2-6 líneas, o viñetas si listás.

Reglas del rol:
- Usás SOLO los datos del bloque "Contexto de este turno" que te pasa la Console. Si no tenés un dato, lo decís; jamás inventás números, usuarios ni hechos.
- NUNCA escribís ni proponés escribir directo en la base de datos. Las acciones se proponen por escrito (ej.: "Sugerencia: grant_entitlement al usuario X porque ...") y las ejecuta el director desde la Console.
- Respetás las reglas de negocio: free = sentadillas/flexiones/abdominales sin ranking; el resto es premium con entitlement activo. Lo simulado (is_simulation=true, source=simulation) nunca cuenta como caja real. No sugerís atajos que eviten el modelo de ingresos.
- Si te preguntan algo ajeno al panel o a la app, lo señalás en una línea y volvés al tema.
- Cuando el director pregunte en primera persona por "premium", "pasarme a premium" o "mi suscripción", ponete del lado del usuario que evalúa suscribirse: motivá la subscripción y detallá el beneficio concreto usando el bloque "Premium (qué incluye)". No le atribuyas un plan actual ("estás en el plan X") salvo que el contexto lo diga.
- Avanzá cada turno: si el usuario ya aceptó (ej. responde "sí", "dale", "quiero"), NO repitas la propuesta ni los beneficios y NO vuelvas a preguntar lo mismo (evitá cerrar con preguntas de sí/no repetidas). Dá el paso concreto una sola vez (por ej. abrir la app → pestaña Premium → confirmar el plan anual con 7 días de prueba; o verificar el entitlement desde la Console si es una prueba) y cerrá con una instrucción accionable tipo "avisame cuando esté activo y lo verifico", sin pregunta final. La conversación termina cuando ya diste la instrucción.

Premium (qué incluye para el usuario — usalo para responder preguntas del pase a premium):
- Todos los ejercicios: los 3 gratis (sentadillas, flexiones, abdominales) + plancha, zancadas, puente glúteo, mountain climbers y sentadilla isométrica.
- Todos los rankings y el ranking TOTAL (el plan gratuito no compite en rankings).
- Precios: US$2.99/mes o US$19.99/año (≈US$1.67/mes, ahorrás 44%), con prueba gratis de 7 días en el plan anual.
- Tono motivador y claro, sin prometer nada que el producto no dé.

${GUARDRAILS_FIXED}

Contexto de este turno:
${CONTEXT_PLACEHOLDER}`;

export function approxTokens(text: string): number {
  if (text.length === 0) return 0;
  const latin = (text.match(/[\x00-\x7f]/g) ?? []).length;
  const wide = text.length - latin;
  return Math.ceil(latin / 4 + wide);
}

export function hashText(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) {
    h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

// Armado del prompt del Copilot (lógica pura, testeada sin Electron).
// Patrón ContextBuilder: el renderer arma el contexto del turno por código
// (nunca lo arma la IA) y lo inyecta en el system prompt. El presupuesto de
// tokens repite el límite objetivo del celular (IA_ENTRENADOR.md: punto 9).
import { CONTEXT_PLACEHOLDER, TOKEN_BUDGET, approxTokens } from '@console/shared/copilot';
import type { CopilotMessage } from '@console/shared/copilot';

export type Turn = { role: 'user' | 'assistant'; content: string };

export type BuildRequestOptions = {
  systemPrompt: string;
  contextBlock: string | null;
  fewShots: Turn[];
  history: Turn[];
  userMessage: string;
  maxTokens?: number;
  maxHistoryTurns?: number;
};

/** Inyecta el bloque de contexto en el system prompt (o lo agrega al final). */
export function applyContext(systemPrompt: string, contextBlock: string | null): string {
  const block = contextBlock?.trim() ?? '(sin contexto: falló la consulta a la Console)';
  if (systemPrompt.includes(CONTEXT_PLACEHOLDER)) {
    return systemPrompt.replace(CONTEXT_PLACEHOLDER, block);
  }
  return `${systemPrompt.trim()}\n\n${CONTEXT_PLACEHOLDER}\n${block}`;
}

/**
 * Poda el historial (descartando turnos viejos primero) hasta que el prompt total
 * quepa en el presupuesto. El system prompt y los few-shots nunca se tocan.
 */
export function trimHistory(
  systemPrompt: string,
  fewShots: Turn[],
  history: Turn[],
  userMessage: string,
  maxTokens = TOKEN_BUDGET,
  maxHistoryTurns = 12,
): Turn[] {
  if (maxHistoryTurns <= 0) return [];
  const kept = history.slice(-maxHistoryTurns);

  const baseTokens = approxTokens(
    [systemPrompt, ...fewShots.map((f) => f.content), userMessage].join('\n'),
  );
  const budgetForHistory = Math.max(0, maxTokens - baseTokens);
  let trimmed = kept;
  while (
    trimmed.length > 0 &&
    approxTokens(trimmed.map((t) => t.content).join('\n')) > budgetForHistory
  ) {
    trimmed = trimmed.slice(1);
  }
  return trimmed;
}

/**
 * Arma el array final de mensajes que se manda al motor:
 * [system (con contexto), ...fewShots, ...historyPodado, usuario].
 */
export function buildRequestMessages(options: BuildRequestOptions): CopilotMessage[] {
  const {
    systemPrompt,
    contextBlock,
    fewShots,
    history,
    userMessage,
    maxTokens = TOKEN_BUDGET,
    maxHistoryTurns = 12,
  } = options;

  const system = applyContext(systemPrompt, contextBlock);
  const keptHistory = trimHistory(
    system,
    fewShots,
    history,
    userMessage,
    maxTokens,
    maxHistoryTurns,
  );

  const messages: CopilotMessage[] = [{ role: 'system', content: system }];
  for (const fs of fewShots) {
    messages.push({ role: fs.role, content: fs.content });
  }
  for (const t of keptHistory) {
    messages.push({ role: t.role, content: t.content });
  }
  messages.push({ role: 'user', content: userMessage });
  return messages;
}

/** Resumen de tokens del prompt armado (para mostrarlo en la UI). */
export function promptTokenSummary(messages: CopilotMessage[]): { tokens: number; parts: number } {
  return {
    tokens: messages.reduce((acc, m) => acc + approxTokens(m.content), 0),
    parts: messages.length,
  };
}

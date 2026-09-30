import { describe, expect, it } from 'vitest';
import {
  applyContext,
  buildRequestMessages,
  promptTokenSummary,
  trimHistory,
} from '../copilot/prompt';

const SYSTEM = 'Sos el Copilot.\n\nContexto de este turno:\n{contexto_json}';
const CONTEXT = '{"rol":"director"}';

describe('applyContext', () => {
  it('reemplaza el placeholder con el bloque de contexto', () => {
    expect(applyContext(SYSTEM, CONTEXT)).toContain('{"rol":"director"}');
    expect(applyContext(SYSTEM, CONTEXT)).not.toContain('{contexto_json}');
  });

  it('agrega el bloque al final si no hay placeholder', () => {
    const out = applyContext('System primordial', CONTEXT);
    expect(out.startsWith('System primordial')).toBe(true);
    expect(out).toContain('{contexto_json}');
    expect(out).toContain('{"rol":"director"}');
  });

  it('indica que no hubo contexto cuando viene null', () => {
    const out = applyContext(SYSTEM, null);
    expect(out).toContain('sin contexto');
  });
});

describe('trimHistory', () => {
  const few = [{ role: 'user' as const, content: 'ejemplo' }];
  const history = Array.from({ length: 20 }, (_, i) => ({
    role: 'user' as const,
    content: `turno ${i}`.repeat(60), // ~360 chars por turno para exceder el presupuesto
  }));

  it('respeta el tope de turnos', () => {
    const out = trimHistory(SYSTEM, [], history, 'hola', 1200, 8);
    expect(out.length).toBeLessThanOrEqual(8);
  });

  it('descarta turnos viejos cuando el prompt excede el presupuesto', () => {
    const out = trimHistory(SYSTEM, few, history, 'hola', 400, 200);
    expect(out.length).toBeLessThan(history.length);
    expect(out.length).toBeGreaterThan(0);
  });

  it('devuelve vacío con presupuesto mínimo', () => {
    const out = trimHistory(SYSTEM, few, history, 'hola', 10, 200);
    expect(out.length).toBe(0);
  });

  it('mantiene el turno más reciente cuando hay espacio', () => {
    const out = trimHistory(
      SYSTEM,
      [],
      [{ role: 'user' as const, content: 'último' }],
      'hola',
      1200,
      4,
    );
    expect(out.map((t) => t.content)).toEqual(['último']);
  });
});

describe('buildRequestMessages', () => {
  it('arma [system, fewshots, historial, usuario] en ese orden', () => {
    const messages = buildRequestMessages({
      systemPrompt: SYSTEM,
      contextBlock: CONTEXT,
      fewShots: [
        { role: 'user', content: 'p1' },
        { role: 'assistant', content: 'r1' },
      ],
      history: [{ role: 'user', content: 'h1' }],
      userMessage: 'pregunta final',
    });
    expect(messages.map((m) => m.role)).toEqual(['system', 'user', 'assistant', 'user', 'user']);
    expect(messages[0]!.content).toContain('{"rol":"director"}');
    expect(messages[messages.length - 1]!.content).toBe('pregunta final');
  });

  it('con historial vacío queda [system, usuario]', () => {
    const messages = buildRequestMessages({
      systemPrompt: SYSTEM,
      contextBlock: null,
      fewShots: [],
      history: [],
      userMessage: 'sola',
    });
    expect(messages.map((m) => m.role)).toEqual(['system', 'user']);
  });

  it('el system prompt nunca pierde el contexto por más historial que haya', () => {
    const big = Array.from({ length: 40 }, () => ({
      role: 'user' as const,
      content: `x`.repeat(500),
    }));
    const messages = buildRequestMessages({
      systemPrompt: SYSTEM,
      contextBlock: CONTEXT,
      fewShots: [{ role: 'assistant', content: 'y'.repeat(400) }],
      history: big,
      userMessage: 'z',
      maxTokens: 500,
    });
    expect(messages[0]!.role).toBe('system');
    expect(messages[0]!.content).toContain('{"rol":"director"}');
    expect(messages[messages.length - 1]!.content).toBe('z');
  });
});

describe('promptTokenSummary', () => {
  it('cuenta partes y tokens', () => {
    const messages = buildRequestMessages({
      systemPrompt: SYSTEM,
      contextBlock: CONTEXT,
      fewShots: [],
      history: [],
      userMessage: 'hola',
    });
    const s = promptTokenSummary(messages);
    expect(s.parts).toBe(2);
    expect(s.tokens).toBeGreaterThan(0);
  });
});

// "Copilot del Director" — Fase E, Nivel 1.
// Chat contra un LLM 100% local (llama.cpp) con contexto armado por la app,
// prompts editables y un harness de evaluación (marcar buena/mala respuesta)
// para ir condicionando el comportamiento del modelo.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CopilotStatus } from '@console/shared/copilot';
import { DEFAULT_MODEL, TOKEN_BUDGET } from '@console/shared/copilot';
import { copilotBridge, buildContextBlock } from '../lib/copilot/client';
import { buildRequestMessages, promptTokenSummary } from '../lib/copilot/prompt';
import type { Turn } from '../lib/copilot/prompt';
import {
  makeLocalStore,
  localStorageKV,
  defaultConfig,
  upsertFewShot,
  removeFewShot,
  removeRating,
  ratingToFewShot,
  ratingsToDataset,
  promptFingerprint,
} from '../lib/copilot/store';
import type { CopilotConfig, RatingRecord } from '../lib/copilot/store';

type Pane = 'chat' | 'ajustes' | 'eval';

type ChatMsg = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  rating?: 'good' | 'bad';
  note?: string;
};

const SESSION_ID = 'por-defecto';

export function CopilotView() {
  const store = useMemo(() => makeLocalStore(localStorageKV), []);
  const [pane, setPane] = useState<Pane>('chat');
  const [status, setStatus] = useState<CopilotStatus | null>(null);
  const [config, setConfig] = useState<CopilotConfig>(() => defaultConfig());
  const [ratings, setRatings] = useState<RatingRecord[]>([]);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [ratingDraft, setRatingDraft] = useState<{ messageId: string; note: string } | null>(null);
  const requestIdRef = useRef<string | null>(null);

  const loadedModel = status?.state === 'loaded' ? status : null;
  const downloading = status?.state === 'downloading' ? status : null;

  const applyStatus = useCallback((s: CopilotStatus) => setStatus(s), []);

  const prepare = useCallback(() => {
    setStatus({ state: 'loading' });
    void copilotBridge
      .prepare()
      .then(applyStatus)
      .catch((err) =>
        setStatus({
          state: 'error',
          message: err instanceof Error ? err.message : String(err),
          modelPath: null,
        }),
      );
  }, [applyStatus]);

  useEffect(() => {
    const configLoaded = store.loadConfig();
    setConfig({ ...defaultConfig(), ...configLoaded });
    setRatings(store.loadRatings());
    setMessages(
      store
        .loadSession(SESSION_ID)
        .map((m, i) => ({ id: `s-${i}`, role: m.role, content: m.content })),
    );
    void copilotBridge
      .getStatus()
      .then(applyStatus)
      .catch(() => applyStatus({ state: 'no-model', modelPath: null }));

    const offToken = copilotBridge.onToken(({ requestId, text }) => {
      if (requestId !== requestIdRef.current) return;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (!last || last.role !== 'assistant') return prev;
        return [...prev.slice(0, -1), { ...last, content: last.content + text }];
      });
    });
    const offProgress = copilotBridge.onDownloadProgress((progress) => {
      setStatus((s) => (s?.state === 'downloading' ? { ...s, progress } : s));
    });
    return () => {
      offToken();
      offProgress();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    store.saveSession(
      SESSION_ID,
      messages.filter((m) => m.content.length > 0),
    );
  }, [messages, store]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || busy) return;
    if (status?.state !== 'loaded' && status?.state !== 'loading' && status?.state !== 'ready') {
      setError('El modelo todavía no está listo. Descargalo o cargalo desde Ajustes.');
      return;
    }

    setError(null);
    setBusy(true);
    const requestId = crypto.randomUUID();
    requestIdRef.current = requestId;

    const userMsg: ChatMsg = { id: `u-${requestId}`, role: 'user', content: text };
    const assistantMsg: ChatMsg = { id: `a-${requestId}`, role: 'assistant', content: '' };
    const next = [...messages, userMsg, assistantMsg];
    setMessages(next);
    setInput('');

    const historyTurns: Turn[] = messages
      .filter((m) => m.content.length > 0)
      .map((m) => ({ role: m.role, content: m.content }));

    const contextBlock = config.contextEnabled ? await buildContextBlock().catch(() => null) : null;

    try {
      const promptMessages = buildRequestMessages({
        systemPrompt: config.systemPrompt,
        contextBlock,
        fewShots: config.fewShots,
        history: historyTurns,
        userMessage: text,
        maxTokens: TOKEN_BUDGET,
        maxHistoryTurns: config.maxHistoryTurns,
      });
      const final = await copilotBridge.generate({
        requestId,
        messages: promptMessages,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
      });
      setMessages((prev) => [
        ...prev.slice(0, -1),
        { ...prev[prev.length - 1]!, content: final.text },
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(`No se pudo generar la respuesta: ${message}`);
      setMessages((prev) => prev.filter((m) => m.id !== assistantMsg.id));
    } finally {
      setBusy(false);
      requestIdRef.current = null;
    }
  }, [input, busy, status, messages, config]);

  const cancel = useCallback(() => {
    if (requestIdRef.current) void copilotBridge.cancel(requestIdRef.current);
  }, []);

  const rate = useCallback(
    (messageId: string, rating: 'good' | 'bad') => {
      const msg = messages.find((m) => m.id === messageId);
      if (!msg || msg.role !== 'assistant') return;
      const idx = messages.findIndex((m) => m.id === messageId);
      const previous = idx > 0 ? messages[idx - 1] : null;
      if (rating === 'bad' && !ratingDraft) {
        setRatingDraft({ messageId, note: '' });
        return;
      }
      const note = rating === 'bad' ? (ratingDraft?.note ?? '') : (ratingDraft?.note ?? '');
      const record: RatingRecord = {
        id: `r-${messageId}`,
        sessionId: SESSION_ID,
        ts: new Date().toISOString(),
        rating,
        userMessage: previous?.role === 'user' ? previous.content : '',
        assistantText: msg.content,
        note,
        modelFile: loadedModel?.modelPath ?? '',
        promptVersion: promptFingerprint(config, loadedModel?.modelPath ?? ''),
      };
      setRatings((prev) => {
        const next = [...prev, record];
        store.saveRatings(next);
        return next;
      });
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, rating, note } : m)));
      setRatingDraft(null);
    },
    [messages, ratings, ratingDraft, loadedModel, config, store],
  );

  const promoteExample = useCallback(
    (record: RatingRecord) => {
      const pair = ratingToFewShot(record);
      setConfig((prev) => {
        const next = { ...prev, fewShots: upsertFewShot(prev.fewShots, pair) };
        store.saveConfig(next);
        return next;
      });
      setInfo(
        'Respuesta promovida a ejemplo few-shot. Ya condiciona el tono de las próximas generaciones.',
      );
    },
    [store],
  );

  const modelFile = loadedModel?.modelPath ?? '';
  const summary = useMemo(() => {
    if (messages.length === 0) return null;
    const tries = buildRequestMessages({
      systemPrompt: config.systemPrompt,
      contextBlock: null,
      fewShots: config.fewShots,
      history: messages
        .filter((m) => m.content.length > 0)
        .map((m) => ({ role: m.role, content: m.content })),
      userMessage: '…',
      maxTokens: TOKEN_BUDGET,
      maxHistoryTurns: config.maxHistoryTurns,
    });
    return promptTokenSummary(tries);
  }, [messages, config]);

  return (
    <div>
      <div className="copilot-head">
        <div className="copilot-tabs">
          <button
            className={`copilot-tab${pane === 'chat' ? ' active' : ''}`}
            onClick={() => setPane('chat')}
          >
            Chat
          </button>
          <button
            className={`copilot-tab${pane === 'ajustes' ? ' active' : ''}`}
            onClick={() => setPane('ajustes')}
          >
            Ajustes
          </button>
          <button
            className={`copilot-tab${pane === 'eval' ? ' active' : ''}`}
            onClick={() => setPane('eval')}
          >
            Evaluaciones
          </button>
        </div>
        <ModelStatus status={status} onOpenSettings={() => setPane('ajustes')} />
      </div>

      {error && <div className="error">{error}</div>}
      {info && (
        <div className="ok">
          {info}
          <button className="btn close-info" onClick={() => setInfo(null)}>
            x
          </button>
        </div>
      )}

      {pane === 'chat' && (
        <ChatPane
          messages={messages}
          busy={busy}
          input={input}
          setInput={setInput}
          onSend={() => void send()}
          onCancel={cancel}
          onRate={rate}
          ratingDraft={ratingDraft}
          setRatingDraft={setRatingDraft}
          loaded={Boolean(loadedModel) || status?.state === 'loading'}
          status={status}
          summary={summary}
          downloadingProgress={downloading?.progress ?? null}
          onOpenSettings={() => setPane('ajustes')}
          onPrepare={prepare}
        />
      )}
      {pane === 'ajustes' && (
        <SettingsPane
          config={config}
          onChange={setConfig}
          onSave={() => {
            store.saveConfig(config);
            setInfo('Configuración guardada. La próxima generación usa el prompt actualizado.');
          }}
          status={status}
          onStatus={applyStatus}
          onInfo={setInfo}
        />
      )}
      {pane === 'eval' && (
        <EvalsPane
          ratings={ratings}
          onRemove={(id) => {
            setRatings((prev) => {
              const next = removeRating(prev, id);
              store.saveRatings(next);
              return next;
            });
          }}
          onPromote={promoteExample}
          onExport={() => {
            const json = ratingsToDataset(ratings, config, modelFile);
            const name = `resiliencia-copilot-dataset-v1.json`;
            void copilotBridge.saveFileContent(name, json).then((path) => {
              if (path) setInfo(`Dataset exportado a ${path}`);
            });
          }}
        />
      )}
    </div>
  );
}

function ModelStatus({
  status,
  onOpenSettings,
}: {
  status: CopilotStatus | null;
  onOpenSettings: () => void;
}) {
  if (!status) return <span className="mono dim">Motor: chequeando…</span>;
  if (status.state === 'loaded') {
    return (
      <span className="mono ok-badge">
        Motor listo — {status.displayName} (gpu {status.gpu}, ctx {status.context})
      </span>
    );
  }
  if (status.state === 'loading') return <span className="mono dim">Motor: cargando modelo…</span>;
  if (status.state === 'ready') {
    return (
      <span className="mono ok-badge">
        Motor: descargado — <strong>{status.displayName}</strong> (pendiente de cargar)
      </span>
    );
  }
  if (status.state === 'downloading') {
    return <span className="mono dim">Motor: descargando modelo…</span>;
  }
  if (status.state === 'error') {
    return (
      <button className="btn" onClick={onOpenSettings} title={status.message}>
        Motor: error — ir a Ajustes
      </button>
    );
  }
  return (
    <button className="btn primary" onClick={onOpenSettings}>
      Motor: sin modelo — configurarlo
    </button>
  );
}

type ChatPaneProps = {
  messages: ChatMsg[];
  busy: boolean;
  input: string;
  setInput: (v: string) => void;
  onSend: () => void;
  onCancel: () => void;
  onRate: (id: string, rating: 'good' | 'bad') => void;
  ratingDraft: { messageId: string; note: string } | null;
  setRatingDraft: (v: { messageId: string; note: string } | null) => void;
  loaded: boolean;
  status: CopilotStatus | null;
  summary: { tokens: number; parts: number } | null;
  downloadingProgress: { percent: number | null; received: number; total: number | null } | null;
  onOpenSettings: () => void;
  onPrepare: () => void;
};

function ChatPane({
  messages,
  busy,
  input,
  setInput,
  onSend,
  onCancel,
  onRate,
  ratingDraft,
  setRatingDraft,
  loaded,
  status,
  summary,
  downloadingProgress,
  onOpenSettings,
  onPrepare,
}: ChatPaneProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  if (status?.state === 'error') {
    return (
      <div className="card">
        <h2>El motor tiene un problema</h2>
        <p className="mono">{status.message}</p>
        <p>
          Revisá los Ajustes del Copilot: podés reintentar la descarga o elegir otro archivo .gguf.
        </p>
        <button className="btn primary" onClick={onOpenSettings}>
          Ir a Ajustes
        </button>
      </div>
    );
  }

  if (status?.state === 'no-model') {
    return (
      <div className="card">
        <h2>Primera vez con el Copilot</h2>
        <p>
          El asistente corre <strong>100% local en esta PC</strong> (llama.cpp) con el mismo formato
          de modelo que después irá al celular: gratis y sin mandar datos afuera.
        </p>
        <p className="ok">
          Descarga recomendada: <span className="mono">{DEFAULT_MODEL.repo}</span> ·{' '}
          <span className="mono">{DEFAULT_MODEL.file}</span> (≈1.3 GB, clase 2B on-device)
        </p>
        <div className="row">
          <button className="btn primary" onClick={onOpenSettings}>
            Configurar el modelo
          </button>
        </div>
      </div>
    );
  }

  if (status?.state === 'ready') {
    return (
      <div className="card">
        <h2>Modelo descargado</h2>
        <p>
          El archivo <span className="mono">{status.displayName}</span> ya está en esta PC. Para
          empezar hay que cargarlo a memoria (ocupa ~3 GB de RAM, tarda unos segundos).
        </p>
        <div className="row">
          <button className="btn primary" onClick={onPrepare}>
            Cargar modelo
          </button>
          <button className="btn" onClick={onOpenSettings}>
            Otras opciones
          </button>
        </div>
      </div>
    );
  }

  if (!loaded || status?.state === 'downloading') {
    return (
      <div className="card">
        <h2>Preparando el modelo</h2>
        {downloadingProgress && (
          <div className="progress">
            <div
              className="progress-bar"
              style={{ width: `${Math.round((downloadingProgress.percent ?? 0) * 100)}%` }}
            />
          </div>
        )}
        <p className="mono dim">
          {downloadingProgress
            ? `Descargando ${(downloadingProgress.percent ?? 0).toFixed(0)}% (${(
                downloadingProgress.received /
                1024 /
                1024
              ).toFixed(0)} MB)`
            : 'Cargando el modelo a memoria (la primera vez tarda unos segundos)…'}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className={`chat${busy ? ' busy' : ''}`} ref={scrollRef}>
        {messages.length === 0 && (
          <p className="empty">
            Probá el Copilot: preguntale por el estado del panel, simulá una decisión o contale un
            caso y pedile que lo analice. Marcá sus respuestas como buenas o inapropiadas para ir
            condicionando cómo responde.
          </p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`chat-msg ${m.role}`}>
            <div className="chat-msg-bubble">{m.content || '…'}</div>
            {m.role === 'assistant' && m.content.length > 0 && (
              <div className="chat-msg-actions">
                {m.rating === 'good' && <span className="badge active">correcta</span>}
                {m.rating === 'bad' && <span className="badge direct">inapropiada</span>}
                {!m.rating && (
                  <>
                    <button className="btn tiny ok-btn" onClick={() => onRate(m.id, 'good')}>
                      Correcta
                    </button>
                    <button className="btn tiny bad-btn" onClick={() => onRate(m.id, 'bad')}>
                      Inapropiada
                    </button>
                  </>
                )}
                {ratingDraft?.messageId === m.id && (
                  <div className="row rating-note">
                    <input
                      className="input grow"
                      placeholder="¿Qué estuvo mal? (útil para el dataset)"
                      value={ratingDraft.note}
                      onChange={(e) => setRatingDraft({ messageId: m.id, note: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') onRate(m.id, 'bad');
                        if (e.key === 'Escape') setRatingDraft(null);
                      }}
                    />
                    <button className="btn" onClick={() => onRate(m.id, 'bad')}>
                      Guardar
                    </button>
                    <button className="btn" onClick={() => setRatingDraft(null)}>
                      Cancelar
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="chat-compose">
        {summary && (
          <span className="mono dim">
            prompt ≈ {summary.tokens} tokens / {summary.parts} partes
          </span>
        )}
        <div className="row">
          <textarea
            className="input chat-input"
            rows={2}
            placeholder="Escribí tu pregunta o caso para el Copilot…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
            disabled={busy}
          />
          {busy ? (
            <button className="btn danger" onClick={onCancel}>
              Cancelar
            </button>
          ) : (
            <button className="btn primary" onClick={onSend} disabled={!input.trim()}>
              Enviar
            </button>
          )}
        </div>
      </div>
    </>
  );
}

function getStatusMsg(s: CopilotStatus): string {
  if (s.state === 'loaded') return `Modelo cargado: ${s.displayName}`;
  if (s.state === 'error') return `No anduvo: ${s.message}`;
  return 'Listo.';
}

type SettingsPaneProps = {
  config: CopilotConfig;
  onChange: (c: CopilotConfig) => void;
  onSave: () => void;
  status: CopilotStatus | null;
  onStatus: (s: CopilotStatus) => void;
  onInfo: (msg: string) => void;
};

function SettingsPane({ config, onChange, onSave, status, onStatus, onInfo }: SettingsPaneProps) {
  const set = <K extends keyof CopilotConfig>(k: K, v: CopilotConfig[K]) =>
    onChange({ ...config, [k]: v });

  return (
    <>
      <div className="card">
        <h2>Modelo</h2>
        {status?.state === 'loaded' && (
          <p className="ok">
            Modelo cargado: <span className="mono">{status.displayName}</span> — gpu {status.gpu},
            contexto {status.context}. Este mismo GGUF/llama.cpp es el formato que se usa en el
            celular (on-device, gratis).
          </p>
        )}
        <div className="row">
          <div className="grow">
            <span className="label">Repositorio (repo del modelo)</span>
            <input
              className="input"
              value={config.repo}
              onChange={(e) => set('repo', e.target.value)}
            />
          </div>
          <div className="grow">
            <span className="label">Archivo GGUF</span>
            <input
              className="input"
              value={config.file}
              onChange={(e) => set('file', e.target.value)}
            />
          </div>
        </div>
        <div className="row copilot-actions">
          <button
            className="btn primary"
            disabled={status?.state === 'downloading'}
            onClick={() =>
              void copilotBridge.downloadModel(config.repo.trim(), config.file.trim()).then((s) => {
                onStatus(s);
                onInfo(getStatusMsg(s));
              })
            }
          >
            {status?.state === 'downloading' ? 'Descargando…' : 'Descargar / validar modelo'}
          </button>
          <button
            className="btn"
            onClick={() =>
              void copilotBridge.selectModel().then((s) => {
                onStatus(s);
                onInfo(getStatusMsg(s));
              })
            }
          >
            Seleccionar .gguf existente
          </button>
          <button className="btn" onClick={() => void copilotBridge.revealModelsFolder()}>
            Abrir carpeta de modelos
          </button>
          {status?.state !== 'no-model' && (
            <button
              className="btn danger"
              onClick={() =>
                void copilotBridge.setModelPath(null).then((s) => {
                  onStatus(s);
                  onInfo('Modelo removido.');
                })
              }
            >
              Quitar modelo
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <h2>Prompts</h2>
        <span className="label">
          System prompt (editable — el contexto del turno se inyecta en {'{contexto_json}'})
        </span>
        <textarea
          className="input copilot-prompt"
          rows={10}
          value={config.systemPrompt}
          onChange={(e) => set('systemPrompt', e.target.value)}
        />
        <button className="btn" onClick={() => set('systemPrompt', defaultConfig().systemPrompt)}>
          Restaurar prompt por defecto
        </button>

        <div className="label">Ejemplos few-shot (condicionan el comportamiento)</div>
        {config.fewShots.length === 0 && (
          <p className="empty">
            Todavía no hay ejemplos. En Evaluaciones podés promover una respuesta marcada como
            correcta.
          </p>
        )}
        {config.fewShots.map((fs, i) => (
          <div key={`${fs.role}-${i}`} className="row fewshot-row">
            <select
              className="select role-select"
              value={fs.role}
              onChange={(e) =>
                set(
                  'fewShots',
                  config.fewShots.map((f, j) =>
                    j === i ? { ...f, role: e.target.value as Turn['role'] } : f,
                  ),
                )
              }
            >
              <option value="user">usuario</option>
              <option value="assistant">asistente</option>
            </select>
            <textarea
              className="input grow"
              rows={2}
              value={fs.content}
              onChange={(e) =>
                set(
                  'fewShots',
                  config.fewShots.map((f, j) => (j === i ? { ...f, content: e.target.value } : f)),
                )
              }
            />
            <button
              className="btn danger"
              onClick={() => set('fewShots', removeFewShot(config.fewShots, i))}
            >
              x
            </button>
          </div>
        ))}
        <div className="row">
          <button
            className="btn"
            onClick={() => set('fewShots', [...config.fewShots, { role: 'user', content: '' }])}
          >
            + Agregar ejemplo
          </button>
        </div>
      </div>

      <div className="card">
        <h2>Parámetros</h2>
        <label className="label">
          Temperatura (0 = siempre igual) — <span className="mono">{config.temperature}</span>
        </label>
        <input
          className="input range"
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={config.temperature}
          onChange={(e) => set('temperature', Number(e.target.value))}
        />
        <div className="row">
          <div className="grow">
            <span className="label">Tope de tokens de respuesta ({config.maxTokens})</span>
            <input
              className="input"
              type="number"
              min={64}
              max={2048}
              step={32}
              value={config.maxTokens}
              onChange={(e) => set('maxTokens', Number(e.target.value))}
            />
          </div>
          <div className="grow">
            <span className="label">Turnos de historial a recordar ({config.maxHistoryTurns})</span>
            <input
              className="input"
              type="number"
              min={0}
              max={16}
              step={1}
              value={config.maxHistoryTurns}
              onChange={(e) => set('maxHistoryTurns', Number(e.target.value))}
            />
          </div>
          <div className="grow">
            <span className="label">Inyectar contexto del panel (ContextBuilder)</span>
            <label className="check">
              <input
                type="checkbox"
                checked={config.contextEnabled}
                onChange={(e) => set('contextEnabled', e.target.checked)}
              />
              sí, cada turno
            </label>
          </div>
        </div>
        <p className="mono dim">
          Límite total del prompt: ~{TOKEN_BUDGET} tokens (igual que el objetivo del celular).
          Respuesta máxima: {config.maxTokens} tokens.
        </p>
      </div>

      <div className="card">
        <h2>Guardarraíles (fijos)</h2>
        <p className="mono dim" style={{ whiteSpace: 'pre-line' }}>
          {[
            'La IA solo propone: nunca escribe en la base de datos ni auto-aplica cambios.',
            'El contexto del turno lo arma la app por código (ContextBuilder); la IA nunca consulta datos por sí sola.',
            'La salida de la IA es no confiable (posible prompt injection) y nunca dispara una acción por sí sola.',
            'Lo simulado no cuenta como caja real.',
          ].join('\n')}
        </p>
        <button className="btn primary" onClick={onSave}>
          Guardar configuración
        </button>
      </div>
    </>
  );
}

type EvalsPaneProps = {
  ratings: RatingRecord[];
  onRemove: (id: string) => void;
  onPromote: (r: RatingRecord) => void;
  onExport: () => void;
};

function EvalsPane({ ratings, onRemove, onPromote, onExport }: EvalsPaneProps) {
  const [filter, setFilter] = useState<'all' | 'good' | 'bad'>('all');
  const good = ratings.filter((r) => r.rating === 'good').length;
  const bad = ratings.length - good;
  const visible = ratings.filter((r) => filter === 'all' || r.rating === filter);

  return (
    <>
      <div className="card">
        <div className="section-title">
          <h2>Harness de evaluación</h2>
          <button className="btn" onClick={onExport} disabled={ratings.length === 0}>
            Exportar dataset
          </button>
        </div>
        <div className="row">
          <span className="badge">total {ratings.length}</span>
          <span className="badge active">correctas {good}</span>
          <span className="badge direct">inapropiadas {bad}</span>
          <select
            className="select"
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
          >
            <option value="all">Todas</option>
            <option value="good">Solo correctas</option>
            <option value="bad">Solo inapropiadas</option>
          </select>
        </div>
        <p className="dim">
          Cada mejora del prompt (system + few-shots) debería alargar la lista de "correctas". Podés
          promover una respuesta buena a ejemplo few-shot y así condicionar las próximas.
        </p>
      </div>

      {visible.length === 0 && <p className="empty">Todavía no hay evaluaciones en este filtro.</p>}

      {visible.map((r) => (
        <div key={r.id} className="card eval-item">
          <div className="section-title">
            <div className="row">
              <span className={`badge ${r.rating === 'good' ? 'active' : 'direct'}`}>
                {r.rating === 'good' ? 'correcta' : 'inapropiada'}
              </span>
              <span className="mono dim">{new Date(r.ts).toLocaleString()}</span>
            </div>
            <div className="row">
              {r.rating === 'good' && (
                <button className="btn tiny" onClick={() => onPromote(r)}>
                  Usar como ejemplo
                </button>
              )}
              <button className="btn tiny danger" onClick={() => onRemove(r.id)}>
                Borrar
              </button>
            </div>
          </div>
          <div className="eval-block">
            <span className="label">Usuario</span>
            <p className="mono">{r.userMessage}</p>
          </div>
          <div className="eval-block">
            <span className="label">Respuesta del Copilot</span>
            <p className="mono">{r.assistantText}</p>
          </div>
          {r.note && (
            <div className="eval-block">
              <span className="label">Nota</span>
              <p>{r.note}</p>
            </div>
          )}
          <div className="row">
            {r.modelFile && <span className="mono dim">{r.modelFile}</span>}
            {r.promptVersion && (
              <span className="mono dim">prompt v{r.promptVersion.slice(0, 6)}</span>
            )}
          </div>
        </div>
      ))}
    </>
  );
}

// Motor local del "Copilot del Director": carga el modelo GGUF (llama.cpp vía
// node-llama-cpp) en el proceso principal, genera en streaming por IPC y
// gestiona la descarga del archivo del modelo. El renderer NUNCA ve el motor:
// solo le manda un prompt armado (con contexto ya inyectado) y recibe tokens.
import { app, dialog, ipcMain, shell } from 'electron';
import { statSync } from 'node:fs';
import { stat, mkdir, rename, open, readFile, writeFile, rm } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { getLlama, LlamaChatSession, LlamaLogLevel } from 'node-llama-cpp';
import type { IpcMainInvokeEvent } from 'electron';
import { COPILOT_EVENTS, COPILOT_IPC } from '../shared/copilot';
import type {
  CopilotDownloadProgress,
  CopilotGenerateRequest,
  CopilotMessage,
  CopilotStatus,
} from '../shared/copilot';

type Handle = {
  session: LlamaChatSession;
};

const CONTEXT_SIZE = 4096;

function modelsDir(): string {
  return join(app.getPath('userData'), 'models');
}

function stateFile(): string {
  return join(app.getPath('userData'), 'copilot-state.json');
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

async function readPersistedModelPath(): Promise<string | null> {
  try {
    const raw = await readFile(stateFile(), 'utf8');
    const data = JSON.parse(raw) as { modelPath?: string | null };
    return typeof data.modelPath === 'string' && data.modelPath.length > 0 ? data.modelPath : null;
  } catch {
    return null;
  }
}

let modelPath: string | null = null;
let gpuBackend = 'cpu';
let handle: Handle | null = null;
let downloadJob: {
  controller: AbortController;
  repo: string;
  file: string;
  progress: CopilotDownloadProgress;
  promise: Promise<void>;
} | null = null;
const aborters = new Map<string, AbortController>();
let pendingChain: Promise<unknown> = Promise.resolve();

function modelFileReady(): boolean {
  if (!modelPath) return false;
  try {
    const st = statSync(modelPath);
    return st.isFile() && st.size > 0;
  } catch {
    return false;
  }
}

function toStatus(): CopilotStatus {
  if (handle?.session) {
    return {
      state: 'loaded',
      modelPath: modelPath ?? '',
      displayName: modelPath ? basename(modelPath) : 'modelo cargado',
      gpu: gpuBackend,
      context: CONTEXT_SIZE,
    };
  }
  if (downloadJob) {
    return {
      state: 'downloading',
      progress: downloadJob.progress,
      repo: downloadJob.repo,
      file: downloadJob.file,
    };
  }
  if (modelFileReady()) {
    return { state: 'ready', modelPath: modelPath ?? '', displayName: basename(modelPath ?? '') };
  }
  return { state: 'no-model', modelPath };
}

function toDownloadingStatus(): CopilotStatus {
  if (!downloadJob) return toStatus();
  return {
    state: 'downloading',
    progress: downloadJob.progress,
    repo: downloadJob.repo,
    file: downloadJob.file,
  };
}

async function disposeHandle(): Promise<void> {
  if (!handle) return;
  try {
    handle.session.dispose();
  } catch {
    /* noop */
  }
  handle = null;
  aborters.forEach((c) => c.abort());
  aborters.clear();
}

let loadingPromise: Promise<Handle> | null = null;

async function ensureModel(): Promise<Handle> {
  if (handle?.session) return handle;
  if (loadingPromise) return loadingPromise;
  loadingPromise = loadModelInternal().finally(() => {
    loadingPromise = null;
  });
  return loadingPromise;
}

async function loadModelInternal(): Promise<Handle> {
  if (handle?.session) return handle;
  if (!modelPath) throw new Error('Todavía no hay un modelo descargado o seleccionado.');

  try {
    const st = await stat(modelPath);
    if (!st.isFile() || st.size === 0)
      throw new Error('El archivo del modelo está vacío o no existe.');
  } catch {
    throw new Error(
      `No se encuentra el modelo en ${modelPath}. Descargalo de nuevo o seleccioná otro archivo .gguf.`,
    );
  }

  let llama;
  try {
    llama = await getLlama({ gpu: 'vulkan', logLevel: LlamaLogLevel.warn });
    gpuBackend = 'vulkan';
  } catch {
    llama = await getLlama({ logLevel: LlamaLogLevel.warn });
    gpuBackend = 'cpu';
  }

  const model = await llama.loadModel({ modelPath });
  const ctx = await model.createContext({ contextSize: CONTEXT_SIZE });
  const sequence = ctx.getSequence();
  const session = new LlamaChatSession({
    contextSequence: sequence,
    chatWrapper: 'auto',
    autoDisposeSequence: true,
  });
  handle = { session };
  return handle;
}

function toHistoryItems(
  messages: CopilotMessage[],
): Array<
  | { type: 'system'; text: string }
  | { type: 'user'; text: string }
  | { type: 'model'; response: string[] }
> {
  return messages.slice(0, -1).map((m) => {
    if (m.role === 'system') return { type: 'system', text: m.content };
    if (m.role === 'user') return { type: 'user', text: m.content };
    return { type: 'model', response: [m.content] };
  });
}

export function registerCopilot(): void {
  void readPersistedModelPath().then((path) => {
    modelPath = path;
  });

  ipcMain.handle(COPILOT_IPC.Status, async (): Promise<CopilotStatus> => {
    if (modelPath === null) {
      modelPath = await readPersistedModelPath();
    }
    return toStatus();
  });

  ipcMain.handle(COPILOT_IPC.Prepare, async (): Promise<CopilotStatus> => {
    try {
      await ensureModel();
      return toStatus();
    } catch (err) {
      return {
        state: 'error',
        message: err instanceof Error ? err.message : String(err),
        modelPath,
      };
    }
  });

  ipcMain.handle(
    COPILOT_IPC.SetModelPath,
    async (_: IpcMainInvokeEvent, path: string | null): Promise<CopilotStatus> => {
      await disposeHandle();
      modelPath = path;
      await writeFile(stateFile(), JSON.stringify({ modelPath }), 'utf8');
      return toStatus();
    },
  );

  ipcMain.handle(COPILOT_IPC.SelectModel, async (): Promise<CopilotStatus> => {
    const res = await dialog.showOpenDialog({
      title: 'Seleccionar modelo GGUF (llama.cpp)',
      properties: ['openFile'],
      filters: [{ name: 'Modelo GGUF', extensions: ['gguf'] }],
    });
    if (res.canceled || res.filePaths.length === 0) return toStatus();
    await disposeHandle();
    modelPath = res.filePaths[0] ?? null;
    await writeFile(stateFile(), JSON.stringify({ modelPath }), 'utf8');
    return toStatus();
  });

  ipcMain.handle(
    COPILOT_IPC.DownloadModel,
    async (
      event: IpcMainInvokeEvent,
      repoPath: string,
      fileName: string,
    ): Promise<CopilotStatus> => {
      if (downloadJob) return toDownloadingStatus();

      const safeName = sanitizeFileName(fileName);
      const target = join(modelsDir(), safeName);
      await disposeHandle();
      modelPath = target;
      await writeFile(stateFile(), JSON.stringify({ modelPath }), 'utf8');

      const controller = new AbortController();
      const progress: CopilotDownloadProgress = { received: 0, total: null, percent: null };
      const jobPromise = (async () => {
        try {
          await mkdir(dirname(target), { recursive: true });
          const existing = await stat(target).catch(() => null);
          if (existing?.isFile() && existing.size > 0) {
            progress.received = existing.size;
            progress.total = existing.size;
            progress.percent = 1;
            event.sender.send(COPILOT_EVENTS.DownloadProgress, progress);
            return;
          }

          const url = `https://huggingface.co/${repoPath}/resolve/main/${encodeURIComponent(fileName)}`;
          const res = await fetch(url, { redirect: 'follow', signal: controller.signal });
          if (!res.ok || !res.body) {
            throw new Error(
              `La descarga falló (HTTP ${res.status}). Verificá que el repo y el archivo existan en HuggingFace.`,
            );
          }
          const total = Number(res.headers.get('content-length')) || null;
          progress.total = total;

          const part = `${target}.part`;
          await rm(part, { force: true }).catch(() => undefined);
          const partHandle = await open(part, 'w');
          let received = 0;
          try {
            const reader = res.body as unknown as AsyncIterable<Uint8Array>;
            for await (const chunk of reader) {
              if (controller.signal.aborted) break;
              await partHandle.write(chunk);
              received += chunk.byteLength;
              progress.received = received;
              progress.percent = total ? received / total : null;
              event.sender.send(COPILOT_EVENTS.DownloadProgress, progress);
            }
          } finally {
            await partHandle.close();
          }
          if (controller.signal.aborted) {
            await rm(part, { force: true }).catch(() => undefined);
            throw new Error('Descarga cancelada.');
          }
          await rename(part, target);
          progress.percent = 1;
          event.sender.send(COPILOT_EVENTS.DownloadProgress, progress);
        } finally {
          downloadJob = null;
        }
      })();

      downloadJob = { controller, repo: repoPath, file: safeName, progress, promise: jobPromise };

      try {
        await jobPromise;
      } catch (err) {
        modelPath = null;
        await writeFile(stateFile(), JSON.stringify({ modelPath: null }), 'utf8');
        return {
          state: 'error',
          message: err instanceof Error ? err.message : String(err),
          modelPath: null,
        };
      }
      return toStatus();
    },
  );

  ipcMain.handle(COPILOT_IPC.RevealModelsFolder, async (): Promise<void> => {
    const dir = modelsDir();
    await mkdir(dir, { recursive: true });
    void shell.openPath(dir);
  });

  ipcMain.handle(
    COPILOT_IPC.Generate,
    async (
      event: IpcMainInvokeEvent,
      request: CopilotGenerateRequest,
    ): Promise<{ text: string }> => {
      const run = async (): Promise<{ text: string }> => {
        if (!request.messages || request.messages.length === 0) {
          throw new Error('No hay mensajes para generar.');
        }
        const h = await ensureModel();
        const maxTokens = Math.max(64, Math.min(request.maxTokens ?? 512, 2048));
        const temperature = typeof request.temperature === 'number' ? request.temperature : 0.4;
        const controller = new AbortController();
        aborters.set(request.requestId, controller);

        const history = toHistoryItems(request.messages);
        const lastContent = request.messages.at(-1)?.content ?? '';
        if (lastContent.trim().length === 0) throw new Error('No hay mensaje para generar.');

        h.session.setChatHistory(history);
        const response = await h.session.prompt(lastContent, {
          temperature,
          maxTokens,
          signal: controller.signal,
          stopOnAbortSignal: false,
          onTextChunk: (text: string) => {
            if (!event.sender.isDestroyed()) {
              event.sender.send(COPILOT_EVENTS.Token, { requestId: request.requestId, text });
            }
          },
        });
        return { text: response };
      };

      const chained = pendingChain.then(run, run) as Promise<{ text: string }>;
      pendingChain = chained.then(
        () => undefined,
        () => undefined,
      );
      try {
        return await chained;
      } finally {
        aborters.delete(request.requestId);
      }
    },
  );

  ipcMain.handle(COPILOT_IPC.Cancel, (_: IpcMainInvokeEvent, requestId: string) => {
    aborters.get(requestId)?.abort();
  });

  ipcMain.handle(
    COPILOT_IPC.SaveFileContent,
    async (_: IpcMainInvokeEvent, defaultName: string, content: string): Promise<string | null> => {
      const res = await dialog.showSaveDialog({
        title: 'Guardar exportación',
        defaultPath: join(app.getPath('documents'), defaultName),
      });
      if (res.canceled || !res.filePath) return null;
      await writeFile(res.filePath, content, 'utf8');
      return res.filePath;
    },
  );
}

// API mínima que el preload expone al renderer (contextBridge). El renderer NUNCA
// ve Node ni Electron directamente: solo estas funciones acotadas.
import type {
  CopilotGenerateRequest,
  CopilotDownloadProgress,
  CopilotStatus,
  CopilotTokenEvent,
} from './copilot';

export type SecureApi = {
  /** Guarda un string en el keychain del SO (safeStorage), nunca en texto plano. */
  secureSave(data: string): Promise<void>;
  /** Lee el string guardado, o null si no existe / no se puede descifrar. */
  secureRead(): Promise<string | null>;
  /** Borra el secreto guardado. */
  secureClear(): Promise<void>;
  /**
   * Abre una ventana de login (OAuth) y resuelve con la URL de callback final
   * (contiene el `code` PKCE) o null si el usuario cerró la ventana.
   */
  openOAuth(url: string): Promise<string | null>;
};

/**
 * Puente del "Copilot del Director" (Fase E — Nivel 1): el modelo corre en el
 * proceso principal (llama.cpp local), el renderer solo manda el prompt ya
 * armado y recibe tokens en streaming.
 */
export type CopilotApi = {
  getStatus(): Promise<CopilotStatus>;
  /** Carga el modelo descargado a memoria (necesario antes de generar). */
  prepare(): Promise<CopilotStatus>;
  setModelPath(path: string | null): Promise<CopilotStatus>;
  selectModel(): Promise<CopilotStatus>;
  downloadModel(repo: string, file: string): Promise<CopilotStatus>;
  revealModelsFolder(): Promise<void>;
  generate(request: CopilotGenerateRequest): Promise<{ text: string }>;
  cancel(requestId: string): Promise<void>;
  saveFileContent(defaultName: string, content: string): Promise<string | null>;
  onToken(cb: (event: CopilotTokenEvent) => void): () => void;
  onDownloadProgress(cb: (progress: CopilotDownloadProgress) => void): () => void;
};

declare global {
  interface Window {
    api: SecureApi;
    consoleCopilot: CopilotApi;
  }
}

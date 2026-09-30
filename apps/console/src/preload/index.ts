import { contextBridge, ipcRenderer } from 'electron';
import type { IpcRendererEvent } from 'electron';
import type { SecureApi, CopilotApi } from '@console/shared/api';
import { IPC } from '@console/shared/ipc';
import { COPILOT_EVENTS, COPILOT_IPC } from '@console/shared/copilot';
import type {
  CopilotDownloadProgress,
  CopilotStatus,
  CopilotTokenEvent,
} from '@console/shared/copilot';

function on<Payload>(channel: string, cb: (payload: Payload) => void): () => void {
  const listener = (_: IpcRendererEvent, payload: Payload): void => cb(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

const api: SecureApi = {
  secureSave: (data: string) => ipcRenderer.invoke(IPC.SecureSave, data),
  secureRead: () => ipcRenderer.invoke(IPC.SecureRead),
  secureClear: () => ipcRenderer.invoke(IPC.SecureClear),
  openOAuth: (url: string) => ipcRenderer.invoke(IPC.OAuthOpen, url),
};

const consoleCopilot: CopilotApi = {
  getStatus: () => ipcRenderer.invoke(COPILOT_IPC.Status) as Promise<CopilotStatus>,
  prepare: () => ipcRenderer.invoke(COPILOT_IPC.Prepare) as Promise<CopilotStatus>,
  setModelPath: (path) =>
    ipcRenderer.invoke(COPILOT_IPC.SetModelPath, path) as Promise<CopilotStatus>,
  selectModel: () => ipcRenderer.invoke(COPILOT_IPC.SelectModel) as Promise<CopilotStatus>,
  downloadModel: (repo, file) =>
    ipcRenderer.invoke(COPILOT_IPC.DownloadModel, repo, file) as Promise<CopilotStatus>,
  revealModelsFolder: () => ipcRenderer.invoke(COPILOT_IPC.RevealModelsFolder) as Promise<void>,
  generate: (request) =>
    ipcRenderer.invoke(COPILOT_IPC.Generate, request) as Promise<{ text: string }>,
  cancel: (requestId) => ipcRenderer.invoke(COPILOT_IPC.Cancel, requestId) as Promise<void>,
  saveFileContent: (defaultName, content) =>
    ipcRenderer.invoke(COPILOT_IPC.SaveFileContent, defaultName, content) as Promise<string | null>,
  onToken: (cb) => on<CopilotTokenEvent>(COPILOT_EVENTS.Token, cb),
  onDownloadProgress: (cb) => on<CopilotDownloadProgress>(COPILOT_EVENTS.DownloadProgress, cb),
};

contextBridge.exposeInMainWorld('api', api);
contextBridge.exposeInMainWorld('consoleCopilot', consoleCopilot);

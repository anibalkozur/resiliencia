import { contextBridge, ipcRenderer } from 'electron';
import type { SecureApi } from '@console/shared/api';
import { IPC } from '@console/shared/ipc';

const api: SecureApi = {
  secureSave: (data: string) => ipcRenderer.invoke(IPC.SecureSave, data),
  secureRead: () => ipcRenderer.invoke(IPC.SecureRead),
  secureClear: () => ipcRenderer.invoke(IPC.SecureClear),
  openOAuth: (url: string) => ipcRenderer.invoke(IPC.OAuthOpen, url),
};

contextBridge.exposeInMainWorld('api', api);

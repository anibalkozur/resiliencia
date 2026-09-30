import { ipcMain } from 'electron';
import { IPC } from '@console/shared/ipc';
import { openOAuthWindow } from './oauth';

export function registerOAuth(): void {
  ipcMain.handle(IPC.OAuthOpen, (_event, url: unknown) => {
    // Solo admitimos URLs https: un admin no debe poder abrir cosas raras.
    if (typeof url !== 'string' || !/^https:\/\/[^\s]+$/.test(url)) return null;
    return openOAuthWindow(url);
  });
}

import { BrowserWindow } from 'electron';
import { OAUTH_REDIRECT } from '@console/shared/constants';

// Prefijo exacto del callback OAuth (origin + path, sin query). Es lo único que
// interceptamos; todo lo demás navega normal dentro de la ventana de login.
export const OAUTH_REDIRECT_PREFIX = (() => {
  const u = new URL(OAUTH_REDIRECT);
  return `${u.origin}${u.pathname}`;
})();

/**
 * Abre una ventana de login para el flujo OAuth de Google (PKCE). Intercepta la
 * redirección final del proveedor hacia nuestro callback antes de que navegue, le
 * pasa la URL (con `code`) al renderer, y la ventana se cierra. Resuelve null si
 * el usuario la cierra o falla la carga.
 */
export function openOAuthWindow(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const child = new BrowserWindow({
      width: 520,
      height: 680,
      autoHideMenuBar: true,
      title: 'Inicia sesión — ResiliencIA',
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        // Partición aislada: las cookies de Google no tocan la sesión de la app.
        partition: 'oauth-google',
      },
    });
    child.setMenuBarVisibility(false);

    let settled = false;
    const finish = (result: string | null): void => {
      if (settled) return;
      settled = true;
      if (!child.isDestroyed()) child.destroy();
      resolve(result);
    };

    child.webContents.setWindowOpenHandler(({ url: popupUrl }) => {
      // Google a veces intenta abrir popups; cortamos el flujo en la ventana actual.
      void popupUrl;
      finish(null);
      return { action: 'deny' };
    });

    const catchesCallback = (event: Electron.Event, targetUrl: string): void => {
      if (targetUrl.startsWith(OAUTH_REDIRECT_PREFIX)) {
        event.preventDefault();
        finish(targetUrl);
      }
    };
    child.webContents.on('will-redirect', catchesCallback);
    child.webContents.on('will-navigate', catchesCallback);

    child.webContents.on('did-fail-load', (_event, code, description) => {
      void code;
      void description;
      finish(null);
    });

    child.on('closed', () => finish(null));

    void child.loadURL(url);
  });
}

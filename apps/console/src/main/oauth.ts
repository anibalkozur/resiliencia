import { BrowserWindow } from 'electron';
import { OAUTH_REDIRECT } from '@console/shared/constants';

// Prefijo exacto del callback OAuth (origin + path, sin query). Es lo único que
// interceptamos; todo lo demás navega normal dentro de la ventana de login.
export const OAUTH_REDIRECT_PREFIX = (() => {
  const u = new URL(OAUTH_REDIRECT);
  return `${u.origin}${u.pathname}`;
})();

// Un hop "real" del callback tiene material utilizable: `code` (PKCE/query),
// `error` (query) o `access_token`/`code` en el fragmento (flujo implícito). Si
// el proveedor emite un hop intermedio VACÍO hacia nuestro origen, no lo tomamos
// como definitivo (esperamos al siguiente).
function hasAuthMaterial(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl);
    const query = u.searchParams;
    if (query.get('code') || query.get('error')) return true;
    const hash = u.hash;
    return hash.length > 1 && (hash.includes('access_token=') || hash.includes('code='));
  } catch {
    return false;
  }
}

/**
 * Abre una ventana de login para el flujo OAuth de Google (PKCE). Intercepta la
 * redirección final del proveedor hacia nuestro callback antes de que navegue y
 * le pasa la URL (con `code`/tokens) al renderer. Si no aparece material de auth
 * en ~3s (o el usuario cierra), resuelve lo último que vimos (o null).
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
    let bestUrl: string | null = null;
    let fallbackTimer: NodeJS.Timeout | null = null;

    const finish = (result: string | null): void => {
      if (settled) return;
      settled = true;
      if (fallbackTimer) {
        clearTimeout(fallbackTimer);
        fallbackTimer = null;
      }
      if (!child.isDestroyed()) child.destroy();
      resolve(result);
    };

    const scheduleFallback = (): void => {
      if (fallbackTimer) return;
      fallbackTimer = setTimeout(() => finish(bestUrl), 3000);
    };

    const catchesCallback = (event: Electron.Event, targetUrl: string): void => {
      if (!targetUrl.startsWith(OAUTH_REDIRECT_PREFIX)) return;
      event.preventDefault(); // nunca dejamos que la ventana de login navegue a la app
      bestUrl = targetUrl;
      if (hasAuthMaterial(targetUrl)) finish(targetUrl);
      else scheduleFallback();
    };

    child.webContents.setWindowOpenHandler(() => {
      // Google a veces intenta popups; los negamos y esperamos el flujo en curso.
      scheduleFallback();
      return { action: 'deny' };
    });

    child.webContents.on('will-redirect', catchesCallback);
    child.webContents.on('will-navigate', catchesCallback);

    child.on('closed', () => finish(bestUrl));

    void child.loadURL(url);
  });
}

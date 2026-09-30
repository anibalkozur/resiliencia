import { app, safeStorage, ipcMain } from 'electron';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { IPC } from '@console/shared/ipc';

// La sesión del admin se guarda CIFRADA con safeStorage (usa el keychain del SO
// en Windows/macOS). Nunca en archivo plano. Si la cifra no está disponible,
// no persistimos (fail-closed: mejor pedir login cada vez que persistir texto
// plano).
function sessionFile(): string {
  return join(app.getPath('userData'), 'console-session.bin');
}

export function registerSecureStore(): void {
  ipcMain.handle(IPC.SecureSave, (_event, data: unknown) => {
    if (typeof data !== 'string' || data.length === 0) return;
    if (!safeStorage.isEncryptionAvailable()) return;
    writeFileSync(sessionFile(), safeStorage.encryptString(data));
  });

  ipcMain.handle(IPC.SecureRead, () => {
    try {
      if (!safeStorage.isEncryptionAvailable()) return null;
      if (!existsSync(sessionFile())) return null;
      return safeStorage.decryptString(readFileSync(sessionFile()));
    } catch {
      // Archivo corrupto o clave perdida: se trata como "no hay sesión".
      return null;
    }
  });

  ipcMain.handle(IPC.SecureClear, () => {
    try {
      if (existsSync(sessionFile())) rmSync(sessionFile());
    } catch {
      // best-effort
    }
  });
}

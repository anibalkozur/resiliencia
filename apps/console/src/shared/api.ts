// API mínima que el preload expone al renderer (contextBridge). El renderer NUNCA
// ve Node ni Electron directamente: solo estas funciones acotadas.

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

declare global {
  interface Window {
    api: SecureApi;
  }
}

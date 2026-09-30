// Canales IPC entre preload y proceso principal. Centralizados para no duplicar
// strings y que no haya typos entre procesos.

export const IPC = {
  SecureSave: 'secure:save',
  SecureRead: 'secure:read',
  SecureClear: 'secure:clear',
  OAuthOpen: 'oauth:open',
} as const;

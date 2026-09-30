import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authMock } = vi.hoisted(() => ({
  authMock: {
    setSession: vi.fn(),
    onAuthStateChange: vi.fn(),
    signOut: vi.fn(),
  },
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ auth: authMock }),
}));

import { restoreSession, subscribeSessionPersistence } from '../session';

function stubWindowApi() {
  const secureRead = vi.fn();
  const secureSave = vi.fn(async () => undefined);
  const secureClear = vi.fn(async () => undefined);
  (globalThis as Record<string, unknown>).window = {
    api: { secureRead, secureSave, secureClear },
  };
  return { secureRead, secureSave, secureClear };
}

describe('restoreSession (keychain → Supabase)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    authMock.setSession.mockReset();
    authMock.setSession.mockResolvedValue({ data: { session: null }, error: null });
  });

  it('restaura la sesión y vuelve a persistir el refresh token rotado por GoTrue', async () => {
    const { secureRead, secureSave, secureClear } = stubWindowApi();
    secureRead.mockResolvedValue(
      JSON.stringify({
        access_token: 'AT-viejo',
        refresh_token: 'RT-viejo',
        user_id: 'u1',
        expires_at: null,
      }),
    );
    authMock.setSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'AT-nuevo',
          refresh_token: 'RT-nuevo', // GoTrue rotó el token en el refresh
          user: { id: 'u1' },
          expires_at: 9999,
        },
      },
      error: null,
    });

    const session = await restoreSession();

    expect(session?.refresh_token).toBe('RT-nuevo');
    expect(secureSave).toHaveBeenCalledWith(expect.stringContaining('RT-nuevo'));
    expect(secureClear).not.toHaveBeenCalled();
  });

  it('limpa el keychain si la sesión guardada es inválida (error de Supabase)', async () => {
    const { secureRead, secureClear } = stubWindowApi();
    secureRead.mockResolvedValue(
      JSON.stringify({ access_token: 'AT', refresh_token: 'RT', user_id: 'u1', expires_at: null }),
    );
    authMock.setSession.mockResolvedValue({
      data: { user: null, session: null },
      error: new Error('refresh_token_not_found'),
    });

    const session = await restoreSession();

    expect(session).toBeNull();
    expect(secureClear).toHaveBeenCalled();
  });

  it('no restaura si el keychain no tiene tokens', async () => {
    const { secureRead, secureClear } = stubWindowApi();
    secureRead.mockResolvedValue(null);

    const session = await restoreSession();

    expect(session).toBeNull();
    expect(authMock.setSession).not.toHaveBeenCalled();
    expect(secureClear).not.toHaveBeenCalled();
  });
});

describe('subscribeSessionPersistence (auto-refresh → keychain)', () => {
  it('persiste la sesión en cada evento de auth con sesión (rota refresh tokens)', () => {
    const { secureSave } = stubWindowApi();
    let registered: ((event: string, session: unknown) => void) | null = null;
    authMock.onAuthStateChange.mockImplementation(
      (cb: (event: string, session: unknown) => void) => {
        registered = cb;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      },
    );

    const unsubscribe = subscribeSessionPersistence();
    expect(registered).not.toBeNull();

    registered!('TOKEN_REFRESHED', {
      access_token: 'AT',
      refresh_token: 'RT-fresco',
      user: { id: 'u1' },
      expires_at: 9999,
    });
    registered!('SIGNED_OUT', null);

    expect(secureSave).toHaveBeenCalledTimes(1);
    expect(secureSave).toHaveBeenCalledWith(expect.stringContaining('RT-fresco'));
    unsubscribe();
  });

  it('no persistir sesiones nulas (el logout limpia por su cuenta)', () => {
    const { secureSave } = stubWindowApi();
    let registered: ((event: string, session: unknown) => void) | null = null;
    authMock.onAuthStateChange.mockImplementation(
      (cb: (event: string, session: unknown) => void) => {
        registered = cb;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      },
    );

    subscribeSessionPersistence();
    registered!('SIGNED_OUT', null);

    expect(secureSave).not.toHaveBeenCalled();
  });
});

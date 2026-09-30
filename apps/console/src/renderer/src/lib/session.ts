// Sesión del admin y cliente Supabase. El renderer es el ÚNICO proceso que sabe
// usar Supabase; con `persistSession: false` el cliente no escribe tokens en
// localStorage: la persistencia va por el keychain del SO (secure:*), que es el
// único "territorio" del proceso principal.

import { createClient, type Session } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY_READ, SUPABASE_URL } from '../env';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY_READ, {
  auth: {
    persistSession: false,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    // PKCE explícito: el default del auth-js instalado es 'implicit' (los tokens
    // vendrían en el fragmento de la URL y en el exchange no hay `code`).
    flowType: 'pkce',
  },
});

type StoredSession = {
  access_token: string;
  refresh_token: string;
  user_id: string;
  expires_at: number | null;
};

/** Restaura la sesión desde el keychain; si expiró o es inválida, la borra. */
export async function restoreSession(): Promise<Session | null> {
  const raw = await window.api.secureRead();
  if (!raw) return null;
  let stored: StoredSession;
  try {
    stored = JSON.parse(raw) as StoredSession;
  } catch {
    await window.api.secureClear();
    return null;
  }
  if (!stored.access_token || !stored.refresh_token) {
    await window.api.secureClear();
    return null;
  }
  const { data, error } = await supabase.auth.setSession({
    access_token: stored.access_token,
    refresh_token: stored.refresh_token,
  });
  if (error || !data.session) {
    await window.api.secureClear();
    return null;
  }
  // setSession refresca el token si el access token expiró, y GoTrue ROTA el
  // refresh token (el presentado queda revocado). Guardamos la sesión devuelta
  // para que el keychain nunca quede con un refresh token stale.
  await persistSession(data.session);
  return data.session;
}

/**
 * Persiste la sesión en el keychain en cada evento de auth (refrescos de token,
 * cambios de sesión). GoTrue rota el refresh token en cada renovación y, con
 * `persistSession: false`, el cliente no lo persiste solo: sin esto el keychain
 * quedaría con un refresh token revocado y el próximo arranque pediría Google.
 */
export function subscribeSessionPersistence(): () => void {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    if (session) void persistSession(session);
  });
  return () => data.subscription.unsubscribe();
}

/** Guarda (o borra, si session es null) la sesión en el keychain del SO. */
export async function persistSession(session: Session | null): Promise<void> {
  if (!session) {
    await window.api.secureClear();
    return;
  }
  const payload: StoredSession = {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    user_id: session.user.id,
    expires_at: session.expires_at ?? null,
  };
  await window.api.secureSave(JSON.stringify(payload));
}

/**
 * Intercambia el `code` PKCE que trae la URL de callback por la sesión final.
 * Robustez: acepta también el flujo implícito (tokens en el fragmento) por si un
 * proveedor no sigue PKCE, y reporta errores descriptivos del proveedor.
 */
export async function exchangeOAuthCode(callbackUrl: string): Promise<Session> {
  const url = new URL(callbackUrl);

  const code = url.searchParams.get('code');
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw new Error(`No se pudo completar el inicio de sesión: ${error.message}`);
    return data.session;
  }

  const providerError = url.searchParams.get('error');
  if (providerError) {
    const description = url.searchParams.get('error_description') ?? 'Error del proveedor';
    throw new Error(`El proveedor devolvió un error: ${providerError} — ${description}`);
  }

  const parseHash = new URLSearchParams(url.hash.replace(/^#/, ''));
  const accessToken = parseHash.get('access_token');
  const refreshToken = parseHash.get('refresh_token');
  if (accessToken) {
    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken ?? '',
    });
    if (error || !data.session) {
      throw new Error(
        `No se pudo completar el inicio de sesión: ${error?.message ?? 'sesión inválida'}`,
      );
    }
    return data.session;
  }

  throw new Error(
    'El proveedor no devolvió el código de autorización (ni code, ni error, ni token). Intentalo de nuevo.',
  );
}

export async function signOutSession(): Promise<void> {
  await supabase.auth.signOut();
  await window.api.secureClear();
}

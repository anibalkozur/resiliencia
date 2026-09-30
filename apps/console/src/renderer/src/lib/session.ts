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
  return data.session;
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

/** Intercambia el `code` PKCE que trae la URL de callback por la sesión final. */
export async function exchangeOAuthCode(callbackUrl: string): Promise<Session> {
  const url = new URL(callbackUrl);
  const code = url.searchParams.get('code');
  if (!code) throw new Error('El proveedor no devolvió el código de autorización.');
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) throw new Error(`No se pudo completar el inicio de sesión: ${error.message}`);
  return data.session;
}

export async function signOutSession(): Promise<void> {
  await supabase.auth.signOut();
  await window.api.secureClear();
}

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabase } from './supabase';
import { getRepo } from '../repo';

export const PASSWORD_MIN = 6;

export type AuthErrorCode =
  | 'invalid_email'
  | 'password_short'
  | 'auth_not_configured'
  | 'email_in_use'
  | 'invalid_credentials'
  | 'network'
  | 'provider_not_configured'
  | 'canceled'
  | 'unknown';

export type AuthResult =
  | { ok: true; needsEmailConfirmation: boolean; nickname?: string; userId?: string }
  | { ok: false; errorCode: AuthErrorCode };

export interface ServerProfile {
  id: string;
  nickname: string;
}

const GENERIC_NICKNAMES = new Set(['atleta', 'atletas']);

export function isGenericNickname(nickname: string | undefined | null): boolean {
  if (!nickname) {
    return true;
  }
  const trimmed = nickname.trim();
  return trimmed.length === 0 || GENERIC_NICKNAMES.has(trimmed.toLowerCase());
}

export function resolveNickname(
  serverNickname: string | undefined | null,
  metaNickname: string | undefined | null,
  localNickname: string | undefined | null,
): string {
  if (!isGenericNickname(serverNickname)) {
    return (serverNickname as string).trim();
  }
  if (!isGenericNickname(localNickname)) {
    return (localNickname as string).trim();
  }
  if (!isGenericNickname(metaNickname)) {
    return (metaNickname as string).trim();
  }
  return 'Atleta';
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

export function validatePassword(password: string): boolean {
  return password.length >= PASSWORD_MIN;
}

export function mapAuthError(err: unknown): AuthErrorCode {
  const message = err instanceof Error ? err.message : String(err ?? '');
  const lower = message.toLowerCase();
  if (
    lower.includes('already registered') ||
    lower.includes('user_already_exists') ||
    lower.includes('already been registered')
  ) {
    return 'email_in_use';
  }
  if (lower.includes('invalid login credentials') || lower.includes('email not confirmed')) {
    return 'invalid_credentials';
  }
  if (lower.includes('failed to fetch') || lower.includes('network request failed')) {
    return 'network';
  }
  if (lower.includes('provider is not enabled')) {
    return 'provider_not_configured';
  }
  return 'unknown';
}

export async function signUp(
  email: string,
  password: string,
  nickname: string,
  client: SupabaseClient | null = getSupabase(),
): Promise<AuthResult> {
  if (!client) {
    return { ok: false, errorCode: 'auth_not_configured' };
  }
  if (!validateEmail(email)) {
    return { ok: false, errorCode: 'invalid_email' };
  }
  if (!validatePassword(password)) {
    return { ok: false, errorCode: 'password_short' };
  }
  try {
    const { data, error } = await client.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { nickname } },
    });
    if (error) {
      return { ok: false, errorCode: mapAuthError(error) };
    }
    return {
      ok: true,
      needsEmailConfirmation: data.session === null,
      nickname,
      userId: data.user?.id,
    };
  } catch (err) {
    return { ok: false, errorCode: mapAuthError(err) };
  }
}

export async function signIn(
  email: string,
  password: string,
  client: SupabaseClient | null = getSupabase(),
): Promise<AuthResult> {
  if (!client) {
    return { ok: false, errorCode: 'auth_not_configured' };
  }
  if (!validateEmail(email)) {
    return { ok: false, errorCode: 'invalid_email' };
  }
  if (!validatePassword(password)) {
    return { ok: false, errorCode: 'password_short' };
  }
  try {
    const { data, error } = await client.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      return { ok: false, errorCode: mapAuthError(error) };
    }
    return {
      ok: true,
      needsEmailConfirmation: false,
      nickname: data.user?.user_metadata?.nickname,
      userId: data.user?.id,
    };
  } catch (err) {
    return { ok: false, errorCode: mapAuthError(err) };
  }
}

export async function signOut(client: SupabaseClient | null = getSupabase()): Promise<void> {
  if (client) {
    try {
      const { error } = await client.auth.signOut({ scope: 'local' });
      if (error) {
        console.warn('[auth] remote signOut:', error.message);
      }
    } catch (err) {
      console.warn('[auth] local signOut fallback:', err);
    }
  }
  await clearLocalSession();
}

// Barrido de seguridad posterior: elimina cualquier clave sb-* residual
// (sesión y verifiers PKCE) sin intervenir en los estados de la librería.
async function clearLocalSession(): Promise<void> {
  try {
    const repo = getRepo();
    const authKeys = (await repo.listKeys()).filter((key) => key.startsWith('sb-'));
    await Promise.all(authKeys.map((key) => repo.removeSetting(key)));
  } catch {
    // La limpieza local es best-effort; el cierre de sesión no debe romperse.
  }
}

export async function fetchServerProfile(
  userId: string,
  client: SupabaseClient | null = getSupabase(),
): Promise<ServerProfile | null> {
  if (!client) {
    return null;
  }
  try {
    const { data, error } = await client
      .from('profiles')
      .select('user_id, nickname')
      .eq('user_id', userId)
      .maybeSingle();
    if (error || !data) {
      return null;
    }
    const row = data as { user_id: string; nickname: string };
    return { id: row.user_id, nickname: row.nickname };
  } catch {
    return null;
  }
}

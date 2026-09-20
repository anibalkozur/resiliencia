import { Linking, AppState } from 'react-native';
import * as AuthSession from 'expo-auth-session';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabase, setPkceFlowActive } from './supabase';
import { mapAuthError, type AuthResult } from './authService';

export function extractAuthCode(url: string): string | null {
  const match = url.match(/[?&#]code=([^&#]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

interface ImplicitSession {
  accessToken: string;
  refreshToken: string;
}

export function extractImplicitSession(url: string): ImplicitSession | null {
  const hashIndex = url.indexOf('#');
  if (hashIndex === -1) {
    return null;
  }
  const params = new URLSearchParams(url.slice(hashIndex + 1));
  const accessToken = params.get('access_token');
  if (!accessToken) {
    return null;
  }
  return { accessToken, refreshToken: params.get('refresh_token') ?? '' };
}

function oauthNickname(metadata: Record<string, unknown> | undefined): string {
  const nickname = metadata?.nickname;
  const fullName = metadata?.full_name;
  const name = metadata?.name;
  const candidate =
    typeof nickname === 'string'
      ? nickname
      : typeof fullName === 'string'
        ? fullName
        : typeof name === 'string'
          ? name
          : undefined;
  return candidate && candidate.trim().length > 0 ? candidate.trim() : 'Atleta';
}

function sessionUser(
  user: { id: string; user_metadata: Record<string, unknown> | undefined } | undefined,
): { userId: string | undefined; nickname: string } {
  return { userId: user?.id, nickname: oauthNickname(user?.user_metadata) };
}

export async function signInWithGoogle(
  client: SupabaseClient | null = getSupabase(),
): Promise<AuthResult> {
  if (!client) {
    return { ok: false, errorCode: 'auth_not_configured' };
  }

  const redirectTo = AuthSession.makeRedirectUri();

  try {
    const { data, error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error) {
      return { ok: false, errorCode: mapAuthError(error) };
    }
    if (!data?.url) {
      return { ok: false, errorCode: 'provider_not_configured' };
    }

    setPkceFlowActive(true);
    let cancelUrlListener: ReturnType<typeof Linking.addEventListener> | null = null;
    let appStateListener: ReturnType<typeof AppState.addEventListener> | null = null;

    try {
      const result = await new Promise<{ type: string; url?: string }>((resolve) => {
        const onUrl = (event: { url: string }) => {
          if (event.url.startsWith(redirectTo)) {
            cleanup();
            resolve({ type: 'success', url: event.url });
          }
        };

        let appStateActive = false;
        const onAppStateChange = (nextAppState: string) => {
          if (nextAppState === 'active' && appStateActive) {
            cleanup();
            resolve({ type: 'dismiss' });
          }
          appStateActive = true;
        };

        const cleanup = () => {
          if (cancelUrlListener) {
            cancelUrlListener.remove();
            cancelUrlListener = null;
          }
          if (appStateListener) {
            appStateListener.remove();
            appStateListener = null;
          }
        };

        cancelUrlListener = Linking.addEventListener('url', onUrl);
        appStateListener = AppState.addEventListener('change', onAppStateChange);
        Linking.openURL(data.url!);
      });

      if (result.type !== 'success' || !result.url) {
        return { ok: false, errorCode: 'canceled' };
      }

      const code = extractAuthCode(result.url);
      if (code) {
        const { data: sessionData, error: sessionError } = await client.auth.exchangeCodeForSession(
          code,
          data.flowId ? { flowId: data.flowId } : undefined,
        );
        if (sessionError) {
          return { ok: false, errorCode: mapAuthError(sessionError) };
        }
        const { userId, nickname } = sessionUser(sessionData.user);
        return { ok: true, needsEmailConfirmation: false, nickname, userId };
      }

      const implicit = extractImplicitSession(result.url);
      if (implicit) {
        const { data: sessionData, error: sessionError } = await client.auth.setSession({
          access_token: implicit.accessToken,
          refresh_token: implicit.refreshToken,
        });
        if (sessionError) {
          return { ok: false, errorCode: mapAuthError(sessionError) };
        }
        if (!sessionData.session) {
          return { ok: false, errorCode: 'unknown' };
        }
        return {
          ok: true,
          needsEmailConfirmation: false,
          nickname: oauthNickname(sessionData.session.user.user_metadata),
          userId: sessionData.session.user.id,
        };
      }

      const { data: sessionData, error: sessionError } = await client.auth.getSession();
      if (sessionError) {
        return { ok: false, errorCode: mapAuthError(sessionError) };
      }
      if (!sessionData.session) {
        return { ok: false, errorCode: 'unknown' };
      }
      return {
        ok: true,
        needsEmailConfirmation: false,
        nickname: oauthNickname(sessionData.session.user.user_metadata),
        userId: sessionData.session.user.id,
      };
    } finally {
      setPkceFlowActive(false);
    }
  } catch (err) {
    return { ok: false, errorCode: mapAuthError(err) };
  }
}

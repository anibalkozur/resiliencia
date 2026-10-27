import { AppState, Linking } from 'react-native';
import * as AuthSession from 'expo-auth-session';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabase, setPkceFlowActive } from './supabase';
import { mapAuthError, type AuthResult } from './authService';

const OAUTH_CALLBACK_GRACE_MS = 3000;

function isExpectedOAuthRedirect(url: string, redirectTo: string): boolean {
  const normalizedRedirect = redirectTo.replace(/\/+$/, '');
  const baseRedirect = normalizedRedirect.replace(/\/--$/, '');

  if (url.startsWith(normalizedRedirect)) {
    return true;
  }

  // Android/Expo Go may remove or add the `/--/` segment when reopening the
  // project. Accept the same base only when the URL carries OAuth material.
  return url.startsWith(baseRedirect) && /[?&#](code|access_token|error)=/.test(url);
}

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

  // Use the stable native callback registered in Supabase for the
  // Development Build. The onboarding route is also valid in Expo Router.
  const redirectTo = AuthSession.makeRedirectUri({
    scheme: 'resiliencia',
    path: 'onboarding',
  });

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
    try {
      const result = await new Promise<{ type: string; url?: string }>((resolve) => {
        let settled = false;
        let urlListener: ReturnType<typeof Linking.addEventListener> | null = null;
        let appStateListener: ReturnType<typeof AppState.addEventListener> | null = null;
        let dismissTimer: ReturnType<typeof setTimeout> | null = null;
        let appWentBackground = false;

        const cleanup = () => {
          urlListener?.remove();
          urlListener = null;
          appStateListener?.remove();
          appStateListener = null;
          if (dismissTimer) {
            clearTimeout(dismissTimer);
            dismissTimer = null;
          }
        };

        const finish = (next: { type: string; url?: string }) => {
          if (settled) {
            return;
          }
          settled = true;
          cleanup();
          resolve(next);
        };

        const scheduleDismiss = () => {
          if (dismissTimer) {
            clearTimeout(dismissTimer);
          }
          dismissTimer = setTimeout(() => finish({ type: 'dismiss' }), OAUTH_CALLBACK_GRACE_MS);
        };

        urlListener = Linking.addEventListener('url', ({ url }) => {
          if (isExpectedOAuthRedirect(url, redirectTo)) {
            finish({ type: 'success', url });
          }
        });

        appStateListener = AppState.addEventListener('change', (nextAppState) => {
          if (nextAppState === 'background' || nextAppState === 'inactive') {
            appWentBackground = true;
            return;
          }
          if (nextAppState === 'active' && appWentBackground) {
            // Android may reactivate the app before delivering the deep link.
            scheduleDismiss();
          }
        });

        void Linking.openURL(data.url!).catch(() => finish({ type: 'error' }));
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

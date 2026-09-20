import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getSupabase, isSupabaseConfigured } from './supabase';
import * as authService from './authService';
import { resolveNickname } from './authService';
import { signInWithGoogle } from './googleSignIn';
import type { AuthErrorCode, AuthResult } from './authService';
import { useUser } from '../user/UserProvider';
import { getRepo } from '../repo';
import { syncAfterLogin } from '../sync/syncService';

function metaNickname(metadata: Record<string, unknown> | undefined): string | undefined {
  if (typeof metadata?.nickname === 'string') {
    return metadata.nickname;
  }
  if (typeof metadata?.full_name === 'string') {
    return metadata.full_name;
  }
  return undefined;
}

type AuthState = {
  session: Session | null;
  authLoading: boolean;
  errorCode: AuthErrorCode | null;
  signUp: (email: string, password: string, nickname: string) => Promise<AuthResult>;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  googleSignIn: () => Promise<AuthResult>;
  signOut: () => Promise<void>;
  clearError: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { attachAccount } = useUser();
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(() => isSupabaseConfigured());
  const [errorCode, setErrorCode] = useState<AuthErrorCode | null>(null);
  const logoutPromise = useRef<Promise<void> | null>(null);

  function startLogout(): Promise<void> {
    const task = authService.signOut().catch(() => {
      // El teardown local del cliente ya se encarga; no bloquear la UI.
    });
    logoutPromise.current = task;
    void task.finally(() => {
      if (logoutPromise.current === task) {
        logoutPromise.current = null;
      }
    });
    return task;
  }

  async function drainLogout(): Promise<void> {
    const pending = logoutPromise.current;
    if (pending) {
      await pending;
    }
  }

  async function restoreServerProfile(userId: string, metaNickname?: string) {
    try {
      const repo = getRepo();
      const server = await authService.fetchServerProfile(userId);
      const local = await repo.getProfile();
      const nickname = resolveNickname(server?.nickname, metaNickname, local?.nickname);
      await attachAccount({ userId, nickname });
      await syncAfterLogin(repo, userId);
    } catch (err) {
      console.warn('[auth] restoreServerProfile:', err);
    }
  }

  useEffect(() => {
    const client = getSupabase();
    if (!client) {
      return;
    }

    let active = true;

    client.auth.getSession().then(
      ({ data }) => {
        if (!active) {
          return;
        }
        setSession(data.session);
        setAuthLoading(false);
        if (data.session) {
          void restoreServerProfile(
            data.session.user.id,
            metaNickname(data.session.user.user_metadata),
          );
        }
      },
      () => {
        if (!active) {
          return;
        }
        setAuthLoading(false);
      },
    );

    const { data: subscription } = client.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      if (nextSession && (event === 'SIGNED_IN' || event === 'USER_UPDATED')) {
        restoreServerProfile(nextSession.user.id, metaNickname(nextSession.user.user_metadata));
      }
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      session,
      authLoading,
      errorCode,
      signUp: async (email, password, nickname) => {
        await drainLogout();
        const result = await authService.signUp(email, password, nickname);
        if (result.ok && !result.needsEmailConfirmation && result.userId) {
          await attachAccount({
            userId: result.userId,
            nickname: resolveNickname(null, nickname, (await getRepo().getProfile())?.nickname),
          });
        }
        if (!result.ok) {
          setErrorCode(result.errorCode);
        } else {
          setErrorCode(null);
        }
        return result;
      },
      signIn: async (email, password) => {
        await drainLogout();
        const result = await authService.signIn(email, password);
        if (result.ok && result.userId) {
          await attachAccount({
            userId: result.userId,
            nickname: resolveNickname(
              null,
              result.nickname,
              (await getRepo().getProfile())?.nickname,
            ),
          });
        }
        if (!result.ok) {
          setErrorCode(result.errorCode);
        } else {
          setErrorCode(null);
        }
        return result;
      },
      googleSignIn: async () => {
        await drainLogout();
        setErrorCode(null);
        const result = await signInWithGoogle();
        if (result.ok && result.userId) {
          await attachAccount({
            userId: result.userId,
            nickname: resolveNickname(
              null,
              result.nickname,
              (await getRepo().getProfile())?.nickname,
            ),
          });
        }
        if (!result.ok) {
          setErrorCode(result.errorCode);
        }
        return result;
      },
      signOut: async () => {
        setErrorCode(null);
        setSession(null);
        void startLogout();
      },
      clearError: () => setErrorCode(null),
    }),
    [session, authLoading, errorCode, attachAccount],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}

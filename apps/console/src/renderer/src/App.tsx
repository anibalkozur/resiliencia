import { useCallback, useEffect, useState } from 'react';
import { admin_console } from './lib/adminApi';
import type { Session } from '@supabase/supabase-js';
import type { AdminRole } from './lib/types';
import {
  exchangeOAuthCode,
  persistSession,
  restoreSession,
  signOutSession,
  subscribeSessionPersistence,
  supabase,
} from './lib/session';
import { OAUTH_REDIRECT } from '@console/shared/constants';
import { SignInScreen } from './auth/SignIn';
import { ConsoleShell } from './console/ConsoleShell';

export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AdminRole | null>(null);
  const [booting, setBooting] = useState(true);

  const whoami = useCallback(async (): Promise<AdminRole | null> => {
    try {
      const data = await admin_console.whoami();
      return data.role;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const unsubscribePersistence = subscribeSessionPersistence();
    async function boot(): Promise<void> {
      const restored = await restoreSession();
      if (cancelled) return;
      if (!restored) {
        setBooting(false);
        return;
      }
      setSession(restored);
      const r = await whoami();
      if (cancelled) return;
      if (r) {
        setRole(r);
      } else {
        // Token presente pero sin rol de admin: fuera.
        await signOutSession();
        setSession(null);
      }
      setBooting(false);
    }
    void boot();
    return () => {
      cancelled = true;
      unsubscribePersistence();
    };
  }, [whoami]);

  const handleGoogleSignIn = useCallback(async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: OAUTH_REDIRECT },
    });
    if (error || !data.url) {
      throw new Error(error?.message || 'No se pudo iniciar el flujo de login.');
    }
    const callbackUrl = await window.api.openOAuth(data.url);
    if (!callbackUrl) throw new Error('Ventana de login cerrada sin completarse.');
    const next = await exchangeOAuthCode(callbackUrl);
    setSession(next);
    await persistSession(next);
    const r = await whoami();
    setRole(r);
  }, [whoami]);

  const handleSignOut = useCallback(async () => {
    await signOutSession();
    setSession(null);
    setRole(null);
  }, []);

  if (booting) {
    return (
      <div className="app boot">
        <div className="spinner" aria-label="Cargando" />
      </div>
    );
  }

  if (!session) {
    return <SignInScreen onSignIn={handleGoogleSignIn} />;
  }

  return <ConsoleShell session={session} role={role} onSignOut={handleSignOut} />;
}

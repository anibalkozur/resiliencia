import './webcryptoPolyfill';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getRepo } from '../repo';

export const SUPABASE_URL = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim();
export const SUPABASE_ANON_KEY = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '').trim();

export function isSupabaseConfigured(): boolean {
  return SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;
}

let client: SupabaseClient | null = null;

let pkceFlowActive = false;

export function setPkceFlowActive(active: boolean): void {
  pkceFlowActive = active;
}

export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    return null;
  }
  if (client === null) {
    const repo = getRepo();
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        flowType: 'pkce',
        storage: {
          getItem: async (key: string) => {
            const value = await repo.getSetting(key);
            return value;
          },
          setItem: (key: string, value: string) => {
            return repo.setSetting(key, value);
          },
          removeItem: (key: string) => {
            if (pkceFlowActive && key.endsWith('-code-verifier')) {
              return;
            }
            return repo.removeSetting(key);
          },
        },
      },
    });
  }
  return client;
}

import { getSupabase } from '../auth/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

const CACHE_TTL_MS = 60_000;

let cachedPremium: boolean | null = null;
let lastFetchAtMs = 0;

// Lee el entitlement del usuario con el cliente público (RLS select-own de la
// migración 0016). FAIL-CLOSED: cualquier error, red caída o tabla ausente → no
// premium. La única puerta de premium es el servidor; acá solo se refleja la UI.
export async function hasActivePremium(
  userId: string,
  client: SupabaseClient | null = getSupabase(),
  force = false,
): Promise<boolean> {
  if (!client || !userId) return false;

  const now = Date.now();
  if (!force && cachedPremium !== null && now - lastFetchAtMs < CACHE_TTL_MS) {
    return cachedPremium;
  }

  try {
    const { data, error } = await client
      .from('entitlements')
      .select('key, expires_at')
      .eq('user_id', userId)
      .eq('key', 'premium')
      .maybeSingle();
    if (error || !data) {
      cachedPremium = false;
      lastFetchAtMs = now;
      return false;
    }
    const expiresAt = (data as { expires_at: string | null }).expires_at;
    const active = expiresAt === null || new Date(expiresAt).getTime() > now;
    cachedPremium = active;
    lastFetchAtMs = now;
    return active;
  } catch {
    cachedPremium = false;
    lastFetchAtMs = now;
    return false;
  }
}

export function resetPremiumCache(): void {
  cachedPremium = null;
  lastFetchAtMs = 0;
}

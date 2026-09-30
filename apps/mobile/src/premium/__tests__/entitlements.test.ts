import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { SupabaseClient } from '@supabase/supabase-js';
import { hasActivePremium, resetPremiumCache } from '../entitlements';

type FakeClient = SupabaseClient & {
  __handlers: { from: ReturnType<typeof jest.fn> };
};

function makeClient(
  handler: () => {
    data: { key: string; expires_at: string | null } | null;
    error: { message: string } | null;
  },
): FakeClient {
  const from = jest.fn().mockReturnValue({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockImplementation(handler),
  }) as unknown as ReturnType<typeof jest.fn>;
  return { from } as unknown as FakeClient;
}

beforeEach(() => {
  resetPremiumCache();
});

describe('hasActivePremium', () => {
  it('devuelve true con entitlement sin expiracion', async () => {
    const client = makeClient(() => ({
      data: { key: 'premium', expires_at: null },
      error: null,
    }));
    expect(await hasActivePremium('u1', client)).toBe(true);
  });

  it('devuelve true con expiracion futura', async () => {
    const future = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const client = makeClient(() => ({
      data: { key: 'premium', expires_at: future },
      error: null,
    }));
    expect(await hasActivePremium('u1', client)).toBe(true);
  });

  it('devuelve false con expiracion pasada', async () => {
    const past = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const client = makeClient(() => ({ data: { key: 'premium', expires_at: past }, error: null }));
    expect(await hasActivePremium('u1', client)).toBe(false);
  });

  it('fail-closed ante error de red o tabla', async () => {
    const client = makeClient(() => ({ data: null, error: { message: 'network' } }));
    expect(await hasActivePremium('u1', client)).toBe(false);
  });

  it('fail-closed sin user id o sin cliente', async () => {
    expect(await hasActivePremium('', null)).toBe(false);
    expect(await hasActivePremium('u1', null)).toBe(false);
  });

  it('cachea y usa force para refrescar', async () => {
    let call = 0;
    const client = makeClient(() => {
      call += 1;
      return { data: { key: 'premium', expires_at: null }, error: null };
    });
    await hasActivePremium('u1', client);
    await hasActivePremium('u1', client);
    expect(call).toBe(1);
    await hasActivePremium('u1', client, true);
    expect(call).toBe(2);
  });
});

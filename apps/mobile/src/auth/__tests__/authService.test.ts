import { describe, expect, it, jest } from '@jest/globals';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  fetchServerProfile,
  mapAuthError,
  resolveNickname,
  signIn,
  signOut,
  signUp,
  validateEmail,
  validatePassword,
} from '../authService';

type FakeClient = SupabaseClient & {
  __handlers: {
    signUp: ReturnType<typeof jest.fn>;
    signInWithPassword: ReturnType<typeof jest.fn>;
    signOut: ReturnType<typeof jest.fn>;
    from: ReturnType<typeof jest.fn>;
  };
};

function makeClient(): FakeClient {
  const signUp = jest.fn();
  const signInWithPassword = jest.fn();
  const signOut = jest.fn();
  const from = jest.fn();
  return {
    auth: { signUp, signInWithPassword, signOut },
    from,
    __handlers: { signUp, signInWithPassword, signOut, from },
  } as unknown as FakeClient;
}

describe('validateEmail / validatePassword', () => {
  it('accepts a valid email', () => {
    expect(validateEmail('anibal@hotmail.com')).toBe(true);
  });

  it('rejects an invalid email', () => {
    expect(validateEmail('not-an-email')).toBe(false);
  });

  it('accepts a password of 6+ characters', () => {
    expect(validatePassword('123456')).toBe(true);
    expect(validatePassword('12345')).toBe(false);
  });
});

describe('mapAuthError', () => {
  it('maps duplicate email to email_in_use', () => {
    expect(mapAuthError(new Error('User already registered'))).toBe('email_in_use');
  });

  it('maps wrong credentials to invalid_credentials', () => {
    expect(mapAuthError(new Error('Invalid login credentials'))).toBe('invalid_credentials');
  });

  it('maps network failure to network', () => {
    expect(mapAuthError(new Error('Failed to fetch'))).toBe('network');
    expect(mapAuthError(new Error('Network request failed'))).toBe('network');
  });

  it('falls back to unknown', () => {
    expect(mapAuthError(new Error('anything else'))).toBe('unknown');
  });
});

describe('signUp', () => {
  it('returns invalid_email without calling the client', async () => {
    const client = makeClient();
    const result = await signUp('nope', '123456', 'Anibal', client);
    expect(result).toEqual({ ok: false, errorCode: 'invalid_email' });
    expect(client.__handlers.signUp).not.toHaveBeenCalled();
  });

  it('returns password_short for a short password', async () => {
    const client = makeClient();
    const result = await signUp('a@b.co', '12345', 'Anibal', client);
    expect(result).toEqual({ ok: false, errorCode: 'password_short' });
  });

  it('returns ok with session when confirmation is not required', async () => {
    const client = makeClient();
    client.__handlers.signUp.mockResolvedValue({
      data: { session: {}, user: { id: 'u1' } },
      error: null,
    });
    const result = await signUp('a@b.co', '123456', 'Anibal', client);
    expect(result).toEqual({
      ok: true,
      needsEmailConfirmation: false,
      nickname: 'Anibal',
      userId: 'u1',
    });
  });

  it('flags email confirmation when no session is returned', async () => {
    const client = makeClient();
    client.__handlers.signUp.mockResolvedValue({
      data: { session: null, user: { id: 'u1' } },
      error: null,
    });
    const result = await signUp('a@b.co', '123456', 'Anibal', client);
    expect(result).toEqual({
      ok: true,
      needsEmailConfirmation: true,
      nickname: 'Anibal',
      userId: 'u1',
    });
  });

  it('maps a duplicate-email error', async () => {
    const client = makeClient();
    client.__handlers.signUp.mockResolvedValue({
      data: { session: null, user: null },
      error: new Error('User already registered'),
    });
    const result = await signUp('a@b.co', '123456', 'Anibal', client);
    expect(result).toEqual({ ok: false, errorCode: 'email_in_use' });
  });
});

describe('signIn', () => {
  it('maps network errors thrown by the client', async () => {
    const client = makeClient();
    client.__handlers.signInWithPassword.mockRejectedValue(new Error('Failed to fetch'));
    const result = await signIn('a@b.co', '123456', client);
    expect(result).toEqual({ ok: false, errorCode: 'network' });
  });
});

describe('signOut', () => {
  it('calls client.auth.signOut without throwing when the client fails', async () => {
    const client = makeClient();
    client.__handlers.signOut.mockRejectedValue(new Error('boom'));
    await expect(signOut(client)).resolves.toBeUndefined();
    expect(client.__handlers.signOut).toHaveBeenCalledTimes(1);
  });
});

describe('fetchServerProfile', () => {
  it('returns the profile when found', async () => {
    const client = makeClient();
    client.__handlers.from.mockReturnValue({
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            Promise.resolve({ data: { user_id: 'u1', nickname: 'Anibal' }, error: null }),
        }),
      }),
    });
    const profile = await fetchServerProfile('u1', client);
    expect(profile).toEqual({ id: 'u1', nickname: 'Anibal' });
  });

  it('returns null on error', async () => {
    const client = makeClient();
    client.__handlers.from.mockReturnValue({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: null, error: new Error('denied') }),
        }),
      }),
    });
    expect(await fetchServerProfile('u1', client)).toBeNull();
  });
});

describe('resolveNickname', () => {
  it('prefers a real server nickname', () => {
    expect(resolveNickname('Anibal', 'anibal kozur', 'Custom')).toBe('Anibal');
  });

  it('falls back to the local nickname when the server is generic', () => {
    expect(resolveNickname('atleta', 'anibal kozur', 'Custom')).toBe('Custom');
  });

  it('falls back to the oauth metadata when server and local are generic', () => {
    expect(resolveNickname('atleta', 'anibal kozur', 'Atleta')).toBe('anibal kozur');
  });

  it('defaults to Atleta when nothing is usable', () => {
    expect(resolveNickname(null, '', null)).toBe('Atleta');
    expect(resolveNickname('  ', 'atletas', undefined)).toBe('Atleta');
  });
});

import { describe, expect, it } from '@jest/globals';
import { extractAuthCode, extractImplicitSession } from '../googleSignIn';

describe('extractAuthCode', () => {
  it('extracts a code from a query string', () => {
    const url = 'exp://192.168.1.116:8081/?code=abc123&state=xyz';
    expect(extractAuthCode(url)).toBe('abc123');
  });

  it('extracts a code from a fragment', () => {
    const url = 'exp://192.168.1.116:8081#code=abc123';
    expect(extractAuthCode(url)).toBe('abc123');
  });

  it('returns null when there is no code', () => {
    expect(extractAuthCode('exp://192.168.1.116:8081#access_token=xyz')).toBeNull();
  });
});

describe('extractImplicitSession', () => {
  it('returns an empty mapping when there is no fragment', () => {
    expect(extractImplicitSession('exp://192.168.1.116:8081')).toBeNull();
  });

  it('extracts tokens from an implicit fragment', () => {
    const url = 'exp://192.168.1.116:8081#access_token=at-1&refresh_token=rt-1&expires_in=3600';
    expect(extractImplicitSession(url)).toEqual({
      accessToken: 'at-1',
      refreshToken: 'rt-1',
    });
  });

  it('returns null when access_token is missing', () => {
    expect(extractImplicitSession('exp://192.168.1.116:8081#refresh_token=rt-1')).toBeNull();
  });
});

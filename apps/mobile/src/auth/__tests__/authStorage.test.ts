import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import * as SecureStore from 'expo-secure-store';
import { getRepo } from '../../repo';
import { authStorage } from '../authStorage';

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    __store: store,
    getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      store.delete(key);
    }),
  };
});

jest.mock('../../repo', () => {
  const settings = new Map<string, string>();
  const repo = {
    getSetting: jest.fn(async (key: string) => settings.get(key) ?? null),
    setSetting: jest.fn(async (key: string, value: string) => {
      settings.set(key, value);
    }),
    removeSetting: jest.fn(async (key: string) => {
      settings.delete(key);
    }),
  };
  return { __settings: settings, getRepo: () => repo };
});

type SecureMock = {
  __store: Map<string, string>;
  getItemAsync: jest.Mock<(key: string) => Promise<string | null>>;
  setItemAsync: jest.Mock<(key: string, value: string) => Promise<void>>;
  deleteItemAsync: jest.Mock<(key: string) => Promise<void>>;
};

const secure = SecureStore as unknown as SecureMock;
const repo = getRepo();

const KEY = 'sb-test-auth-token';

beforeEach(() => {
  secure.__store.clear();
  repo.removeSetting(KEY);
  jest.clearAllMocks();
});

describe('authStorage', () => {
  it('returns null when nothing is stored', async () => {
    expect(await authStorage.getItem(KEY)).toBeNull();
  });

  it('stores and reads a session from SecureStore, not from the repo', async () => {
    const session = JSON.stringify({ access_token: 'abc', refresh_token: 'def' });
    await authStorage.setItem(KEY, session);

    expect(await authStorage.getItem(KEY)).toBe(session);
    expect(secure.setItemAsync).toHaveBeenCalled();
    expect(await repo.getSetting(KEY)).toBeNull();
  });

  it('chunks values larger than the SecureStore limit and reassembles them', async () => {
    const big = 'x'.repeat(5000);
    await authStorage.setItem(KEY, big);

    expect(await authStorage.getItem(KEY)).toBe(big);
    expect(secure.__store.get(`${KEY}.count`)).toBe('3');
    expect(secure.__store.has(`${KEY}.0`)).toBe(true);
    expect(secure.__store.has(`${KEY}.2`)).toBe(true);
  });

  it('removes every chunk so the value is gone afterwards', async () => {
    await authStorage.setItem(KEY, 'y'.repeat(5000));
    await authStorage.removeItem(KEY);

    expect(await authStorage.getItem(KEY)).toBeNull();
    expect(secure.__store.has(`${KEY}.count`)).toBe(false);
    expect(secure.__store.has(`${KEY}.0`)).toBe(false);
    expect(secure.__store.has(`${KEY}.2`)).toBe(false);
  });

  it('migrates a legacy plaintext session from the repo into SecureStore', async () => {
    await repo.setSetting(KEY, 'legacy-session');
    secure.__store.clear();

    expect(await authStorage.getItem(KEY)).toBe('legacy-session');
    expect(await repo.getSetting(KEY)).toBeNull();
    expect(secure.__store.get(`${KEY}.0`)).toBe('legacy-session');
  });

  it('falls back to the repo if SecureStore is not available', async () => {
    secure.setItemAsync.mockImplementationOnce(() => Promise.reject(new Error('unavailable')));

    await authStorage.setItem(KEY, 'fallback-session');

    expect(await repo.getSetting(KEY)).toBe('fallback-session');
  });
});

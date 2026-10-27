import { describe, expect, it } from '@jest/globals';
import type { SupabaseClient } from '@supabase/supabase-js';
import { MemoryRepo } from '../../repo/memoryRepo';
import { clearLocalAccountData, deleteAccount } from '../accountDeletion';

function fakeRpcClient(result: { error: Error | null } = { error: null }) {
  const calls: string[] = [];
  const client = {
    functions: {
      invoke: async (name: string) => {
        calls.push(name);
        return { data: null, error: result.error };
      },
    },
  };
  return { client: client as unknown as SupabaseClient, calls };
}

describe('deleteAccount', () => {
  it('calls the server-side account deletion RPC', async () => {
    const { client, calls } = fakeRpcClient();

    await deleteAccount(client);

    expect(calls).toEqual(['delete_account']);
  });

  it('does not hide an RPC failure', async () => {
    const { client } = fakeRpcClient({ error: new Error('boom') });

    await expect(deleteAccount(client)).rejects.toThrow('boom');
  });
});

describe('clearLocalAccountData', () => {
  it('removes the local profile and account settings', async () => {
    const repo = new MemoryRepo();
    await repo.saveProfile({ id: 'user-1', nickname: 'Ana', createdAt: '2026-01-01' });
    await repo.setSetting('profile', 'local-profile');
    await repo.setSetting('prefs', 'local-prefs');

    await clearLocalAccountData(repo, 'user-1');

    expect(await repo.getProfile()).toBeNull();
    expect(await repo.listKeys()).toEqual([]);
  });
});

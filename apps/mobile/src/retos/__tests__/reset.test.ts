import { describe, expect, it } from '@jest/globals';
import type { SupabaseClient } from '@supabase/supabase-js';
import { MemoryRepo } from '../../repo/memoryRepo';
import { markCompleted } from '../completions';
import { getTodayChallenge } from '../service';
import { pushFreeSession } from '../freeSessions';
import { resetCloudProgress, resetLocalProgress } from '../reset';

function fakeRpcClient() {
  const calls: { name: string; args: unknown }[] = [];
  const client = {
    rpc: async (name: string, args: unknown) => {
      calls.push({ name, args });
      return { data: null, error: null };
    },
  };
  return {
    client: client as unknown as SupabaseClient,
    calls,
  };
}

describe('resetLocalProgress', () => {
  it('clears completed markers, stored challenges and free sessions but keeps profile settings', async () => {
    const repo = new MemoryRepo();
    await markCompleted(repo, '2026-09-20');
    await markCompleted(repo, '2026-09-19');
    await getTodayChallenge(repo);
    await pushFreeSession(repo, {
      date: '2026-09-22',
      exerciseId: 'sentadillas',
      value: 25,
      target: 20,
      ranked: true,
      seriesOk: true,
    });
    await repo.setSetting('profile', JSON.stringify({ nickname: 'ana' }));

    await resetLocalProgress(repo);

    const keys = await repo.listKeys();
    expect(keys).not.toContain('completed:2026-09-20');
    expect(keys).not.toContain('completed:2026-09-19');
    expect(keys).not.toContain('completed:count');
    expect(keys).not.toContain('libre:sessions');
    expect(keys.every((k) => !k.startsWith('reto:'))).toBe(true);
    expect(keys).toContain('profile');
  });
});

describe('resetCloudProgress', () => {
  it('calls the reset_own_progress rpc', async () => {
    const { client, calls } = fakeRpcClient();

    await resetCloudProgress(client);

    expect(calls).toEqual([{ name: 'reset_own_progress', args: undefined }]);
  });

  it('throws when the rpc fails', async () => {
    const client = {
      rpc: async () => ({ error: new Error('boom') }),
    } as unknown as SupabaseClient;

    await expect(resetCloudProgress(client)).rejects.toThrow('boom');
  });
});

import { describe, expect, it } from '@jest/globals';
import type { SupabaseClient } from '@supabase/supabase-js';
import { MemoryRepo } from '../../repo/memoryRepo';
import { markCompleted } from '../completions';
import { getTodayChallenge } from '../service';
import { resetCloudProgress, resetLocalProgress } from '../reset';

function fakeDeleteClient() {
  const calls: { table: string; eq: unknown[] }[] = [];
  const client = {
    from(table: string) {
      return {
        delete: () => ({
          eq: async (...eqArgs: unknown[]) => {
            calls.push({ table, eq: eqArgs });
            return { error: null };
          },
        }),
      };
    },
  };
  return {
    client: client as unknown as SupabaseClient,
    calls,
  };
}

describe('resetLocalProgress', () => {
  it('clears completed markers and stored challenges but keeps profile settings', async () => {
    const repo = new MemoryRepo();
    await markCompleted(repo, '2026-09-20');
    await markCompleted(repo, '2026-09-19');
    await getTodayChallenge(repo);
    await repo.setSetting('profile', JSON.stringify({ nickname: 'ana' }));

    await resetLocalProgress(repo);

    const keys = await repo.listKeys();
    expect(keys).not.toContain('completed:2026-09-20');
    expect(keys).not.toContain('completed:2026-09-19');
    expect(keys).not.toContain('completed:count');
    expect(keys.every((k) => !k.startsWith('reto:'))).toBe(true);
    expect(keys).toContain('profile');
  });
});

describe('resetCloudProgress', () => {
  it('deletes the user own daily_challenges rows', async () => {
    const { client, calls } = fakeDeleteClient();

    await resetCloudProgress(client, 'user-1');

    expect(calls).toEqual([{ table: 'daily_challenges', eq: ['user_id', 'user-1'] }]);
  });

  it('throws when the delete fails', async () => {
    const client = {
      from: () => ({
        delete: () => ({
          eq: async () => ({ error: new Error('boom') }),
        }),
      }),
    } as unknown as SupabaseClient;

    await expect(resetCloudProgress(client, 'user-1')).rejects.toThrow('boom');
  });
});

import { describe, expect, it } from '@jest/globals';
import type { SupabaseClient } from '@supabase/supabase-js';
import { MemoryRepo } from '../../repo/memoryRepo';
import { markCompleted, getCompletedDates } from '../../retos/completions';
import { todayKey } from '../../retos/service';
import { uploadCompletions, fetchRanking } from '../syncService';

const EXERCISE_CODES = [
  'sentadillas',
  'flexiones',
  'plancha',
  'zancadas',
  'puente_gluteo',
  'mountain_climbers',
  'sentadilla_isometrica',
];

interface UpsertCall {
  rows: Record<string, unknown>[];
  options: unknown;
}

function fakeClient() {
  const calls: { upsert: UpsertCall | null; rpc: { name: string; args: unknown } | null } = {
    upsert: null,
    rpc: null,
  };
  let rpcError: unknown = null;
  let rpcData: unknown = [{ user_id: 'u1', nickname: 'ana', completed_challenges: 3 }];

  const client = {
    from(table: string) {
      if (table === 'exercises') {
        return {
          select: async () => ({
            data: EXERCISE_CODES.map((code) => ({ id: `uuid-${code}`, code })),
            error: null,
          }),
        };
      }
      return {
        upsert: async (rows: Record<string, unknown>[], options: unknown) => {
          calls.upsert = { rows, options };
          return { error: null };
        },
      };
    },
    rpc: async (name: string, args: unknown) => {
      calls.rpc = { name, args };
      return { data: rpcData, error: rpcError };
    },
  };

  return {
    client: client as unknown as SupabaseClient,
    calls,
    setRpcResult(data: unknown, error: unknown = null) {
      rpcData = data;
      rpcError = error;
    },
  };
}

describe('getCompletedDates', () => {
  it('returns only completed dates', async () => {
    const repo = new MemoryRepo();
    await markCompleted(repo, todayKey());
    const dates = await getCompletedDates(repo);
    expect(dates).toContain(todayKey());
    expect(dates).toHaveLength(1);
  });
});

describe('uploadCompletions', () => {
  it('upserts one completed row per completed date', async () => {
    const repo = new MemoryRepo();
    await markCompleted(repo, todayKey());
    const { client, calls } = fakeClient();

    const count = await uploadCompletions(client, repo, 'user-1');

    expect(count).toBe(1);
    expect(calls.upsert).not.toBeNull();
    expect(calls.upsert?.options).toEqual({ onConflict: 'user_id,challenge_date' });
    const row = calls.upsert?.rows[0];
    expect(row).toMatchObject({
      user_id: 'user-1',
      challenge_date: todayKey(),
      status: 'completed',
      goal_requested: 'mantener',
    });
    expect(String(row?.exercise_id)).toContain('uuid-');
    expect(typeof row?.target).toBe('number');
  });

  it('returns 0 and skips upsert when nothing is completed', async () => {
    const repo = new MemoryRepo();
    const { client, calls } = fakeClient();

    const count = await uploadCompletions(client, repo, 'user-1');

    expect(count).toBe(0);
    expect(calls.upsert).toBeNull();
  });
});

describe('fetchRanking', () => {
  it('calls the get_ranking rpc and returns rows', async () => {
    const { client, calls } = fakeClient();

    const rows = await fetchRanking(client, 25);

    expect(calls.rpc).toEqual({ name: 'get_ranking', args: { max_rows: 25 } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ nickname: 'ana', completed_challenges: 3 });
  });

  it('returns an empty list on error', async () => {
    const { client, setRpcResult } = fakeClient();
    setRpcResult(null, new Error('boom'));

    expect(await fetchRanking(client)).toEqual([]);
  });
});

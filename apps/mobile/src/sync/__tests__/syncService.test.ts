import { describe, expect, it } from '@jest/globals';
import type { SupabaseClient } from '@supabase/supabase-js';
import { MemoryRepo } from '../../repo/memoryRepo';
import { markCompleted, getCompletedDates } from '../../retos/completions';
import { todayKey } from '../../retos/service';
import { pushFreeSession, getFreeSessions } from '../../retos/freeSessions';
import {
  uploadCompletions,
  uploadSessions,
  fetchRanking,
  fetchRepsRanking,
  fetchTotalRepsRanking,
} from '../syncService';

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

interface InsertCall {
  table: string;
  rows: Record<string, unknown>[];
}

function fakeClient() {
  const calls: {
    upsert: UpsertCall | null;
    insert: InsertCall | null;
    rpc: { name: string; args: unknown } | null;
  } = {
    upsert: null,
    insert: null,
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
        insert: async (rows: Record<string, unknown>[]) => {
          calls.insert = { table, rows };
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

  it('filters out users with zero completed challenges', async () => {
    const { client, setRpcResult } = fakeClient();
    setRpcResult([
      { user_id: 'u1', nickname: 'ana', completed_challenges: 3 },
      { user_id: 'u2', nickname: 'leo', completed_challenges: 0 },
      { user_id: 'u3', nickname: 'sara', completed_challenges: 0 },
    ]);

    const rows = await fetchRanking(client);

    expect(rows.map((row) => row.user_id)).toEqual(['u1']);
  });
});

describe('uploadSessions', () => {
  it('inserts one row per free session with ranked flags', async () => {
    const { client, calls } = fakeClient();

    const count = await uploadSessions(client, 'user-1', [
      {
        date: '2026-09-22',
        exerciseId: 'sentadillas',
        value: 25,
        target: 20,
        ranked: true,
        seriesOk: true,
      },
      {
        date: '2026-09-22',
        exerciseId: 'flexiones',
        value: 8,
        target: 10,
        ranked: false,
        seriesOk: false,
      },
    ]);

    expect(count).toBe(2);
    expect(calls.insert?.table).toBe('workout_sessions');
    expect(calls.insert?.rows).toEqual([
      {
        user_id: 'user-1',
        exercise_code: 'sentadillas',
        value: 25,
        target: 20,
        source: 'libre',
        ranked: true,
        series_ok: true,
        session_date: '2026-09-22',
      },
      {
        user_id: 'user-1',
        exercise_code: 'flexiones',
        value: 8,
        target: 10,
        source: 'libre',
        ranked: false,
        series_ok: false,
        session_date: '2026-09-22',
      },
    ]);
  });

  it('returns 0 and skips insert for empty sessions', async () => {
    const { client, calls } = fakeClient();

    expect(await uploadSessions(client, 'user-1', [])).toBe(0);
    expect(calls.insert).toBeNull();
  });
});

describe('fetchRepsRanking', () => {
  it('calls get_reps_ranking with the exercise code', async () => {
    const { client, calls } = fakeClient();
    calls.rpc = null;

    await fetchRepsRanking(client, 'sentadillas', 20);

    expect(calls.rpc).toEqual({
      name: 'get_reps_ranking',
      args: { p_exercise_code: 'sentadillas', p_max_rows: 20 },
    });
  });

  it('maps rpc data to rep rows', async () => {
    const { client, setRpcResult } = fakeClient();
    setRpcResult([
      { user_id: 'u1', nickname: 'ana', best_value: 30, sessions: 4 },
      { user_id: 'u2', nickname: 'leo', best_value: 25, sessions: 2 },
    ]);

    const rows = await fetchRepsRanking(client, 'sentadillas');

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ best_value: 30, sessions: 4 });
  });

  it('returns an empty list on error', async () => {
    const { client, setRpcResult } = fakeClient();
    setRpcResult(null, new Error('boom'));

    expect(await fetchRepsRanking(client, 'sentadillas')).toEqual([]);
  });
});

describe('fetchTotalRepsRanking', () => {
  it('calls get_total_reps_ranking', async () => {
    const { client, calls } = fakeClient();
    calls.rpc = null;

    await fetchTotalRepsRanking(client, 15);

    expect(calls.rpc).toEqual({
      name: 'get_total_reps_ranking',
      args: { p_max_rows: 15 },
    });
  });

  it('maps total rows and keeps session store intact', async () => {
    const repo = new MemoryRepo();
    await pushFreeSession(repo, {
      date: '2026-09-22',
      exerciseId: 'sentadillas',
      value: 25,
      target: 20,
      ranked: true,
      seriesOk: true,
    });
    const { client, setRpcResult } = fakeClient();
    setRpcResult([{ user_id: 'u1', nickname: 'ana', total_value: 120 }]);

    const rows = await fetchTotalRepsRanking(client);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ total_value: 120 });
    expect(await getFreeSessions(repo)).toHaveLength(1);
  });
});

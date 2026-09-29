import { describe, expect, it } from '@jest/globals';
import type { SupabaseClient } from '@supabase/supabase-js';
import { MemoryRepo } from '../../repo/memoryRepo';
import { markCompleted, getCompletedDates, setCompletionSyncState } from '../../retos/completions';
import { buildChallenge, todayKey } from '../../retos/service';
import { pushFreeSession, getFreeSessions } from '../../retos/freeSessions';
import {
  uploadCompletions,
  uploadSessions,
  fetchRanking,
  fetchRepsRanking,
  fetchTotalRepsRanking,
  syncAfterLogin,
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

interface InvokeCall {
  name: string;
  options: unknown;
}

function fakeClient() {
  const calls: {
    upsert: null;
    insert: null;
    invoke: InvokeCall | null;
    rpc: { name: string; args: unknown } | null;
  } = {
    upsert: null,
    insert: null,
    invoke: null,
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
        upsert: async () => ({ error: null }),
        insert: async () => ({ error: null }),
      };
    },
    functions: {
      invoke: async (name: string, options: unknown) => {
        calls.invoke = { name, options };
        const body = (options as { body?: { completions?: unknown[] } }).body;
        const clientOpIds = (
          body?.completions ??
          (options as { body?: { sessions?: unknown[] } }).body?.sessions ??
          []
        )
          .map((item) => (item as { clientOpId?: string }).clientOpId)
          .filter((id): id is string => Boolean(id));
        return {
          data: {
            received: clientOpIds.length,
            pending: clientOpIds.length,
            rejected: 0,
            verified: 0,
            completionReceived: clientOpIds.length,
            completionPending: clientOpIds.length,
            completionVerified: 0,
            results: clientOpIds.map((clientOpId: string) => ({
              clientOpId,
              status: 'pending',
              reason: 'awaiting_server_validator',
            })),
          },
          error: null,
        };
      },
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
  it('sends one pending completion proposal per completed date', async () => {
    const repo = new MemoryRepo();
    await markCompleted(repo, todayKey());
    const { client, calls } = fakeClient();

    const outcome = await uploadCompletions(client, repo, 'user-1');

    expect(outcome.received).toBe(1);
    expect(outcome.confirmed).toBe(0);
    expect(outcome.results).toEqual([
      { clientOpId: `daily:${todayKey()}`, status: 'pending', reason: 'awaiting_server_validator' },
    ]);
    expect(calls.invoke).toMatchObject({ name: 'validate_workout' });
    expect(calls.invoke?.options).toEqual({
      body: {
        completions: [
          {
            clientOpId: `daily:${todayKey()}`,
            challengeDate: todayKey(),
            exerciseCode: buildChallenge(todayKey(), 'mantener').exerciseId,
            target: buildChallenge(todayKey(), 'mantener').target,
            goal: 'mantener',
            value: buildChallenge(todayKey(), 'mantener').target,
            unit: 'reps',
            evidence: undefined,
          },
        ],
      },
    });
    expect(calls.upsert).toBeNull();
  });

  it('sends the completion evidence captured by the camera', async () => {
    const repo = new MemoryRepo();
    await markCompleted(repo, todayKey(), {
      value: 25,
      unit: 'reps',
      target: 20,
      evidence: { verifyVersion: 12, durationMs: 12000 },
    });
    const { client, calls } = fakeClient();

    const outcome = await uploadCompletions(client, repo, 'user-1');

    expect(outcome.received).toBe(1);
    expect(outcome.confirmed).toBe(0);
    const completion = (
      calls.invoke?.options as { body: { completions: Record<string, unknown>[] } }
    ).body.completions[0];
    expect(completion).toMatchObject({
      clientOpId: `daily:${todayKey()}`,
      value: 25,
      unit: 'reps',
      evidence: { verifyVersion: 12, durationMs: 12000 },
    });
  });

  it('returns 0 and skips validation when nothing is completed', async () => {
    const repo = new MemoryRepo();
    const { client, calls } = fakeClient();

    const outcome = await uploadCompletions(client, repo, 'user-1');

    expect(outcome.received).toBe(0);
    expect(calls.invoke).toBeNull();
  });

  it('does not resend a rejected completion until it is retried locally', async () => {
    const repo = new MemoryRepo();
    await markCompleted(repo, todayKey());
    await setCompletionSyncState(repo, todayKey(), {
      status: 'rejected',
      reason: 'challenge_mismatch',
    });
    const { client, calls } = fakeClient();

    const outcome = await uploadCompletions(client, repo, 'user-1');

    expect(outcome.received).toBe(0);
    expect(calls.invoke).toBeNull();
  });

  it('does not resend a verified completion (server-authoritative)', async () => {
    const repo = new MemoryRepo();
    await markCompleted(repo, todayKey());
    await setCompletionSyncState(repo, todayKey(), { status: 'verified' });
    const { client, calls } = fakeClient();

    const outcome = await uploadCompletions(client, repo, 'user-1');

    expect(outcome.received).toBe(0);
    expect(calls.invoke).toBeNull();
  });

  it('resends a rejected completion after it is force-registered as pending (retry)', async () => {
    const repo = new MemoryRepo();
    await markCompleted(repo, todayKey(), { value: 22, unit: 'reps', target: 20 });
    await setCompletionSyncState(repo, todayKey(), {
      status: 'rejected',
      reason: 'challenge_mismatch',
    });
    await markCompleted(repo, todayKey(), { value: 25, unit: 'reps', target: 20 }, { retry: true });
    const { client, calls } = fakeClient();

    const outcome = await uploadCompletions(client, repo, 'user-1');

    expect(outcome.received).toBe(1);
    expect(calls.invoke).toBeDefined();
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
  it('submits one row per free session to the server validator', async () => {
    const { client, calls } = fakeClient();

    const outcome = await uploadSessions(client, 'user-1', [
      {
        date: '2026-09-22',
        exerciseId: 'sentadillas',
        value: 25,
        target: 20,
        ranked: true,
        seriesOk: true,
        clientOpId: 'op-1',
      },
      {
        date: '2026-09-22',
        exerciseId: 'flexiones',
        value: 8,
        target: 10,
        ranked: false,
        seriesOk: false,
        clientOpId: 'op-2',
      },
    ]);

    expect(outcome.received).toBe(2);
    expect(outcome.results).toEqual([
      { clientOpId: 'op-1', status: 'pending', reason: 'awaiting_server_validator' },
      { clientOpId: 'op-2', status: 'pending', reason: 'awaiting_server_validator' },
    ]);
    expect(calls.invoke).toEqual({
      name: 'validate_workout',
      options: {
        body: {
          sessions: [
            {
              clientOpId: 'op-1',
              exerciseCode: 'sentadillas',
              value: 25,
              target: 20,
              source: 'libre',
              ranked: true,
              seriesOk: true,
              livenessOk: false,
              sessionDate: '2026-09-22',
            },
            {
              clientOpId: 'op-2',
              exerciseCode: 'flexiones',
              value: 8,
              target: 10,
              source: 'libre',
              ranked: false,
              seriesOk: false,
              livenessOk: false,
              sessionDate: '2026-09-22',
            },
          ],
        },
      },
    });
    expect(calls.upsert).toBeNull();
  });

  it('generates a client_op_id when the queued session lacks one', async () => {
    const { client, calls } = fakeClient();

    await uploadSessions(client, 'user-1', [
      {
        date: '2026-09-22',
        exerciseId: 'plancha',
        value: 60,
        target: 30,
        ranked: true,
        seriesOk: true,
      },
    ]);

    const submitted = (calls.invoke?.options as { body: { sessions: Record<string, unknown>[] } })
      .body.sessions[0];
    expect(typeof submitted.clientOpId).toBe('string');
    expect(String(submitted.clientOpId).length).toBeGreaterThan(0);
  });

  it('returns 0 and skips upsert for empty sessions', async () => {
    const { client, calls } = fakeClient();

    const outcome = await uploadSessions(client, 'user-1', []);

    expect(outcome.received).toBe(0);
    expect(calls.invoke).toBeNull();
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

describe('syncAfterLogin', () => {
  it('does not resend free sessions already rejected by the server', async () => {
    const repo = new MemoryRepo();
    await pushFreeSession(repo, {
      date: '2026-09-21',
      exerciseId: 'plancha',
      value: 60,
      target: 30,
      ranked: true,
      seriesOk: true,
      clientOpId: 'op-rejected',
      status: 'rejected',
      statusReason: 'premium_required',
    });
    await pushFreeSession(repo, {
      date: '2026-09-22',
      exerciseId: 'sentadillas',
      value: 25,
      target: 20,
      ranked: true,
      seriesOk: true,
      clientOpId: 'op-pending',
    });
    const { client, calls } = fakeClient();

    await syncAfterLogin(repo, 'user-1', client);

    const sent = (calls.invoke?.options as { body: { sessions: Record<string, unknown>[] } }).body
      .sessions;
    const sentOpIds = sent.map((s) => s.clientOpId);
    expect(sentOpIds).toEqual(['op-pending']);
  });

  it('keeps rejected sessions in the local store after syncing', async () => {
    const repo = new MemoryRepo();
    await pushFreeSession(repo, {
      date: '2026-09-21',
      exerciseId: 'plancha',
      value: 60,
      target: 30,
      ranked: true,
      seriesOk: true,
      clientOpId: 'op-rejected',
      status: 'rejected',
      statusReason: 'premium_required',
    });
    const { client } = fakeClient();

    await syncAfterLogin(repo, 'user-1', client);

    const stored = await getFreeSessions(repo);
    expect(stored).toHaveLength(1);
    expect(stored[0].clientOpId).toBe('op-rejected');
    expect(stored[0].status).toBe('rejected');
  });

  it('syncs the local goal to the server via set_goal before uploading', async () => {
    const repo = new MemoryRepo();
    const { client, calls } = fakeClient();

    await syncAfterLogin(repo, 'user-1', client);

    expect(calls.rpc).toEqual({ name: 'set_goal', args: { p_goal: 'mantener' } });
  });
});

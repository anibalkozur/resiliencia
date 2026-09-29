import { describe, expect, it } from '@jest/globals';
import { MemoryRepo } from '../../repo/memoryRepo';
import {
  markCompleted,
  setCompletionSyncState,
  getCompletionSyncState,
  getTotalCompleted,
} from '../completions';
import {
  FREE_SESSIONS_KEY,
  FREE_SESSIONS_MAX,
  getFreeSessions,
  pushFreeSession,
  clearFreeSessions,
  flushFreeSessions,
  retainOnlyUnaccepted,
  applySessionResults,
} from '../freeSessions';

const base = {
  date: '2026-09-22',
  exerciseId: 'sentadillas',
  value: 25,
  target: 20,
  ranked: true,
  seriesOk: true,
};

describe('freeSessions', () => {
  it('starts empty', async () => {
    const repo = new MemoryRepo();
    expect(await getFreeSessions(repo)).toEqual([]);
  });

  it('pushes and reads a session with a generated client op id', async () => {
    const repo = new MemoryRepo();
    await pushFreeSession(repo, base);

    const list = await getFreeSessions(repo);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject(base);
    expect(typeof list[0].clientOpId).toBe('string');
    expect(list[0].clientOpId?.length).toBeGreaterThan(0);
  });

  it('keeps an existing client op id when given', async () => {
    const repo = new MemoryRepo();
    await pushFreeSession(repo, { ...base, clientOpId: 'op-x' });

    const list = await getFreeSessions(repo);
    expect(list[0].clientOpId).toBe('op-x');
  });

  it('appends sessions in order', async () => {
    const repo = new MemoryRepo();
    await pushFreeSession(repo, base);
    await pushFreeSession(repo, { ...base, exerciseId: 'flexiones', value: 10 });

    const list = await getFreeSessions(repo);
    expect(list.map((s) => s.exerciseId)).toEqual(['sentadillas', 'flexiones']);
  });

  it('caps the store at FREE_SESSIONS_MAX and keeps the newest', async () => {
    const repo = new MemoryRepo();
    for (let i = 0; i < FREE_SESSIONS_MAX + 10; i++) {
      await pushFreeSession(repo, { ...base, value: i });
    }

    const list = await getFreeSessions(repo);
    expect(list).toHaveLength(FREE_SESSIONS_MAX);
    expect(list[0].value).toBe(10);
    expect(list[list.length - 1].value).toBe(FREE_SESSIONS_MAX + 9);
  });

  it('tolerates corrupt stored json', async () => {
    const repo = new MemoryRepo();
    await repo.setSetting(FREE_SESSIONS_KEY, 'not-json{');

    expect(await getFreeSessions(repo)).toEqual([]);
  });

  it('clears the store', async () => {
    const repo = new MemoryRepo();
    await pushFreeSession(repo, base);
    await clearFreeSessions(repo);

    expect(await getFreeSessions(repo)).toEqual([]);
  });

  it('flushes the pending sessions and clears the store', async () => {
    const repo = new MemoryRepo();
    await pushFreeSession(repo, base);
    await pushFreeSession(repo, { ...base, exerciseId: 'flexiones' });

    const flushed = await flushFreeSessions(repo);

    expect(flushed).toHaveLength(2);
    expect(await getFreeSessions(repo)).toEqual([]);
  });

  it('retainOnlyUnaccepted keeps pending and rejected, drops only accepted', async () => {
    const repo = new MemoryRepo();
    await pushFreeSession(repo, { ...base, clientOpId: 'op-accepted' });
    await pushFreeSession(repo, { ...base, clientOpId: 'op-pending' });
    await pushFreeSession(repo, { ...base, clientOpId: 'op-rejected' });

    const remaining = await retainOnlyUnaccepted(repo, new Set(['op-accepted']));

    expect(remaining.map((s) => s.clientOpId)).toEqual(['op-pending', 'op-rejected']);
    expect((await getFreeSessions(repo)).map((s) => s.clientOpId)).toEqual([
      'op-pending',
      'op-rejected',
    ]);
  });

  it('applySessionResults persists the verdict and reason per proposuesta', async () => {
    const repo = new MemoryRepo();
    await pushFreeSession(repo, { ...base, clientOpId: 'op-1' });
    await pushFreeSession(repo, { ...base, clientOpId: 'op-2' });

    await applySessionResults(repo, [
      { clientOpId: 'op-1', status: 'rejected', reason: 'liveness_required' },
      { clientOpId: 'op-2', status: 'pending', reason: 'awaiting_server_validator' },
    ]);

    const list = await getFreeSessions(repo);
    expect(list[0].status).toBe('rejected');
    expect(list[0].statusReason).toBe('liveness_required');
    expect(list[1].status).toBe('pending');
    expect(list[1].statusReason).toBe('awaiting_server_validator');
  });
});

describe('markCompleted retry', () => {
  it('allows re-marking a rejected date with { retry: true } and resets status to pending', async () => {
    const repo = new MemoryRepo();
    await markCompleted(repo, '2026-09-28', { value: 25, unit: 'reps', target: 20 });
    await setCompletionSyncState(repo, '2026-09-28', {
      status: 'rejected',
      reason: 'challenge_mismatch',
    });

    await markCompleted(
      repo,
      '2026-09-28',
      { value: 30, unit: 'reps', target: 20 },
      { retry: true },
    );

    const state = await getCompletionSyncState(repo, '2026-09-28');
    expect(state?.status).toBe('pending');
    expect(await getTotalCompleted(repo)).toBe(1);
  });

  it('does not double-count the completion when retrying', async () => {
    const repo = new MemoryRepo();
    await markCompleted(repo, '2026-09-28', { value: 25, unit: 'reps', target: 20 });
    await markCompleted(
      repo,
      '2026-09-28',
      { value: 28, unit: 'reps', target: 20 },
      { retry: true },
    );

    expect(await getTotalCompleted(repo)).toBe(1);
  });

  it('does not reset a verified date to pending when force-retrying', async () => {
    const repo = new MemoryRepo();
    await markCompleted(repo, '2026-09-28');
    await setCompletionSyncState(repo, '2026-09-28', { status: 'verified' });

    await markCompleted(
      repo,
      '2026-09-28',
      { value: 28, unit: 'reps', target: 20 },
      { retry: true },
    );

    const state = await getCompletionSyncState(repo, '2026-09-28');
    expect(state?.status).toBe('verified');
  });
});

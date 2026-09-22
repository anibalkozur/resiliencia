import { describe, expect, it } from '@jest/globals';
import { MemoryRepo } from '../../repo/memoryRepo';
import {
  FREE_SESSIONS_KEY,
  FREE_SESSIONS_MAX,
  getFreeSessions,
  pushFreeSession,
  clearFreeSessions,
  flushFreeSessions,
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

  it('pushes and reads a session', async () => {
    const repo = new MemoryRepo();
    await pushFreeSession(repo, base);

    const list = await getFreeSessions(repo);
    expect(list).toHaveLength(1);
    expect(list[0]).toEqual(base);
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
});

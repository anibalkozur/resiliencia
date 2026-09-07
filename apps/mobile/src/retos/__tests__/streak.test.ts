import { describe, expect, it } from '@jest/globals';
import { MemoryRepo } from '../../repo/memoryRepo';
import { markCompleted } from '../completions';
import { getBestStreak, getStreak } from '../streak';

function date(offset: number): string {
  const now = new Date(2026, 8, 15);
  now.setDate(now.getDate() - offset);
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const NOW = new Date(2026, 8, 15);

describe('getStreak', () => {
  it('returns 0 when nothing is completed', async () => {
    const repo = new MemoryRepo();
    expect(await getStreak(repo, NOW)).toBe(0);
  });

  it('counts consecutive completed days ending today', async () => {
    const repo = new MemoryRepo();
    await markCompleted(repo, date(0));
    await markCompleted(repo, date(1));
    await markCompleted(repo, date(2));
    expect(await getStreak(repo, NOW)).toBe(3);
  });

  it('keeps the streak alive when today is not completed yet', async () => {
    const repo = new MemoryRepo();
    await markCompleted(repo, date(1));
    await markCompleted(repo, date(2));
    await markCompleted(repo, date(3));
    expect(await getStreak(repo, NOW)).toBe(3);
  });

  it('breaks the streak on a gap', async () => {
    const repo = new MemoryRepo();
    await markCompleted(repo, date(0));
    await markCompleted(repo, date(2));
    await markCompleted(repo, date(3));
    expect(await getStreak(repo, NOW)).toBe(1);
  });

  it('returns 1 when only today is completed', async () => {
    const repo = new MemoryRepo();
    await markCompleted(repo, date(0));
    expect(await getStreak(repo, NOW)).toBe(1);
  });

  it('ignores completions older than the streak window', async () => {
    const repo = new MemoryRepo();
    await markCompleted(repo, date(0));
    await markCompleted(repo, date(1));
    await markCompleted(repo, date(60));
    expect(await getStreak(repo, NOW)).toBe(2);
  });

  it('is idempotent for the same completed date', async () => {
    const repo = new MemoryRepo();
    await markCompleted(repo, date(0));
    await markCompleted(repo, date(0));
    expect(await getStreak(repo, NOW)).toBe(1);
  });
});

describe('getBestStreak', () => {
  it('returns 0 when nothing is completed', async () => {
    const repo = new MemoryRepo();
    expect(await getBestStreak(repo, NOW)).toBe(0);
  });

  it('returns the longest consecutive run even after a gap', async () => {
    const repo = new MemoryRepo();
    await markCompleted(repo, date(0));
    await markCompleted(repo, date(1));
    await markCompleted(repo, date(2));
    await markCompleted(repo, date(6));
    await markCompleted(repo, date(7));
    await markCompleted(repo, date(8));
    await markCompleted(repo, date(9));
    expect(await getBestStreak(repo, NOW)).toBe(4);
  });

  it('does not count today as part of a run when today is not completed', async () => {
    const repo = new MemoryRepo();
    await markCompleted(repo, date(1));
    await markCompleted(repo, date(2));
    expect(await getBestStreak(repo, NOW)).toBe(2);
  });

  it('treats non-consecutive single days as best of 1', async () => {
    const repo = new MemoryRepo();
    await markCompleted(repo, date(0));
    await markCompleted(repo, date(3));
    await markCompleted(repo, date(7));
    expect(await getBestStreak(repo, NOW)).toBe(1);
  });
});

import type { IRepo } from '../repo';

function dateKey(date: string): string {
  return `completed:${date}`;
}

const COUNT_KEY = 'completed:count';

export async function markCompleted(repo: IRepo, date: string): Promise<void> {
  const existing = await repo.getSetting(dateKey(date));
  if (existing === '1') return;
  await repo.setSetting(dateKey(date), '1');
  const raw = await repo.getSetting(COUNT_KEY);
  const count = raw ? parseInt(raw, 10) : 0;
  await repo.setSetting(COUNT_KEY, String(count + 1));
}

export async function isCompleted(repo: IRepo, date: string): Promise<boolean> {
  return (await repo.getSetting(dateKey(date))) === '1';
}

export async function getTotalCompleted(repo: IRepo): Promise<number> {
  const raw = await repo.getSetting(COUNT_KEY);
  return raw ? parseInt(raw, 10) : 0;
}

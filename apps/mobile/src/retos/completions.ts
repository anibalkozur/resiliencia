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

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export async function getCompletedDates(repo: IRepo, now: Date = new Date()): Promise<string[]> {
  const dates: string[] = [];
  for (let i = 0; i < 365; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = formatDate(d);
    if ((await repo.getSetting(dateKey(key))) === '1') {
      dates.push(key);
    }
  }
  return dates;
}

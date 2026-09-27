import type { IRepo } from '../repo';

function dateKey(date: string): string {
  return `completed:${date}`;
}

function metaKey(date: string): string {
  return `completedMeta:${date}`;
}

const COUNT_KEY = 'completed:count';

export interface CompletionMeta {
  value: number;
  unit: 'reps' | 'seconds';
  target: number;
  evidence?: Record<string, unknown>;
}

export async function markCompleted(
  repo: IRepo,
  date: string,
  meta?: CompletionMeta,
): Promise<void> {
  const existing = await repo.getSetting(dateKey(date));
  if (existing === '1') return;
  await repo.setSetting(dateKey(date), '1');
  if (meta) {
    await repo.setSetting(metaKey(date), JSON.stringify(meta));
  }
  const raw = await repo.getSetting(COUNT_KEY);
  const count = raw ? parseInt(raw, 10) : 0;
  await repo.setSetting(COUNT_KEY, String(count + 1));
}

export async function getCompletionMeta(repo: IRepo, date: string): Promise<CompletionMeta | null> {
  const raw = await repo.getSetting(metaKey(date));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<CompletionMeta>;
    if (
      typeof parsed.value === 'number' &&
      Number.isInteger(parsed.value) &&
      parsed.value > 0 &&
      (parsed.unit === 'reps' || parsed.unit === 'seconds') &&
      typeof parsed.target === 'number' &&
      parsed.target > 0
    ) {
      return parsed as CompletionMeta;
    }
  } catch {
    return null;
  }
  return null;
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

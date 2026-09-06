import type { IRepo } from '../repo';

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export async function getStreak(repo: IRepo, now: Date = new Date()): Promise<number> {
  let streak = 0;

  for (let i = 0; i < 365; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const raw = await repo.getSetting(`completed:${formatDate(d)}`);
    const completed = raw === '1';

    if (!completed) {
      if (i === 0) continue;
      break;
    }

    streak++;
  }

  return streak;
}

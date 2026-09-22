import type { IRepo } from '../repo';

export const FREE_SESSIONS_KEY = 'libre:sessions';
export const FREE_SESSIONS_MAX = 500;

export interface FreeSession {
  date: string;
  exerciseId: string;
  value: number;
  target: number;
  ranked: boolean;
  seriesOk: boolean;
}

function parse(raw: string | null | undefined): FreeSession[] {
  if (!raw) {
    return [];
  }
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as FreeSession[]) : [];
  } catch {
    return [];
  }
}

export async function getFreeSessions(repo: IRepo): Promise<FreeSession[]> {
  return parse(await repo.getSetting(FREE_SESSIONS_KEY));
}

export async function pushFreeSession(repo: IRepo, session: FreeSession): Promise<void> {
  const list = await getFreeSessions(repo);
  list.push(session);
  if (list.length > FREE_SESSIONS_MAX) {
    list.splice(0, list.length - FREE_SESSIONS_MAX);
  }
  await repo.setSetting(FREE_SESSIONS_KEY, JSON.stringify(list));
}

export async function clearFreeSessions(repo: IRepo): Promise<void> {
  await repo.removeSetting(FREE_SESSIONS_KEY);
}

export async function flushFreeSessions(repo: IRepo): Promise<FreeSession[]> {
  const list = await getFreeSessions(repo);
  if (list.length > 0) {
    await clearFreeSessions(repo);
  }
  return list;
}

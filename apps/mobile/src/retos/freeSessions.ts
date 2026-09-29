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
  livenessOk?: boolean;
  clientOpId?: string;
  evidence?: Record<string, unknown>;
  /** Ultimo veredicto del servidor para esta propuesta (F0). */
  status?: 'accepted' | 'pending' | 'rejected';
  statusReason?: string;
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
  const next = { ...session };
  if (!next.clientOpId) {
    next.clientOpId = Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
  list.push(next);
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

// Elimina solo las operaciones que el servidor confirmó (accepted). Las
// pending/rejected se conservan: el cliente debe poder reintentar o mostrar el
// motivo sin perder la propuesta (regla F0, PLAN v4).
export async function retainOnlyUnaccepted(
  repo: IRepo,
  acceptedOpIds: ReadonlySet<string>,
): Promise<FreeSession[]> {
  const list = await getFreeSessions(repo);
  const remaining = list.filter((s) => !acceptedOpIds.has(s.clientOpId ?? ''));
  if (remaining.length !== list.length) {
    await repo.setSetting(FREE_SESSIONS_KEY, JSON.stringify(remaining));
  }
  return remaining;
}

// Persiste el veredicto por clientOpId en las propuestas conservadas, para que
// la UI pueda mostrar el motivo de un rechazo sin perder la propuesta.
export async function applySessionResults(
  repo: IRepo,
  results: readonly { clientOpId: string; status?: FreeSession['status']; reason?: string }[],
): Promise<FreeSession[]> {
  const list = await getFreeSessions(repo);
  const byOp = new Map(results.map((r) => [r.clientOpId, r]));
  let changed = false;
  for (const s of list) {
    const verdict = byOp.get(s.clientOpId ?? '');
    if (verdict && verdict.status && verdict.status !== s.status) {
      s.status = verdict.status;
      s.statusReason = verdict.reason;
      changed = true;
    }
  }
  if (changed) {
    await repo.setSetting(FREE_SESSIONS_KEY, JSON.stringify(list));
  }
  return list;
}

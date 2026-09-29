import type { SupabaseClient } from '@supabase/supabase-js';
import type { IRepo } from '../repo';
import { getSupabase } from '../auth/supabase';
import { getPrefs } from '../prefs/service';
import {
  getCompletedDates,
  getCompletionMeta,
  getCompletionSyncState,
  setCompletionSyncState,
} from '../retos/completions';
import type { CompletionSyncStatus, CompletionSyncState } from '../retos/completions';
import { buildChallenge, getStoredChallenge, inferChallengeGoal } from '../retos/service';
import { EXERCISES } from '../retos/catalog';
import { getFreeSessions, retainOnlyUnaccepted, applySessionResults } from '../retos/freeSessions';
import type { FreeSession } from '../retos/freeSessions';

export interface RankingRow {
  user_id: string;
  nickname: string;
  completed_challenges: number;
  current_streak: number;
  best_streak: number;
}

export interface RepsRankingRow {
  user_id: string;
  nickname: string;
  best_value: number;
  sessions: number;
}

export interface TotalRepsRankingRow {
  user_id: string;
  nickname: string;
  total_value: number;
}

export interface WorkoutSessionRow {
  clientOpId: string;
  exerciseCode: string;
  value: number;
  target: number;
  source: 'reto_diario' | 'libre';
  ranked: boolean;
  seriesOk: boolean;
  livenessOk: boolean;
  sessionDate: string;
  evidence?: Record<string, unknown>;
}

/** Estado que el servidor devolvió para una operación enviada. */
export type SubmissionResultStatus = 'accepted' | 'pending' | 'rejected';

export interface SubmissionResult {
  clientOpId: string;
  status: SubmissionResultStatus;
  reason?: string;
}

// El container de resultados de una subida: evita que un edge viejo (sin
// resultados por elemento) borre la cola por error.
export interface UploadOutcome {
  received: number;
  confirmed: number;
  results?: SubmissionResult[];
}

function parseResults(data: unknown): SubmissionResult[] | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const arr = (data as { results?: unknown }).results;
  if (!Array.isArray(arr)) return undefined;
  const results = arr.filter((r): r is SubmissionResult => {
    if (!r || typeof r !== 'object') return false;
    const o = r as { clientOpId?: unknown; status?: unknown };
    return (
      typeof o.clientOpId === 'string' &&
      o.clientOpId.length > 0 &&
      (o.status === 'accepted' || o.status === 'pending' || o.status === 'rejected')
    );
  });
  return results.length > 0 ? results : undefined;
}

export async function uploadCompletions(
  client: SupabaseClient,
  repo: IRepo,
  _userId: string,
): Promise<UploadOutcome> {
  const dates = await getCompletedDates(repo);
  if (dates.length === 0) {
    return { received: 0, confirmed: 0 };
  }
  const prefs = await getPrefs(repo);
  // Regla F0: lo rechazado por el servidor se conserva localmente pero no se
  // reenvía en bucle. Las fechas ya verified son terminales (invariante
  // server-authoritative) y tampoco se reenvían: solo viaja lo pendiente o sin
  // veredicto.
  const candidates: string[] = [];
  for (const date of dates) {
    const state = await getCompletionSyncState(repo, date);
    if (state && (state.status === 'rejected' || state.status === 'verified')) {
      continue;
    }
    candidates.push(date);
  }
  const completions = [];
  for (const date of candidates) {
    const challenge = (await getStoredChallenge(repo, date)) ?? buildChallenge(date, prefs.goal);
    const meta = await getCompletionMeta(repo, date);
    const goal = challenge.goal ?? inferChallengeGoal(challenge);
    if (!goal) {
      continue;
    }
    const unit = EXERCISES.find((e) => e.id === challenge.exerciseId)?.unit ?? 'reps';
    completions.push({
      clientOpId: `daily:${date}`,
      challengeDate: date,
      exerciseCode: challenge.exerciseId,
      target: challenge.target,
      goal,
      value: meta?.value ?? challenge.target,
      unit,
      evidence: meta?.evidence,
    });
  }

  if (completions.length === 0) {
    return { received: 0, confirmed: 0 };
  }

  const { data, error } = await client.functions.invoke('validate_workout', {
    body: { completions },
  });
  if (error) {
    throw error;
  }
  const received = Number(data?.completionReceived ?? 0);
  if (!Number.isFinite(received) || received < 0) {
    throw new Error('validate_workout returned an invalid completion response');
  }
  const results = parseResults(data);
  // Persistimos el veredicto por fecha para que la UI distinga pendiente /
  // verificado / rechazado y para no reintentar lo rechazado.
  if (results) {
    for (const result of results) {
      const match = /^daily:(\d{4}-\d{2}-\d{2})$/.exec(result.clientOpId);
      if (!match) continue;
      const status: CompletionSyncStatus =
        result.status === 'accepted' ? 'verified' : result.status;
      const state: CompletionSyncState = { status, reason: result.reason };
      await setCompletionSyncState(repo, match[1], state);
    }
  }
  const confirmed =
    results?.filter((r) => r.status === 'accepted').length ??
    // Fallback a respuestas viejas (sin resultados por elemento): el edge
    // actual SIEMPRE devuelve pending, así que ninguna cuenta como confirmada.
    0;
  return { received, confirmed, results };
}

// Sincroniza el objetivo de las prefs locales con profiles.goal (vía set_goal)
// para que goal_history y la validación server-side del reto tengan objetivo.
// Best-effort: si no hay sesión/red no rompe el sync.
export async function syncGoalToServer(
  client: SupabaseClient | null,
  repo: IRepo,
): Promise<boolean> {
  if (!client) {
    return false;
  }
  try {
    const prefs = await getPrefs(repo);
    const { error } = await client.rpc('set_goal', { p_goal: prefs.goal });
    return !error;
  } catch {
    return false;
  }
}

export async function fetchRanking(client: SupabaseClient, maxRows = 50): Promise<RankingRow[]> {
  const { data, error } = await client.rpc('get_ranking', { max_rows: maxRows });
  if (error || !data) {
    return [];
  }
  return (data as RankingRow[]).filter((row) => row.completed_challenges > 0);
}

export async function uploadSessions(
  client: SupabaseClient,
  _userId: string,
  sessions: FreeSession[],
): Promise<UploadOutcome> {
  if (sessions.length === 0) {
    return { received: 0, confirmed: 0 };
  }
  const rows: WorkoutSessionRow[] = sessions.map((s) => ({
    clientOpId:
      s.clientOpId != null && s.clientOpId.length > 0
        ? s.clientOpId
        : Math.random().toString(36).slice(2) + Date.now().toString(36),
    exerciseCode: s.exerciseId,
    value: s.value,
    target: s.target,
    source: 'libre',
    ranked: s.ranked,
    seriesOk: s.seriesOk,
    livenessOk: s.livenessOk === true,
    sessionDate: s.date,
    evidence: s.evidence,
  }));
  const { data, error } = await client.functions.invoke('validate_workout', {
    body: { sessions: rows },
  });
  if (error) {
    throw error;
  }
  const received = Number(data?.received ?? 0);
  if (!Number.isFinite(received) || received < 0) {
    throw new Error('validate_workout returned an invalid response');
  }
  return { received, confirmed: 0, results: parseResults(data) };
}

export async function fetchRepsRanking(
  client: SupabaseClient,
  exerciseCode: string,
  maxRows = 10,
): Promise<RepsRankingRow[]> {
  const { data, error } = await client.rpc('get_reps_ranking', {
    p_exercise_code: exerciseCode,
    p_max_rows: maxRows,
  });
  if (error || !data) {
    return [];
  }
  return data as RepsRankingRow[];
}

export async function fetchTotalRepsRanking(
  client: SupabaseClient,
  maxRows = 10,
): Promise<TotalRepsRankingRow[]> {
  const { data, error } = await client.rpc('get_total_reps_ranking', {
    p_max_rows: maxRows,
  });
  if (error || !data) {
    return [];
  }
  return data as TotalRepsRankingRow[];
}

export async function syncAfterLogin(
  repo: IRepo,
  userId: string,
  client: SupabaseClient | null = getSupabase(),
): Promise<number> {
  if (!client) {
    return 0;
  }
  try {
    let confirmed = 0;
    // Primero el objetivo: goal_history y la validación del reto dependen de
    // profiles.goal. Lo sincronizamos antes de enviar completions.
    await syncGoalToServer(client, repo);
    const completionsOutcome = await uploadCompletions(client, repo, userId);
    confirmed += completionsOutcome.confirmed;
    const allSessions = await getFreeSessions(repo);
    // Las sesiones rechazadas no se reenvían en bucle: se conservan localmente
    // (para que la UI muestre el motivo) pero no vuelven a la cola de subida.
    const sessions = allSessions.filter((s) => s.status !== 'rejected');
    if (sessions.length > 0) {
      const sessionsOutcome = await uploadSessions(client, userId, sessions);
      // Conserva el veredicto (incluido el motivo de rechazo) en la cola local
      // antes de descartar solo las accepted (regla F0).
      if (sessionsOutcome.results) {
        await applySessionResults(repo, sessionsOutcome.results);
      }
      const accepted = new Set(
        (sessionsOutcome.results ?? [])
          .filter((r) => r.status === 'accepted')
          .map((r) => r.clientOpId),
      );
      await retainOnlyUnaccepted(repo, accepted);
    }
    return confirmed;
  } catch {
    return 0;
  }
}

import type { SupabaseClient } from '@supabase/supabase-js';
import type { IRepo } from '../repo';
import { getSupabase } from '../auth/supabase';
import { getPrefs } from '../prefs/service';
import { getCompletedDates, getCompletionMeta } from '../retos/completions';
import { buildChallenge, getStoredChallenge, inferChallengeGoal } from '../retos/service';
import { EXERCISES } from '../retos/catalog';
import { getFreeSessions, clearFreeSessions } from '../retos/freeSessions';
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

export async function uploadCompletions(
  client: SupabaseClient,
  repo: IRepo,
  _userId: string,
): Promise<number> {
  const dates = await getCompletedDates(repo);
  if (dates.length === 0) {
    return 0;
  }
  const prefs = await getPrefs(repo);
  const completions = [];
  for (const date of dates) {
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
    return 0;
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
  return received;
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
): Promise<number> {
  if (sessions.length === 0) {
    return 0;
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
  return received;
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
    let uploaded = await uploadCompletions(client, repo, userId);
    const sessions = await getFreeSessions(repo);
    if (sessions.length > 0) {
      uploaded += await uploadSessions(client, userId, sessions);
      await clearFreeSessions(repo);
    }
    return uploaded;
  } catch {
    return 0;
  }
}

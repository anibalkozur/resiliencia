import type { SupabaseClient } from '@supabase/supabase-js';
import type { IRepo } from '../repo';
import { getSupabase } from '../auth/supabase';
import { getPrefs } from '../prefs/service';
import { getCompletedDates } from '../retos/completions';
import { buildChallenge } from '../retos/service';
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

interface ExerciseRow {
  id: string;
  code: string;
}

interface DailyChallengeRow {
  user_id: string;
  challenge_date: string;
  exercise_id: string;
  target: number;
  status: 'completed';
  goal_requested: string;
}

export interface WorkoutSessionRow {
  user_id: string;
  exercise_code: string;
  value: number;
  target: number;
  source: 'reto_diario' | 'libre';
  ranked: boolean;
  series_ok: boolean;
  session_date: string;
}

async function fetchExerciseIds(client: SupabaseClient): Promise<Map<string, string>> {
  const { data, error } = await client.from('exercises').select('id, code');
  if (error || !data) {
    return new Map();
  }
  return new Map((data as ExerciseRow[]).map((row) => [row.code, row.id]));
}

export async function uploadCompletions(
  client: SupabaseClient,
  repo: IRepo,
  userId: string,
): Promise<number> {
  const dates = await getCompletedDates(repo);
  if (dates.length === 0) {
    return 0;
  }
  const prefs = await getPrefs(repo);
  const exerciseIds = await fetchExerciseIds(client);

  const rows: DailyChallengeRow[] = [];
  for (const date of dates) {
    const challenge = buildChallenge(date, prefs.goal);
    const exerciseId = exerciseIds.get(challenge.exerciseId);
    if (!exerciseId) {
      continue;
    }
    rows.push({
      user_id: userId,
      challenge_date: date,
      exercise_id: exerciseId,
      target: challenge.target,
      status: 'completed',
      goal_requested: prefs.goal,
    });
  }

  if (rows.length === 0) {
    return 0;
  }

  const { error } = await client
    .from('daily_challenges')
    .upsert(rows, { onConflict: 'user_id,challenge_date' });
  if (error) {
    throw error;
  }
  return rows.length;
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
  userId: string,
  sessions: FreeSession[],
): Promise<number> {
  if (sessions.length === 0) {
    return 0;
  }
  const rows: WorkoutSessionRow[] = sessions.map((s) => ({
    user_id: userId,
    exercise_code: s.exerciseId,
    value: s.value,
    target: s.target,
    source: 'libre',
    ranked: s.ranked,
    series_ok: s.seriesOk,
    session_date: s.date,
  }));
  const { error } = await client.from('workout_sessions').insert(rows);
  if (error) {
    throw error;
  }
  return rows.length;
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

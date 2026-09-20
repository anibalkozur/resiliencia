import type { SupabaseClient } from '@supabase/supabase-js';
import type { IRepo } from '../repo';
import { getSupabase } from '../auth/supabase';
import { getPrefs } from '../prefs/service';
import { getCompletedDates } from '../retos/completions';
import { buildChallenge } from '../retos/service';

export interface RankingRow {
  user_id: string;
  nickname: string;
  completed_challenges: number;
  current_streak: number;
  best_streak: number;
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
  return data as RankingRow[];
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
    return await uploadCompletions(client, repo, userId);
  } catch {
    return 0;
  }
}

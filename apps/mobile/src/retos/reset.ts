import type { SupabaseClient } from '@supabase/supabase-js';
import type { IRepo } from '../repo';
import { FREE_SESSIONS_KEY } from './freeSessions';

export async function resetLocalProgress(repo: IRepo): Promise<void> {
  const keys = await repo.listKeys();
  for (const key of keys) {
    if (key.startsWith('completed:') || key.startsWith('reto:')) {
      await repo.removeSetting(key);
    }
  }
  await repo.removeSetting(FREE_SESSIONS_KEY);
}

export async function resetCloudProgress(client: SupabaseClient): Promise<void> {
  const { error } = await client.rpc('reset_own_progress');
  if (error) {
    throw error;
  }
}

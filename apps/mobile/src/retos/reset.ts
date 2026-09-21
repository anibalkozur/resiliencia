import type { SupabaseClient } from '@supabase/supabase-js';
import type { IRepo } from '../repo';

export async function resetLocalProgress(repo: IRepo): Promise<void> {
  const keys = await repo.listKeys();
  for (const key of keys) {
    if (key.startsWith('completed:') || key.startsWith('reto:')) {
      await repo.removeSetting(key);
    }
  }
}

export async function resetCloudProgress(client: SupabaseClient, userId: string): Promise<void> {
  const { error } = await client
    .from('daily_challenges')
    .update({ status: 'pending' })
    .eq('user_id', userId);
  if (error) {
    throw error;
  }
}

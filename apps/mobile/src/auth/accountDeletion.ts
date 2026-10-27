import type { SupabaseClient } from '@supabase/supabase-js';
import type { IRepo } from '../repo';
import { removeAvatar } from '../user/avatar';

export async function deleteAccount(client: SupabaseClient | null): Promise<void> {
  if (!client) {
    throw new Error('auth_not_configured');
  }
  const { data, error } = await client.functions.invoke('delete_account', { body: {} });
  if (error) {
    throw error;
  }
  if (data && typeof data === 'object' && 'error' in data) {
    throw new Error(String((data as { error: unknown }).error));
  }
}

export async function clearLocalAccountData(repo: IRepo, userId: string): Promise<void> {
  // El avatar se guarda como archivo local, no en Supabase Storage.
  const failures: unknown[] = [];
  try {
    await removeAvatar(repo, userId);
  } catch (err) {
    failures.push(err);
  }
  try {
    await repo.clearProfile();
  } catch (err) {
    failures.push(err);
  }
  try {
    const keys = await repo.listKeys();
    const results = await Promise.allSettled(keys.map((key) => repo.removeSetting(key)));
    failures.push(
      ...results.filter((result) => result.status === 'rejected').map((result) => result.reason),
    );
  } catch (err) {
    failures.push(err);
  }
  if (failures.length > 0) {
    throw new Error('local_account_cleanup_incomplete');
  }
}

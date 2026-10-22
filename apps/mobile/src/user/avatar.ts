import * as FileSystem from 'expo-file-system/legacy';
import type { IRepo } from '../repo';

const AVATAR_DIRECTORY = 'avatars/';
const AVATAR_SETTING_PREFIX = 'profile.avatar.';

function avatarSettingKey(userId: string): string {
  return `${AVATAR_SETTING_PREFIX}${userId}`;
}

function avatarFileName(userId: string): string {
  const safeId = userId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `avatar-${safeId}.jpg`;
}

export async function loadAvatar(repo: IRepo, userId: string): Promise<string | null> {
  const stored = await repo.getSetting(avatarSettingKey(userId));
  if (!stored) return null;

  try {
    const info = await FileSystem.getInfoAsync(stored);
    return info.exists ? stored : null;
  } catch {
    return null;
  }
}

export async function persistAvatar(
  repo: IRepo,
  userId: string,
  sourceUri: string,
): Promise<string> {
  const root = FileSystem.documentDirectory;
  if (!root) throw new Error('Avatar storage is unavailable on this device');

  const directory = `${root}${AVATAR_DIRECTORY}`;
  const target = `${directory}${avatarFileName(userId)}`;
  const current = await repo.getSetting(avatarSettingKey(userId));

  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  if (current && current !== target) {
    await FileSystem.deleteAsync(current, { idempotent: true });
  }
  await FileSystem.deleteAsync(target, { idempotent: true });
  await FileSystem.copyAsync({ from: sourceUri, to: target });
  await repo.setSetting(avatarSettingKey(userId), target);
  return target;
}

export async function removeAvatar(repo: IRepo, userId: string): Promise<void> {
  const current = await repo.getSetting(avatarSettingKey(userId));
  if (current) {
    await FileSystem.deleteAsync(current, { idempotent: true });
  }
  await repo.removeSetting(avatarSettingKey(userId));
}

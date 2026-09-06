import type { IRepo } from './IRepo';
import { SqliteRepo } from './sqliteRepo';

export type { IRepo } from './IRepo';
export type { UserProfile } from './types';
export { MemoryRepo } from './memoryRepo';
export { SqliteRepo } from './sqliteRepo';

let instance: IRepo | null = null;

export function getRepo(): IRepo {
  if (!instance) {
    instance = new SqliteRepo();
  }
  return instance;
}

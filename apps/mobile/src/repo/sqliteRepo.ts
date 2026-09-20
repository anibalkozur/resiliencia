import * as SQLite from 'expo-sqlite';
import type { IRepo } from './IRepo';
import type { UserProfile } from './types';

const PROFILE_KEY = 'profile';

export class SqliteRepo implements IRepo {
  private dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

  private getDb(): Promise<SQLite.SQLiteDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = SQLite.openDatabaseAsync('resiliencia.db').then(async (db) => {
        await db.execAsync(
          'PRAGMA journal_mode = WAL; ' +
            'CREATE TABLE IF NOT EXISTS app_settings (' +
            'key TEXT PRIMARY KEY NOT NULL, ' +
            'value TEXT NOT NULL);',
        );
        return db;
      });
    }
    return this.dbPromise;
  }

  async getProfile(): Promise<UserProfile | null> {
    const row = await (
      await this.getDb()
    ).getFirstAsync<{ value: string }>('SELECT value FROM app_settings WHERE key = ?', PROFILE_KEY);
    return row ? (JSON.parse(row.value) as UserProfile) : null;
  }

  async saveProfile(profile: UserProfile): Promise<void> {
    await (
      await this.getDb()
    ).runAsync(
      'INSERT INTO app_settings (key, value) VALUES (?, ?) ' +
        'ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      PROFILE_KEY,
      JSON.stringify(profile),
    );
  }

  async getSetting(key: string): Promise<string | null> {
    const row = await (
      await this.getDb()
    ).getFirstAsync<{ value: string }>('SELECT value FROM app_settings WHERE key = ?', key);
    return row?.value ?? null;
  }

  async setSetting(key: string, value: string): Promise<void> {
    await (
      await this.getDb()
    ).runAsync(
      'INSERT INTO app_settings (key, value) VALUES (?, ?) ' +
        'ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      key,
      value,
    );
  }

  async removeSetting(key: string): Promise<void> {
    await (await this.getDb()).runAsync('DELETE FROM app_settings WHERE key = ?', key);
  }

  async listKeys(): Promise<string[]> {
    const rows = await (
      await this.getDb()
    ).getAllAsync<{ key: string }>('SELECT key FROM app_settings ORDER BY key');
    return rows.map((row) => row.key);
  }
}

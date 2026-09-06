import type { IRepo } from './IRepo';
import type { UserProfile } from './types';

export class MemoryRepo implements IRepo {
  private profile: UserProfile | null = null;
  private settings = new Map<string, string>();

  async getProfile(): Promise<UserProfile | null> {
    return this.profile;
  }

  async saveProfile(profile: UserProfile): Promise<void> {
    this.profile = profile;
  }

  async getSetting(key: string): Promise<string | null> {
    return this.settings.get(key) ?? null;
  }

  async setSetting(key: string, value: string): Promise<void> {
    this.settings.set(key, value);
  }
}

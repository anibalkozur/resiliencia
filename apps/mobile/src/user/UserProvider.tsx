import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { getRepo } from '../repo';
import type { UserProfile } from '../repo';
import type { ProfilePatch } from './service';
import { createUser, updateProfile } from './service';
import { loadAvatar, persistAvatar, removeAvatar } from './avatar';

type UserState = {
  profile: UserProfile | null;
  isLoading: boolean;
  createUser: (nickname: string) => Promise<void>;
  updateProfile: (patch: ProfilePatch) => Promise<UserProfile | null>;
  attachAccount: (account: { userId: string; nickname: string }) => Promise<void>;
  avatarUri: string | null;
  setAvatarUri: (sourceUri: string | null) => Promise<void>;
};

const UserContext = createContext<UserState | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const repo = getRepo();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [avatarState, setAvatarState] = useState<{ ownerId: string | null; uri: string | null }>({
    ownerId: null,
    uri: null,
  });

  useEffect(() => {
    repo.getProfile().then((stored) => {
      setProfile(stored);
      setIsLoading(false);
    });
  }, [repo]);

  useEffect(() => {
    let active = true;
    if (!profile?.id) return;

    void loadAvatar(repo, profile.id).then((stored) => {
      if (active) setAvatarState({ ownerId: profile.id, uri: stored });
    });

    return () => {
      active = false;
    };
  }, [profile?.id, repo]);

  const avatarUri = avatarState.ownerId === profile?.id ? avatarState.uri : null;

  const value = useMemo<UserState>(
    () => ({
      profile,
      isLoading,
      createUser: async (nickname: string) => {
        const created = await createUser(repo, nickname);
        setProfile(created);
      },
      updateProfile: async (patch: ProfilePatch) => {
        const updated = await updateProfile(repo, patch);
        if (updated) {
          setProfile(updated);
        }
        return updated;
      },
      attachAccount: async (account: { userId: string; nickname: string }) => {
        const local = await repo.getProfile();
        const existing = local ?? {
          id: account.userId,
          nickname: 'Atleta',
          createdAt: new Date().toISOString(),
        };
        const merged: UserProfile = {
          ...existing,
          id: account.userId,
          nickname:
            account.nickname.trim().length > 0 ? account.nickname.trim() : existing.nickname,
        };
        await repo.saveProfile(merged);
        setProfile(merged);
      },
      avatarUri,
      setAvatarUri: async (sourceUri: string | null) => {
        if (!profile?.id) return;
        if (sourceUri === null) {
          await removeAvatar(repo, profile.id);
          setAvatarState({ ownerId: profile.id, uri: null });
          return;
        }
        const stored = await persistAvatar(repo, profile.id, sourceUri);
        setAvatarState({ ownerId: profile.id, uri: stored });
      },
    }),
    [profile, isLoading, repo, avatarUri],
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser(): UserState {
  const ctx = useContext(UserContext);
  if (!ctx) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return ctx;
}

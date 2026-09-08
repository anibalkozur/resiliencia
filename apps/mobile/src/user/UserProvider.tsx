import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { getRepo } from '../repo';
import type { UserProfile } from '../repo';
import type { ProfilePatch } from './service';
import { createUser, updateProfile } from './service';

type UserState = {
  profile: UserProfile | null;
  isLoading: boolean;
  createUser: (nickname: string) => Promise<void>;
  updateProfile: (patch: ProfilePatch) => Promise<UserProfile | null>;
};

const UserContext = createContext<UserState | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const repo = getRepo();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    repo.getProfile().then((stored) => {
      setProfile(stored);
      setIsLoading(false);
    });
  }, [repo]);

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
    }),
    [profile, isLoading, repo],
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

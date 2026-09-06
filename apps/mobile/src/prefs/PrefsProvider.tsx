import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { getRepo } from '../repo';
import { getPrefs, savePrefs } from './service';
import type { UserPrefs } from './types';

type PrefsState = {
  prefs: UserPrefs | null;
  isLoading: boolean;
  updatePrefs: (patch: Partial<UserPrefs>) => Promise<void>;
};

const PrefsContext = createContext<PrefsState | null>(null);

export function PrefsProvider({ children }: { children: ReactNode }) {
  const repo = getRepo();
  const [prefs, setPrefs] = useState<UserPrefs | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getPrefs(repo).then((stored) => {
      setPrefs(stored);
      setIsLoading(false);
    });
  }, [repo]);

  const value = useMemo<PrefsState>(
    () => ({
      prefs,
      isLoading,
      updatePrefs: async (patch: Partial<UserPrefs>) => {
        const next = await savePrefs(repo, patch);
        setPrefs(next);
      },
    }),
    [prefs, isLoading, repo],
  );

  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export function usePrefs(): PrefsState {
  const ctx = useContext(PrefsContext);
  if (!ctx) {
    throw new Error('usePrefs must be used within a PrefsProvider');
  }
  return ctx;
}

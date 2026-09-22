import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

type LibreExerciseState = {
  libreExerciseId: string;
  setLibreExerciseId: (id: string) => void;
  libreTarget: number;
  setLibreTarget: (target: number) => void;
  libreRanked: boolean;
  setLibreRanked: (ranked: boolean) => void;
};

const LibreExerciseContext = createContext<LibreExerciseState | null>(null);

export function LibreExerciseProvider({ children }: { children: ReactNode }) {
  const [libreExerciseId, setLibreExerciseId] = useState('sentadillas');
  const [libreTarget, setLibreTarget] = useState(20);
  const [libreRanked, setLibreRanked] = useState(false);
  return (
    <LibreExerciseContext.Provider
      value={{
        libreExerciseId,
        setLibreExerciseId,
        libreTarget,
        setLibreTarget,
        libreRanked,
        setLibreRanked,
      }}
    >
      {children}
    </LibreExerciseContext.Provider>
  );
}

export function useLibreExercise(): LibreExerciseState {
  const ctx = useContext(LibreExerciseContext);
  if (!ctx) {
    throw new Error('useLibreExercise must be used within LibreExerciseProvider');
  }
  return ctx;
}

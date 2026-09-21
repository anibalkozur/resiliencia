import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

type LibreExerciseState = {
  libreExerciseId: string;
  setLibreExerciseId: (id: string) => void;
};

const LibreExerciseContext = createContext<LibreExerciseState | null>(null);

export function LibreExerciseProvider({ children }: { children: ReactNode }) {
  const [libreExerciseId, setLibreExerciseId] = useState('sentadillas');
  return (
    <LibreExerciseContext.Provider value={{ libreExerciseId, setLibreExerciseId }}>
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

import { createContext, useCallback, useContext, useRef, useState } from 'react';
import type { ReactNode } from 'react';

type LibreExerciseState = {
  libreExerciseId: string;
  setLibreExerciseId: (id: string) => void;
  libreTarget: number;
  setLibreTarget: (target: number) => void;
  libreRanked: boolean;
  setLibreRanked: (ranked: boolean) => void;
  /** True mientras hay una sesión de cámara activa en modo libre. */
  libreActive: boolean;
  setLibreActive: (active: boolean) => void;
  /** La pantalla de cámara registra acá su acción de salir. */
  setSalirHandler: (handler: (() => void) | null) => void;
  /** Dispara la acción de salir registrada (botón touch del header). */
  salir: () => void;
};

const LibreExerciseContext = createContext<LibreExerciseState | null>(null);

export function LibreExerciseProvider({ children }: { children: ReactNode }) {
  const [libreExerciseId, setLibreExerciseId] = useState('sentadillas');
  const [libreTarget, setLibreTarget] = useState(20);
  const [libreRanked, setLibreRanked] = useState(false);
  const [libreActive, setLibreActive] = useState(false);
  const salirHandler = useRef<(() => void) | null>(null);

  const setSalirHandler = useCallback((handler: (() => void) | null) => {
    salirHandler.current = handler;
  }, []);
  const salir = useCallback(() => {
    salirHandler.current?.();
  }, []);

  return (
    <LibreExerciseContext.Provider
      value={{
        libreExerciseId,
        setLibreExerciseId,
        libreTarget,
        setLibreTarget,
        libreRanked,
        setLibreRanked,
        libreActive,
        setLibreActive,
        setSalirHandler,
        salir,
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

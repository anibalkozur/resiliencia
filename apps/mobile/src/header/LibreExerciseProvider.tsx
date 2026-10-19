import { createContext, useCallback, useContext, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { DEFAULT_TARGETS } from '../retos/catalog';

export type RoutineItem = {
  id: string;
  target: number;
};

type LibreExerciseState = {
  /** Rutina del modo libre: ejercicios en orden con su meta (1 o más). */
  routine: RoutineItem[];
  /** Agrega un ejercicio al final de la rutina con su meta por defecto. */
  addExercise: (id: string) => void;
  /** Quita un ejercicio (mínimo queda 1). */
  removeExercise: (index: number) => void;
  /** Mueve un ejercicio dentro de la rutina (`dir`: -1 arriba, 1 abajo). */
  moveExercise: (index: number, dir: -1 | 1) => void;
  /** Cambia la meta de un ejercicio. */
  setExerciseTarget: (index: number, target: number) => void;
  /** Solo aplica a rutinas de un ejercicio (modo único). */
  libreRanked: boolean;
  setLibreRanked: (ranked: boolean) => void;
  /** True mientras hay una sesión de cámara activa en modo libre. */
  libreActive: boolean;
  setLibreActive: (active: boolean) => void;
  /** La pantalla de cámara registra acá su acción de salir. */
  setSalirHandler: (handler: (() => void) | null) => void;
  /** Dispara la acción de salir registrada (botón touch del header). */
  salir: () => void;
  /** True mientras la cámara del reto diario está montada en la pestaña Retos. */
  retosActive: boolean;
  setRetosActive: (active: boolean) => void;
  /** La pantalla del reto registra acá su acción de salir. */
  setRetosSalirHandler: (handler: (() => void) | null) => void;
  /** Dispara la salida del reto (botón touch del header). */
  salirRetos: () => void;
};

const LibreExerciseContext = createContext<LibreExerciseState | null>(null);

export function LibreExerciseProvider({ children }: { children: ReactNode }) {
  const [routine, setRoutine] = useState<RoutineItem[]>([
    { id: 'sentadillas', target: DEFAULT_TARGETS['sentadillas'] ?? 20 },
  ]);
  const [libreRanked, setLibreRanked] = useState(false);
  const [libreActive, setLibreActive] = useState(false);
  const salirHandler = useRef<(() => void) | null>(null);
  const [retosActive, setRetosActive] = useState(false);
  const retosSalirHandler = useRef<(() => void) | null>(null);

  const addExercise = useCallback((id: string) => {
    setRoutine((r) => [...r, { id, target: DEFAULT_TARGETS[id] ?? 10 }]);
  }, []);
  const removeExercise = useCallback((index: number) => {
    setRoutine((r) => {
      if (r.length <= 1) return r;
      return r.filter((_, i) => i !== index);
    });
  }, []);
  const moveExercise = useCallback((index: number, dir: -1 | 1) => {
    setRoutine((r) => {
      const j = index + dir;
      if (j < 0 || j >= r.length) return r;
      const copy = r.slice();
      const [item] = copy.splice(index, 1);
      copy.splice(j, 0, item);
      return copy;
    });
  }, []);
  const setExerciseTarget = useCallback((index: number, target: number) => {
    setRoutine((r) => r.map((it, i) => (i === index ? { ...it, target } : it)));
  }, []);

  const setSalirHandler = useCallback((handler: (() => void) | null) => {
    salirHandler.current = handler;
  }, []);
  const salir = useCallback(() => {
    salirHandler.current?.();
  }, []);

  const setRetosSalirHandler = useCallback((handler: (() => void) | null) => {
    retosSalirHandler.current = handler;
  }, []);
  const salirRetos = useCallback(() => {
    retosSalirHandler.current?.();
  }, []);

  return (
    <LibreExerciseContext.Provider
      value={{
        routine,
        addExercise,
        removeExercise,
        moveExercise,
        setExerciseTarget,
        libreRanked,
        setLibreRanked,
        libreActive,
        setLibreActive,
        setSalirHandler,
        salir,
        retosActive,
        setRetosActive,
        setRetosSalirHandler,
        salirRetos,
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

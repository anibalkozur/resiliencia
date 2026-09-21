import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';

export function useCameraRestart(): number {
  const [restartKey, setRestartKey] = useState(0);
  const focusedRef = useRef(false);
  const appState = useRef(AppState.currentState);

  useFocusEffect(
    useCallback(() => {
      focusedRef.current = true;
      return () => {
        focusedRef.current = false;
      };
    }, []),
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      const prev = appState.current;
      appState.current = next;
      if (prev !== 'active' && next === 'active' && focusedRef.current) {
        setRestartKey((k) => k + 1);
      }
    });
    return () => sub.remove();
  }, []);

  return restartKey;
}

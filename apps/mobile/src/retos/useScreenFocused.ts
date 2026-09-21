import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

export function useScreenFocused(): boolean {
  const [focused, setFocused] = useState(true);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  return focused;
}

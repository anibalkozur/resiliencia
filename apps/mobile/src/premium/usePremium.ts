import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { hasActivePremium } from './entitlements';

// Premium activo para la UI (picker y guard de inicio). Se consulta cuando el
// usuario cambia; ante error o sesión ausente el resultado es `false`.
export function usePremium(): boolean {
  const { session } = useAuth();
  const [premiumByUser, setPremiumByUser] = useState<Record<string, boolean>>({});
  const userId = session?.user?.id;

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    void hasActivePremium(userId).then((value) => {
      if (alive) setPremiumByUser((prev) => ({ ...prev, [userId]: value }));
    });
    return () => {
      alive = false;
    };
  }, [userId]);

  return userId ? (premiumByUser[userId] ?? false) : false;
}

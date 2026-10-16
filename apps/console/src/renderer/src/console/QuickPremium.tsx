import { useCallback, useEffect, useState } from 'react';
import { admin_console } from '../lib/adminApi';

type Props = {
  userId: string;
  email: string | null;
};

// Toggle de un clic para que el director se cambie entre free y premium desde
// la propia Console, sin cargar user_id a mano: usa su sesión actual. Va por la
// misma RPC auditada que el resto de la gestión (grant/revoke server-side); no
// abre ningún camino de escritura nuevo.
export function QuickPremium({ userId, email }: Props) {
  const [premium, setPremium] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await admin_console.listEntitlements(userId);
      const now = Date.now();
      const active = data.entitlements.some(
        (e) => e.key === 'premium' && (e.expires_at === null || Date.parse(e.expires_at) > now),
      );
      setPremium(active);
    } catch (err) {
      setPremium(null);
      setError(err instanceof Error ? err.message : 'No se pudo leer tu estado.');
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = useCallback(async () => {
    if (premium === null) return;
    setBusy(true);
    setError(null);
    try {
      const reason = 'Toggle rápido del director (prueba free↔premium en la app)';
      if (premium) {
        await admin_console.revokeEntitlement(userId, 'premium', reason);
      } else {
        await admin_console.grantEntitlement(userId, 'premium', null, reason);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cambiar tu estado.');
    } finally {
      setBusy(false);
    }
  }, [premium, userId, load]);

  const label = premium === null ? 'Premium —' : premium ? 'Premium ON' : 'Premium OFF';

  return (
    <div className="row" style={{ gap: 8 }} title={email ? `Tu cuenta: ${email}` : 'Tu cuenta'}>
      <span className={`badge ${premium ? 'active' : 'expired'}`}>{label}</span>
      <button
        className="btn primary"
        onClick={() => void toggle()}
        disabled={busy || premium === null}
      >
        {busy ? '…' : premium ? 'Pasar a free' : 'Activar premium'}
      </button>
      {error && <span className="error">{error}</span>}
    </div>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { admin_console } from '../lib/adminApi';
import type { EntitlementRow } from '../lib/types';
import { EVENT_CATALOGUE, PRODUCT_CHOICES, eventById } from '../lib/events';

type Props = {
  role: string | null;
};

function shortName(userId: string): string {
  return userId.length > 13 ? `${userId.slice(0, 8)}…${userId.slice(-4)}` : userId;
}

export function EntitlementsView({ role }: Props) {
  const isDirector = role === 'director';

  const [userId, setUserId] = useState('');
  const [rows, setRows] = useState<EntitlementRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // Simulador
  const [product, setProduct] = useState<string>(PRODUCT_CHOICES[0]?.id ?? 'premium_monthly');
  const [eventId, setEventId] = useState<string>(EVENT_CATALOGUE[0]?.id ?? 'purchase');
  const [reason, setReason] = useState('');
  const [targetUserId, setTargetUserId] = useState('');

  // Grant
  const [grantExpiry, setGrantExpiry] = useState('');

  const load = useCallback(async (target: string | null) => {
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const data = await admin_console.listEntitlements(target);
      setRows(data.entitlements);
    } catch (err) {
      setRows(null);
      setError(err instanceof Error ? err.message : 'No se pudo listar.');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load(null);
  }, [load]);

  const runSim = useCallback(async () => {
    if (!userId) return;
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const ev = eventById(eventId);
      await admin_console.simLifecycle({
        userId,
        product,
        event: eventId,
        reason: reason.trim(),
        targetUserId: eventId === 'transfer' ? targetUserId || null : null,
      });
      setOk(`Evento "${ev?.label ?? eventId}" aplicado a ${shortName(userId)}.`);
      await load(userId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'El evento no se pudo ejecutar.');
    } finally {
      setBusy(false);
    }
  }, [userId, product, eventId, reason, targetUserId, load]);

  const grant = useCallback(async () => {
    if (!userId) return;
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const expiresAt = grantExpiry ? new Date(grantExpiry).toISOString() : null;
      await admin_console.grantEntitlement(userId, 'premium', expiresAt, reason.trim());
      setOk(`Entitlement premium otorgado a ${shortName(userId)}.`);
      await load(userId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo otorgar.');
    } finally {
      setBusy(false);
    }
  }, [userId, grantExpiry, reason, load]);

  const revoke = useCallback(async () => {
    if (!userId) return;
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      await admin_console.revokeEntitlement(userId, 'premium', reason.trim());
      setOk(`Entitlement premium revocado a ${shortName(userId)}.`);
      await load(userId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo revocar.');
    } finally {
      setBusy(false);
    }
  }, [userId, reason, load]);

  const selectedEvent = eventById(eventId);

  return (
    <div>
      <div className="card">
        <div className="section-title">
          <h2>Entitlements</h2>
          <div className="row">
            <input
              className="input grow"
              placeholder="user_id (vacío = ver todos)"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
            />
            <button className="btn" onClick={() => void load(userId || null)} disabled={busy}>
              Buscar
            </button>
          </div>
        </div>

        {error && <div className="error">{error}</div>}
        {ok && <div className="ok">{ok}</div>}

        <table className="table">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Clave</th>
              <th>Vence</th>
              <th>Store</th>
              <th>Datos</th>
            </tr>
          </thead>
          <tbody>
            {rows === null && (
              <tr>
                <td colSpan={5} className="empty">
                  Cargando…
                </td>
              </tr>
            )}
            {rows?.length === 0 && (
              <tr>
                <td colSpan={5} className="empty">
                  Sin entitlements para este criterio.
                </td>
              </tr>
            )}
            {rows?.map((r) => {
              const active = r.expires_at !== null && new Date(r.expires_at) > new Date();
              const isSim = r.is_simulation === true || r.source === 'simulation';
              return (
                <tr key={`${r.user_id}:${r.key}`}>
                  <td className="mono">{shortName(r.user_id)}</td>
                  <td>{r.key}</td>
                  <td>
                    <span className={`badge ${active ? 'active' : 'expired'}`}>
                      {active ? 'activo' : 'vencido'}
                    </span>{' '}
                    <span className="mono">
                      {r.expires_at ? new Date(r.expires_at).toLocaleString() : '—'}
                    </span>
                  </td>
                  <td>{r.store ? <span className="mono">{r.store}</span> : '—'}</td>
                  <td>
                    {isSim && <span className="badge sim">simulado</span>}{' '}
                    {r.source && r.source !== 'simulation' && (
                      <span className="badge direct">{r.source}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {isDirector && (
        <>
          <div className="card">
            <h2>Simulador del ciclo de vida</h2>
            <div className="grid-2">
              <div>
                <label className="label">Producto</label>
                <select
                  className="select"
                  value={product}
                  onChange={(e) => setProduct(e.target.value)}
                >
                  {PRODUCT_CHOICES.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>

                <label className="label">Evento</label>
                <select
                  className="select"
                  value={eventId}
                  onChange={(e) => setEventId(e.target.value)}
                >
                  {EVENT_CATALOGUE.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.label}
                    </option>
                  ))}
                </select>
                {selectedEvent && (
                  <p className="empty" style={{ textAlign: 'left' }}>
                    {selectedEvent.hint}
                  </p>
                )}
              </div>
              <div>
                <label className="label">user_id destino</label>
                <input
                  className="input mono"
                  placeholder={
                    eventId === 'transfer' ? 'user_id del destinatario' : 'id del usuario a operar'
                  }
                  value={eventId === 'transfer' ? targetUserId : userId}
                  onChange={(e) =>
                    (eventId === 'transfer' ? setTargetUserId : setUserId)(e.target.value)
                  }
                />
                <label className="label">Motivo (se audita)</label>
                <input
                  className="input"
                  placeholder="ej: prueba del flujo free→premium"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
                <div className="row" style={{ marginTop: 12 }}>
                  <button className="btn primary" onClick={() => void runSim()} disabled={busy}>
                    Ejecutar evento
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <h2>Otorgar / revocar manualmente</h2>
            <div className="row">
              <div className="grow">
                <label className="label">Vencimiento (opcional)</label>
                <input
                  type="datetime-local"
                  className="input"
                  value={grantExpiry}
                  onChange={(e) => setGrantExpiry(e.target.value)}
                />
              </div>
              <button className="btn" onClick={() => void grant()} disabled={busy || !userId}>
                Otorgar premium
              </button>
              <button
                className="btn danger"
                onClick={() => void revoke()}
                disabled={busy || !userId}
              >
                Revocar premium
              </button>
            </div>
            <p className="empty" style={{ textAlign: 'left' }}>
              Nota: estos controles operan sobre <code>user_id</code> de la columna de arriba. Para
              un otorgamiento directo sin fecha, dejal el vencimiento vacío.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

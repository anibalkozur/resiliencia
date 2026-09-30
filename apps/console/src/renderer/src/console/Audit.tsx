import { useCallback, useEffect, useState } from 'react';
import { admin_console } from '../lib/adminApi';
import type { AuditEntry } from '../lib/types';

export function AuditView() {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const data = await admin_console.listAudit();
      setEntries(data.entries);
    } catch (err) {
      setEntries(null);
      setError(err instanceof Error ? err.message : 'No se pudo leer la auditoría.');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="card">
      <div className="section-title">
        <h2>Auditoría (últimas 100 acciones)</h2>
        <button className="btn" onClick={() => void load()} disabled={busy}>
          Refrescar
        </button>
      </div>
      {error && <div className="error">{error}</div>}
      {entries === null && <p className="empty">Cargando…</p>}
      {entries?.length === 0 && <p className="empty">Sin acciones registradas.</p>}
      <table className="table">
        <thead>
          <tr>
            <th>Cuando</th>
            <th>Admin</th>
            <th>Acción</th>
            <th>Target</th>
            <th>Motivo</th>
            <th>Payload</th>
          </tr>
        </thead>
        <tbody>
          {entries?.map((e) => (
            <tr key={e.id}>
              <td className="mono">{new Date(e.created_at).toLocaleString()}</td>
              <td className="mono">{e.admin_user_id.slice(0, 8)}…</td>
              <td>
                <span className="chip">{e.action}</span>
              </td>
              <td className="mono">{e.target_user_id ? e.target_user_id.slice(0, 8) : '—'}</td>
              <td>{e.reason ?? '—'}</td>
              <td className="mono" style={{ wordBreak: 'break-all', fontSize: 11 }}>
                {e.payload ? JSON.stringify(e.payload) : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { admin_console } from '../lib/adminApi';
import type { FlagRow } from '../lib/types';

type Props = {
  role: string | null;
};

export function ConfigView({ role }: Props) {
  const isDirector = role === 'director';

  const [flags, setFlags] = useState<FlagRow[] | null>(null);
  const [configCount, setConfigCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const data = await admin_console.listConfig();
      setFlags(data.flags);
      setConfigCount(data.config.length);
    } catch (err) {
      setFlags(null);
      setError(err instanceof Error ? err.message : 'No se pudieron leer config y flags.');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = useCallback(
    async (key: string, enabled: boolean) => {
      setBusy(true);
      setError(null);
      setOk(null);
      const reason =
        window.prompt?.(`Motivo para ${enabled ? 'habilitar' : 'deshabilitar'} "${key}":`) ?? '';
      try {
        await admin_console.setFlag(key, enabled, reason);
        setOk(`Flag "${key}" ${enabled ? 'habilitado' : 'deshabilitado'} (auditado).`);
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo cambiar el flag.');
      } finally {
        setBusy(false);
      }
    },
    [load],
  );

  return (
    <div className="grid-2">
      <div className="card">
        <div className="section-title">
          <h2>Feature flags</h2>
          <button className="btn" onClick={() => void load()} disabled={busy}>
            Refrescar
          </button>
        </div>
        {error && <div className="error">{error}</div>}
        {ok && <div className="ok">{ok}</div>}
        {flags === null && <p className="empty">Cargando…</p>}
        {flags && flags.length === 0 && <p className="empty">No hay flags definidos.</p>}
        <table className="table">
          <thead>
            <tr>
              <th>Flag</th>
              <th>Estado</th>
              <th>Actualizado</th>
              {isDirector && <th></th>}
            </tr>
          </thead>
          <tbody>
            {flags?.map((f) => (
              <tr key={f.key}>
                <td className="mono">{f.key}</td>
                <td>
                  <span className={`badge ${f.enabled ? 'active' : 'expired'}`}>
                    {f.enabled ? 'ON' : 'OFF'}
                  </span>
                </td>
                <td className="mono">
                  {f.updated_at ? new Date(f.updated_at).toLocaleString() : '—'}
                </td>
                {isDirector && (
                  <td>
                    <button
                      className="btn"
                      disabled={busy}
                      onClick={() => void toggle(f.key, !f.enabled)}
                    >
                      {f.enabled ? 'Apagar' : 'Encender'}
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {!isDirector && (
          <p className="empty">Tu rol permite leer; solo el director puede modificar flags.</p>
        )}
      </div>

      <div className="card">
        <h2>Configuración (app_config)</h2>
        {configCount === null ? (
          <p className="empty">Cargando…</p>
        ) : (
          <p>
            <strong>{configCount}</strong> claves de configuración. La edición de catálogo y
            FEATURE_DATE llega en la Fase C.
          </p>
        )}
      </div>
    </div>
  );
}

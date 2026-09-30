import type { Session } from '@supabase/supabase-js';
import type { AdminRole } from '../lib/types';

type Props = {
  role: AdminRole | null;
  session: Session;
};

const ROLE_DESC: Record<AdminRole, string> = {
  director: 'Acceso completo, incluida la administración de suscripciones y el simulador.',
  support: 'Puede leer y auditar, sin tocar configuración ni suscripciones.',
  analyst: 'Solo lectura (también ve la auditoría).',
};

export function DashboardView({ role, session }: Props) {
  const isDirector = role === 'director';
  const uid = session.user.id;

  return (
    <div>
      <div className="card">
        <div className="section-title">
          <h2>Tu rol</h2>
        </div>
        {role ? (
          <>
            <p>
              <strong>{role.toUpperCase()}</strong> — {ROLE_DESC[role]}
            </p>
            <p className="mono">user_id: {uid}</p>
          </>
        ) : (
          <p className="empty">
            No pudimos confirmar tu rol de administrador (chequeá la allowlist).
          </p>
        )}
      </div>

      <div className="grid-2">
        <div className="card">
          <h2>Simulador de ciclo premium</h2>
          <p>
            En la pestaña <em>Suscripciones &amp; Simulador</em> podés recorrer el ciclo completo de
            un usuario: compra, trial (7 días, solo anual), renovación, cancelación, vencimiento,
            reembolso y problemas de cobro — todo auditado.
          </p>
          {!isDirector && (
            <p className="empty">Tu rol no habilita simular u otorgar entitlements.</p>
          )}
        </div>
        <div className="card">
          <h2>Seguridad</h2>
          <p>
            Esta app habla con la Edge Function <code className="mono">admin_console</code> con tu
            JWT de Supabase; la service_role jamás entra a esta app. Cada acción que toca dinero o
            configuración queda en <code className="mono">admin_audit_log</code>.
          </p>
        </div>
      </div>
    </div>
  );
}

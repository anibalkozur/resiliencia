import { useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { AdminRole } from '../lib/types';
import { DashboardView } from './Dashboard';
import { EntitlementsView } from './Entitlements';
import { ConfigView } from './Config';
import { AuditView } from './Audit';
import { CopilotView } from './Copilot';

type Props = {
  session: Session;
  role: AdminRole | null;
  onSignOut: () => Promise<void>;
};

type TabId = 'dashboard' | 'entitlements' | 'config' | 'audit' | 'copilot';

const ROLE_LABEL: Record<AdminRole, string> = {
  director: 'Director',
  support: 'Soporte',
  analyst: 'Analista',
};

export function ConsoleShell({ session, role, onSignOut }: Props) {
  const [tab, setTab] = useState<TabId>('dashboard');

  const tabs: Array<{ id: TabId; label: string }> = [
    { id: 'dashboard', label: 'Inicio' },
    { id: 'entitlements', label: 'Suscripciones & Simulador' },
    { id: 'config', label: 'Config & Flags' },
    { id: 'audit', label: 'Auditoría' },
    { id: 'copilot', label: 'Copilot IA' },
  ];

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <h1>ResiliencIA</h1>
          <span>Console</span>
        </div>

        <nav className="tabs">
          {tabs.map((t) => (
            <button
              key={t.id}
              className={`tab${tab === t.id ? ' active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <span className="mono">{session.user.email ?? session.user.id}</span>
        {role && <span className={`chip ${role}`}>{ROLE_LABEL[role]}</span>}
        <button className="btn" onClick={() => void onSignOut()} title="Cerrar sesión">
          Salir
        </button>
      </header>

      <main className="content">
        {tab === 'dashboard' && <DashboardView role={role} session={session} />}
        {tab === 'entitlements' && <EntitlementsView role={role} />}
        {tab === 'config' && <ConfigView role={role} />}
        {tab === 'audit' && <AuditView />}
        {tab === 'copilot' && <CopilotView />}
      </main>
    </div>
  );
}

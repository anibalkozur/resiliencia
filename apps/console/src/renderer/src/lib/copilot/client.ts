// Fachada del Copilot en el renderer: envuelve el puente (window.consoleCopilot)
// y arma el contexto de cada turno vía el patrón ContextBuilder (por código,
// nunca por la IA, y solo con los campos permitidos del contrato admin).
import { admin_console } from '../adminApi';

export const copilotBridge = window.consoleCopilot;

type DirectorContext = {
  rol: string | null;
  admin: string | null;
  fecha: string;
  suscripciones: {
    activas: number;
    vencidas: number;
    simuladas: number;
    directas: number;
  } | null;
  flags: Array<{ key: string; enabled: boolean }>;
  config: Array<{ key: string; value: unknown }>;
  audiencia_reciente: string[];
  acciones_disponibles: string[];
};

/**
 * Arma el bloque de contexto compacto del turno. Si algo falla (sin red, sin
 * permisos) devuelve un JSON con lo que sí se pudo leer; nunca rompe el chat.
 */
export async function buildContextBlock(): Promise<string> {
  const ctx: DirectorContext = {
    rol: null,
    admin: null,
    fecha: new Date().toISOString(),
    suscripciones: null,
    flags: [],
    config: [],
    audiencia_reciente: [],
    acciones_disponibles: [
      'grant_entitlement',
      'revoke_entitlement',
      'sim_lifecycle',
      'set_config',
      'set_flag',
    ],
  };

  try {
    const [whoami, listConfig] = await Promise.all([
      admin_console.whoami(),
      admin_console.listConfig(),
    ]);
    ctx.rol = whoami.role;
    ctx.flags = listConfig.flags ?? [];
    ctx.config = (listConfig.config ?? [])
      .slice(0, 20)
      .map((c) => ({ key: c.key, value: c.value }));

    try {
      const users = await admin_console.listEntitlements(null);
      const rows = users.entitlements ?? [];
      ctx.suscripciones = {
        activas: rows.filter((e) => !e.is_simulation && e.expires_at && e.expires_at > ctx.fecha)
          .length,
        vencidas: rows.filter((e) => !e.is_simulation && e.expires_at && e.expires_at <= ctx.fecha)
          .length,
        simuladas: rows.filter((e) => e.is_simulation || e.source === 'simulation').length,
        directas: rows.filter((e) => e.source === 'direct' || e.source === 'manual').length,
      };
    } catch {
      ctx.suscripciones = null;
    }

    try {
      const audit = await admin_console.listAudit();
      ctx.audiencia_reciente = (audit.entries ?? [])
        .slice(0, 5)
        .map((e) => `${e.action}${e.reason ? ` (${e.reason})` : ''}`);
    } catch {
      ctx.audiencia_reciente = [];
    }
  } catch {
    ctx.flags = [];
    ctx.config = [];
  }

  return JSON.stringify(ctx, null, 0);
}

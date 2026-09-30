// Tipos del contrato con la Edge Function `admin_console` (versión desplegada).
export type AdminRole = 'director' | 'support' | 'analyst';

export type WhoamiResponse = {
  userId: string;
  role: AdminRole;
};

export type ConfigRow = {
  key: string;
  value: unknown;
  updated_at: string | null;
};

export type FlagRow = {
  key: string;
  enabled: boolean;
  updated_at: string | null;
};

export type ListConfigResponse = {
  config: ConfigRow[];
  flags: FlagRow[];
};

export type EntitlementRow = {
  user_id: string;
  key: string;
  store: string | null;
  expires_at: string | null;
  is_simulation: boolean | null;
  source: string | null;
  updated_at: string | null;
};

export type ListEntitlementsResponse = {
  entitlements: EntitlementRow[];
};

export type AuditEntry = {
  id: number;
  admin_user_id: string;
  action: string;
  target_user_id: string | null;
  payload: Record<string, unknown> | null;
  reason: string | null;
  created_at: string;
};

export type ListAuditResponse = {
  entries: AuditEntry[];
};

// Respuesta de los RPC de escritura (grant/revoke/sim) — devuelven lo que el RPC
// retorne (normalmente el entitlement/row afectado).
export type WriteResultResponse = Record<string, unknown>;

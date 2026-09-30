// Fachada tipada sobre callAdmin: una función por acción de la Edge Function,
// con sus payloads y respuestas verificados contra el contrato de tipos.
import { callAdmin } from './api';
import type {
  ListAuditResponse,
  ListConfigResponse,
  ListEntitlementsResponse,
  WhoamiResponse,
  WriteResultResponse,
} from './types';

export const admin_console = {
  whoami: () => callAdmin<WhoamiResponse>('whoami'),

  listConfig: () => callAdmin<ListConfigResponse>('list_config'),

  listAudit: () => callAdmin<ListAuditResponse>('list_audit'),

  listEntitlements: (userId: string | null) =>
    callAdmin<ListEntitlementsResponse>('list_entitlements', userId ? { userId } : {}),

  setConfig: (key: string, value: unknown, reason: string) =>
    callAdmin<WriteResultResponse>('set_config', { key, value, reason }),

  setFlag: (key: string, enabled: boolean, reason: string) =>
    callAdmin<WriteResultResponse>('set_flag', { key, enabled, reason }),

  grantEntitlement: (userId: string, key: string, expiresAt: string | null, reason: string) =>
    callAdmin<WriteResultResponse>('grant_entitlement', {
      userId,
      key,
      expiresAt: expiresAt ?? null,
      reason,
    }),

  revokeEntitlement: (userId: string, key: string, reason: string) =>
    callAdmin<WriteResultResponse>('revoke_entitlement', { userId, key, reason }),

  simLifecycle: (input: {
    userId: string;
    product: string;
    event: string;
    reason: string;
    targetUserId?: string | null;
  }) =>
    callAdmin<WriteResultResponse>('sim_lifecycle', {
      userId: input.userId,
      product: input.product,
      event: input.event,
      reason: input.reason,
      targetUserId: input.targetUserId ?? null,
    }),
};

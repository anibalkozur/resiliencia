// ResiliencIA — Edge Function `admin_console` (Fase A, docs/equipo/console_spec.md)
//
// Base segura de la Console de administración. Todas las acciones pasan por acá:
//  1) autentica el caller (JWT Supabase),
//  2) verifica que está en la allowlist `admin_users` (si no -> 403),
//  3) ejecuta con `service_role` SERVER-SIDE (la service_role nunca sale de acá),
//  4) audita la acción.
//
// Garantía de auditoría: las ESCRITURAS no se hacen con inserts sueltos. Van por
// las RPCs `admin_set_config` / `admin_set_flag` (migración 0017), que hacen la
// escritura y el registro en `admin_audit_log` dentro de la MISMA transacción:
// si el audit falla, la escritura revierte. Además esas RPCs vuelven a validar
// el rol contra `admin_users` dentro de la DB, así que un bug de autorización
// en esta función no alcanza para saltarse el control.
//
// Las LECTURAS se auditan best-effort (si falla el insert del audit, la lectura
// igual ocurrió; se registra el error en el log de la función).
//
// Fase A expone solo lecturas simples + escrituras de config/flags (auditadas).
// La gestión de entitlements (grant/revoke/simulador) es Fase B.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.116.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

type AdminRole = 'director' | 'support' | 'analyst';

// Permisos por rol [SEC]. Los no-admin nunca llegan acá (403 antes del switch).
// 'analyst' = solo lectura; 'support' lee y audita pero no escribe config;
// 'director' escribe.
const PERMISSIONS: Record<AdminRole, readonly string[]> = {
  analyst: ['whoami', 'list_config'],
  support: ['whoami', 'list_config', 'list_audit'],
  director: ['whoami', 'list_config', 'list_audit', 'set_config', 'set_flag'],
};

const ROLES: readonly AdminRole[] = ['director', 'support', 'analyst'];

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isAdminRole(value: unknown): value is AdminRole {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

// Config/flag keys: solo caracteres seguros para clave de config (evita inyección
// de claves arbitrarias o path traversal en la consola). Mismo regex que valida
// el RPC en la DB.
const SAFE_KEY = /^[a-z0-9_.-]{1,64}$/i;

// Parseo ESTRICTO de booleanos. `Boolean("false")` es `true` en JS, lo que
// habilitaría un flag por accidente; acá solo se acepta boolean o los strings
// exactos "true"/"false" (case-insensitive). Cualquier otra cosa -> null (400).
function parseBool(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    if (v === 'true') return true;
    if (v === 'false') return false;
  }
  return null;
}

function parseReason(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  return v.length > 0 ? v.slice(0, 500) : null;
}

type Ctx = {
  admin: ReturnType<typeof createClient>;
  adminUserId: string;
  role: AdminRole;
};

// Auditoría best-effort: solo para LECTURAS. Las escrituras se auditan dentro de
// la transacción del RPC; si ese insert falla, la escritura ya revirtió.
async function auditRead(ctx: Ctx, action: string, payload: Record<string, unknown> = {}) {
  const { error } = await ctx.admin.from('admin_audit_log').insert({
    admin_user_id: ctx.adminUserId,
    action,
    payload,
  });
  if (error) console.error('admin_audit_log read-audit failed', error);
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return response({ error: 'method_not_allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const authorization = request.headers.get('Authorization');

  if (!supabaseUrl || !anonKey || !serviceRoleKey || !authorization?.startsWith('Bearer ')) {
    return response({ error: 'server_not_configured' }, 500);
  }

  // 1) Autenticar al caller con su JWT (no la service_role).
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return response({ error: 'unauthorized' }, 401);

  const callerId = userData.user.id;

  // 2) Verificar allowlist de admin (service_role, server-side).
  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { data: adminRow, error: adminError } = await admin
    .from('admin_users')
    .select('role')
    .eq('user_id', callerId)
    .maybeSingle();
  if (adminError) return response({ error: 'admin_lookup_failed' }, 500);
  if (!adminRow || !isAdminRole(adminRow.role)) {
    // NO es admin: 403 y NO se escribe nada. Fail-closed.
    return response({ error: 'not_admin' }, 403);
  }

  const ctx: Ctx = { admin, adminUserId: callerId, role: adminRow.role };

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return response({ error: 'invalid_json' }, 400);
  }

  const action = isRecord(body) ? String(body.action ?? '') : '';
  const payload = isRecord(body) && isRecord(body.payload) ? body.payload : {};

  if (!action) return response({ error: 'missing_action' }, 400);
  if (!PERMISSIONS[ctx.role].includes(action)) {
    return response({ error: 'forbidden_action', action }, 403);
  }

  switch (action) {
    case 'whoami':
      await auditRead(ctx, 'whoami');
      return response({ userId: ctx.adminUserId, role: ctx.role });

    case 'list_config': {
      const [config, flags] = await Promise.all([
        ctx.admin.from('app_config').select('key,value,updated_at').order('key'),
        ctx.admin.from('feature_flags').select('key,enabled,updated_at').order('key'),
      ]);
      if (config.error) return response({ error: 'config_read_failed' }, 500);
      if (flags.error) return response({ error: 'flags_read_failed' }, 500);
      await auditRead(ctx, 'list_config');
      return response({ config: config.data, flags: flags.data });
    }

    case 'list_audit': {
      const { data, error } = await ctx.admin
        .from('admin_audit_log')
        .select('id,admin_user_id,action,target_user_id,payload,reason,created_at')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) return response({ error: 'audit_read_failed' }, 500);
      await auditRead(ctx, 'list_audit');
      return response({ entries: data });
    }

    // --- escrituras: RPC transaccional + auditoría atómica (fail-closed) ---
    case 'set_config': {
      const key = String(payload.key ?? '');
      if (!SAFE_KEY.test(key)) return response({ error: 'invalid_key' }, 400);

      const { data, error } = await ctx.admin.rpc('admin_set_config', {
        p_admin: ctx.adminUserId,
        p_key: key,
        p_value: payload.value ?? null,
        p_reason: parseReason(payload.reason),
      });
      if (error) {
        // La transacción revirtió: NO se escribió nada sin auditar.
        console.error('admin_set_config failed', error);
        return response({ error: 'config_write_failed' }, 500);
      }
      return response(data);
    }

    case 'set_flag': {
      const key = String(payload.key ?? '');
      if (!SAFE_KEY.test(key)) return response({ error: 'invalid_key' }, 400);

      const enabled = parseBool(payload.enabled);
      if (enabled === null) {
        return response({ error: 'invalid_enabled', hint: 'se espera boolean' }, 400);
      }

      const { data, error } = await ctx.admin.rpc('admin_set_flag', {
        p_admin: ctx.adminUserId,
        p_key: key,
        p_enabled: enabled,
        p_reason: parseReason(payload.reason),
      });
      if (error) {
        console.error('admin_set_flag failed', error);
        return response({ error: 'flag_write_failed' }, 500);
      }
      return response(data);
    }

    default:
      return response({ error: 'unknown_action' }, 400);
  }
});

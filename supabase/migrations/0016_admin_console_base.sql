-- ResiliencIA — migración 0016: base segura de la Console de administración
-- (Fase A — ver docs/equipo/console_spec.md)
--
-- Objetivo: crear la base de la app admin de escritorio con las condiciones de
-- seguridad de [SEC] y [BE]:
--  - allowlist de admins (admin_users) cerrada al cliente;
--  - entitlements server-side (solo service_role escribe; el usuario solo lee
--    el suyo — plan v4 §9);
--  - auditoría de TODA acción admin (admin_audit_log);
--  - config/flags editables desde la consola pero de solo lectura para el cliente.
--
-- Principio (BE/SEC): el premium se decide en el servidor. Ningún cliente
-- escribe, actualiza ni revoca un entitlement. El acceso privilegiado pasa por
-- Edge Functions admin que validan el rol contra admin_users.

begin;

-- ---------------------------------------------------------------------------
-- admin_users: allowlist de administradores. Sin políticas RLS => el cliente
-- (anon/authenticated) no lee ni escribe; solo service_role (que bypasa RLS).
-- ---------------------------------------------------------------------------
create table if not exists public.admin_users (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  role        text not null check (role in ('director', 'support', 'analyst')),
  note        text,
  created_at  timestamptz not null default now()
);
alter table public.admin_users enable row level security;
-- (sin policies a propósito: acceso exclusivo de service_role)

-- ---------------------------------------------------------------------------
-- entitlements: estado de suscripción por usuario. Fuente de verdad del premium.
-- PK (user_id, key) para que haya como máximo un entitlement por tipo.
-- El usuario puede LEER el suyo (la app lo usa para desbloquear la UI), nunca
-- escribirlo. expires_at null = sin expiración.
-- ---------------------------------------------------------------------------
create table if not exists public.entitlements (
  user_id        uuid not null references auth.users (id) on delete cascade,
  key            text not null,
  store          text not null default 'simulation'
                  check (store in ('play', 'apple', 'simulation')),
  expires_at     timestamptz,
  is_simulation  boolean not null default true,
  source         text not null default 'admin',
  updated_at     timestamptz not null default now(),
  primary key (user_id, key)
);
alter table public.entitlements enable row level security;

-- El usuario solo lee su propio entitlement; ninguna escritura desde el cliente.
drop policy if exists entitlements_select_own on public.entitlements;
create policy entitlements_select_own on public.entitlements
  for select
  using (auth.uid() = user_id);

create index if not exists entitlements_user_idx on public.entitlements (user_id);

-- ---------------------------------------------------------------------------
-- admin_audit_log: bitácora de TODA acción privilegiada. Solo service_role
-- escribe y lee (la Console lo consulta a través de una Edge Function admin).
-- ---------------------------------------------------------------------------
create table if not exists public.admin_audit_log (
  id              bigserial primary key,
  admin_user_id   uuid references auth.users (id) on delete set null,
  action          text not null,
  target_user_id  uuid references auth.users (id) on delete set null,
  payload         jsonb,
  reason          text,
  created_at      timestamptz not null default now()
);
alter table public.admin_audit_log enable row level security;
-- (sin policies: acceso exclusivo de service_role)

create index if not exists admin_audit_log_admin_idx
  on public.admin_audit_log (admin_user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- app_config / feature_flags: editables desde la consola (service_role) y de
-- solo lectura para el cliente autenticado. Permiten cambiar FEATURE_DATE, pool
-- free, o apagar features sin redeploy.
-- ---------------------------------------------------------------------------
create table if not exists public.app_config (
  key         text primary key,
  value       jsonb,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users (id) on delete set null
);
alter table public.app_config enable row level security;
drop policy if exists app_config_select_authenticated on public.app_config;
create policy app_config_select_authenticated on public.app_config
  for select
  to authenticated
  using (true);

create table if not exists public.feature_flags (
  key         text primary key,
  enabled     boolean not null default false,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references auth.users (id) on delete set null
);
alter table public.feature_flags enable row level security;
drop policy if exists feature_flags_select_authenticated on public.feature_flags;
create policy feature_flags_select_authenticated on public.feature_flags
  for select
  to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- updated_at automático en las tablas editables desde la consola.
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists entitlements_touch on public.entitlements;
create trigger entitlements_touch before update on public.entitlements
  for each row execute function public.touch_updated_at();

drop trigger if exists app_config_touch on public.app_config;
create trigger app_config_touch before update on public.app_config
  for each row execute function public.touch_updated_at();

drop trigger if exists feature_flags_touch on public.feature_flags;
create trigger feature_flags_touch before update on public.feature_flags
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- has_active_entitlement: helper SECURITY DEFINER para lógica server-side
-- (lo usará el tierGate en Fase B). NO es público/accesible por el cliente:
-- se revoca a public/anon/authenticated para evitar que sea un oráculo
-- (plan v4 §9 / [SEC]). Solo service_role lo ejecuta.
-- ---------------------------------------------------------------------------
create or replace function public.has_active_entitlement(p_user uuid, p_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.entitlements e
    where e.user_id = p_user
      and e.key = p_key
      and (e.expires_at is null or e.expires_at > now())
  );
$$;

revoke all on function public.has_active_entitlement(uuid, text) from public;
revoke all on function public.has_active_entitlement(uuid, text) from anon;
revoke all on function public.has_active_entitlement(uuid, text) from authenticated;
grant execute on function public.has_active_entitlement(uuid, text) to service_role;

commit;

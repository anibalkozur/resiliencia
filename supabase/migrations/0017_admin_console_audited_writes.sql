-- ResiliencIA — migración 0017: escrituras auditadas atómicas para la Console
--
-- Por qué 0017 y no editar 0016: 0016 ya está aplicada en producción.
--
-- Problema que corrige: en la Edge Function `admin_console`, la escritura y el
-- insert en `admin_audit_log` eran dos llamadas independientes. Si fallaba el
-- audit, la escritura se devolvía como exitosa igual (fail-open), violando el
-- requisito de que TODA acción quede auditada.
--
-- Solución: RPCs SECURITY DEFINER que hacen la escritura y su auditoría dentro
-- de la MISMA transacción. Si el audit falla, la transacción entera revierte.
-- Además validan el rol contra `admin_users` dentro de la DB: si la Edge
-- Function tuviera un bug de autorización, la base igual rechaza la escritura
-- (defensa en profundidad, [SEC]).

begin;

-- ---------------------------------------------------------------------------
-- admin_assert_role: helpers de autorización server-side.
-- Devuelve el rol del admin o levanta una excepción si no es admin.
-- ---------------------------------------------------------------------------
create or replace function public.admin_assert_role(p_admin uuid, p_required text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  select role into v_role
  from public.admin_users
  where user_id = p_admin
    and role = p_required;

  if v_role is null then
    raise exception 'forbidden: admin % lacks role %', p_admin, p_required
      using errcode = '42501';
  end if;

  return v_role;
end;
$$;

revoke all on function public.admin_assert_role(uuid, text) from public;
revoke all on function public.admin_assert_role(uuid, text) from anon;
revoke all on function public.admin_assert_role(uuid, text) from authenticated;
grant execute on function public.admin_assert_role(uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- admin_set_config: upsert de app_config + auditoría, en una transacción.
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_config(
  p_admin   uuid,
  p_key     text,
  p_value   jsonb,
  p_reason  text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.admin_assert_role(p_admin, 'director');

  if p_key is null or p_key !~ '^[a-zA-Z0-9_.-]{1,64}$' then
    raise exception 'invalid key' using errcode = '22023';
  end if;

  insert into public.app_config (key, value, updated_by)
  values (p_key, p_value, p_admin)
  on conflict (key) do update
    set value      = excluded.value,
        updated_by = excluded.updated_by,
        updated_at = now();

  insert into public.admin_audit_log (admin_user_id, action, payload, reason)
  values (p_admin, 'set_config', jsonb_build_object('key', p_key, 'value', p_value), p_reason);

  return jsonb_build_object('ok', true, 'key', p_key);
end;
$$;

revoke all on function public.admin_set_config(uuid, text, jsonb, text) from public;
revoke all on function public.admin_set_config(uuid, text, jsonb, text) from anon;
revoke all on function public.admin_set_config(uuid, text, jsonb, text) from authenticated;
grant execute on function public.admin_set_config(uuid, text, jsonb, text) to service_role;

-- ---------------------------------------------------------------------------
-- admin_set_flag: upsert de feature_flags + auditoría, en una transacción.
-- `p_enabled` es boolean (no text): la Edge Function ya parsea estrictamente
-- para que "false" como string no se convierta en true.
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_flag(
  p_admin    uuid,
  p_key      text,
  p_enabled  boolean,
  p_reason   text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.admin_assert_role(p_admin, 'director');

  if p_key is null or p_key !~ '^[a-zA-Z0-9_.-]{1,64}$' then
    raise exception 'invalid key' using errcode = '22023';
  end if;

  insert into public.feature_flags (key, enabled, updated_by)
  values (p_key, coalesce(p_enabled, false), p_admin)
  on conflict (key) do update
    set enabled    = excluded.enabled,
        updated_by = excluded.updated_by,
        updated_at = now();

  insert into public.admin_audit_log (admin_user_id, action, payload, reason)
  values (p_admin, 'set_flag', jsonb_build_object('key', p_key, 'enabled', p_enabled), p_reason);

  return jsonb_build_object('ok', true, 'key', p_key, 'enabled', coalesce(p_enabled, false));
end;
$$;

revoke all on function public.admin_set_flag(uuid, text, boolean, text) from public;
revoke all on function public.admin_set_flag(uuid, text, boolean, text) from anon;
revoke all on function public.admin_set_flag(uuid, text, boolean, text) from authenticated;
grant execute on function public.admin_set_flag(uuid, text, boolean, text) to service_role;

commit;

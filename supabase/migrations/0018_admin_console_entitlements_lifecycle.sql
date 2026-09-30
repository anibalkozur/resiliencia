-- ResiliencIA — migración 0018: núcleo premium de la Console (Fase B)
--
-- Alcance (docs/equipo/console_spec.md, Fase B):
--  - tablas subscriptions / purchases (plan v4 §10) para el ciclo real+simulado;
--  - RPCs de gestión de entitlements (grant / revoke) auditadas y transaccionales;
--  - simulador de ciclo de vida completo (purchase, trial 7d solo anual, renew,
--    cancel, expire, refund, billing_issue, transfer, restore) que escribe las
--    mismas filas que luego escribirá el webhook real, marcadas
--    is_simulation=true y source='simulation'.
--
-- Reglas duras:
--  - Un solo camino de escritura de entitlements (RPCs service_role) [BE].
--  - Toda escritura audita + valida el rol del admin dentro de la DB [SEC].
--  - Lo simulado NUNCA cuenta como caja/MRR: los reportes separan real/simulado [FIN].
--  - El cliente solo lee su propio entitlement (RLS 0016); subscriptions/purchases
--    quedan cerradas al cliente (solo service_role / consola).

begin;

-- ---------------------------------------------------------------------------
-- subscriptions: estado de la suscripción (fuente para renovación/expiración).
-- Cerrada al cliente: solo service_role y la consola (vía Edge Functions admin).
-- ---------------------------------------------------------------------------
create table if not exists public.subscriptions (
  id                      bigserial primary key,
  user_id                 uuid not null references auth.users (id) on delete cascade,
  store                   text not null check (store in ('play', 'apple', 'simulation')),
  product_code            text not null check (product_code in ('premium_monthly', 'premium_annual')),
  status                  text not null default 'active' check (
                            status in ('active', 'in_grace_period', 'expired', 'cancelled', 'refunded', 'paused')
                          ),
  will_renew              boolean not null default true,
  original_transaction_id text not null,
  current_period_start    timestamptz,
  current_period_end      timestamptz,
  is_simulation           boolean not null default false,
  source                  text not null default 'admin',
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (user_id, product_code)
);
alter table public.subscriptions enable row level security;
-- (sin policies a propósito: solo service_role vía Edge Functions admin)

-- ---------------------------------------------------------------------------
-- purchases: log de eventos de compra/pago. `rc_event_id` único prepara la
-- integración con RevenueCat (F3): un mismo evento no se aplica dos veces.
-- ---------------------------------------------------------------------------
create table if not exists public.purchases (
  id              bigserial primary key,
  user_id         uuid not null references auth.users (id) on delete cascade,
  rc_event_id     text unique,
  product_code    text not null check (product_code in ('premium_monthly', 'premium_annual')),
  amount_cents    integer,
  currency        text,
  store           text not null check (store in ('play', 'apple', 'simulation')),
  event_type      text not null,
  is_simulation   boolean not null default false,
  source          text not null default 'admin',
  payload         jsonb,
  purchased_at    timestamptz not null default now()
);
alter table public.purchases enable row level security;
-- (sin policies: solo service_role vía Edge Functions admin)

create index if not exists subscriptions_user_idx on public.subscriptions (user_id);
create index if not exists purchases_user_idx on public.purchases (user_id);

drop trigger if exists subscriptions_touch on public.subscriptions;
create trigger subscriptions_touch before update on public.subscriptions
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- admin_grant_entitlement: otorga/actualiza un entitlement (p_expires_at null =
-- indefinido). Director-only, auditado y transaccional.
-- ---------------------------------------------------------------------------
create or replace function public.admin_grant_entitlement(
  p_admin       uuid,
  p_user        uuid,
  p_key         text,
  p_expires_at  timestamptz,
  p_reason      text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.admin_assert_role(p_admin, 'director');

  if p_key is null or p_key !~ '^[a-z0-9_-]{1,64}$' then
    raise exception 'invalid key' using errcode = '22023';
  end if;
  if p_user is null or not exists (select 1 from auth.users where id = p_user) then
    raise exception 'unknown user' using errcode = '22023';
  end if;

  insert into public.entitlements (user_id, key, store, expires_at, is_simulation, source)
  values (p_user, p_key, 'simulation', p_expires_at, false, 'admin')
  on conflict (user_id, key) do update
    set expires_at = excluded.expires_at,
        source     = excluded.source,
        updated_at = now();

  insert into public.admin_audit_log (admin_user_id, action, target_user_id, payload, reason)
  values (p_admin, 'grant_entitlement', p_user,
          jsonb_build_object('key', p_key, 'expires_at', p_expires_at), p_reason);

  return jsonb_build_object('ok', true, 'userId', p_user, 'key', p_key);
end;
$$;

revoke all on function public.admin_grant_entitlement(uuid, uuid, text, timestamptz, text) from public;
revoke all on function public.admin_grant_entitlement(uuid, uuid, text, timestamptz, text) from anon;
revoke all on function public.admin_grant_entitlement(uuid, uuid, text, timestamptz, text) from authenticated;
grant execute on function public.admin_grant_entitlement(uuid, uuid, text, timestamptz, text) to service_role;

-- ---------------------------------------------------------------------------
-- admin_revoke_entitlement: revoca (elimina la fila). Director-only, auditado.
-- ---------------------------------------------------------------------------
create or replace function public.admin_revoke_entitlement(
  p_admin   uuid,
  p_user    uuid,
  p_key     text,
  p_reason  text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.admin_assert_role(p_admin, 'director');

  if p_key is null or p_key !~ '^[a-z0-9_-]{1,64}$' then
    raise exception 'invalid key' using errcode = '22023';
  end if;
  if p_user is null or not exists (select 1 from auth.users where id = p_user) then
    raise exception 'unknown user' using errcode = '22023';
  end if;

  delete from public.entitlements where user_id = p_user and key = p_key;

  insert into public.admin_audit_log (admin_user_id, action, target_user_id, payload, reason)
  values (p_admin, 'revoke_entitlement', p_user, jsonb_build_object('key', p_key), p_reason);

  return jsonb_build_object('ok', true, 'userId', p_user, 'key', p_key);
end;
$$;

revoke all on function public.admin_revoke_entitlement(uuid, uuid, text, text) from public;
revoke all on function public.admin_revoke_entitlement(uuid, uuid, text, text) from anon;
revoke all on function public.admin_revoke_entitlement(uuid, uuid, text, text) from authenticated;
grant execute on function public.admin_revoke_entitlement(uuid, uuid, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- admin_sim_lifecycle: simulador del ciclo de vida de la suscripción.
-- Escribe las mismas filas que escribirá el webhook real (F3), con
-- is_simulation=true y source='simulation'. Nunca cuenta como caja [FIN].
--
-- Eventos:
--   purchase        -> subscription active + entitlement ahora+30d/365d
--   trial_start     -> SOLO annual, 7 días (decisión D-B)
--   renew           -> extiende desde max(now, period_end)
--   cancel          -> will_renew=false; acceso hasta expiración (no revoca)
--   expire          -> subscription expired + entitlement vence ahora
--   refund          -> subscription refunded + entitlement vence ahora
--   billing_issue   -> gracia: no revoca
--   transfer        -> mueve subscription+entitlement al p_target_user
--   restore         -> re-materializa entitlement desde la subscription activa
-- ---------------------------------------------------------------------------
create or replace function public.admin_sim_lifecycle(
  p_admin         uuid,
  p_user          uuid,
  p_product       text,
  p_event         text,
  p_reason        text default null,
  p_target_user   uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product  text := lower(trim(p_product));
  v_event    text := lower(trim(p_event));
  v_duration interval;
  v_period_end timestamptz;
  v_src_expiry timestamptz;
begin
  perform public.admin_assert_role(p_admin, 'director');

  if v_product not in ('premium_monthly', 'premium_annual') then
    raise exception 'invalid product' using errcode = '22023';
  end if;
  if v_event not in
    ('purchase', 'trial_start', 'renew', 'cancel', 'expire', 'refund', 'billing_issue', 'transfer', 'restore')
  then
    raise exception 'invalid event' using errcode = '22023';
  end if;
  if p_user is null or not exists (select 1 from auth.users where id = p_user) then
    raise exception 'unknown user' using errcode = '22023';
  end if;

  v_duration := case when v_product = 'premium_annual' then interval '365 days'
                     else interval '30 days' end;

  case v_event
    when 'purchase' then
      insert into public.purchases (user_id, rc_event_id, product_code, store, event_type, is_simulation, source)
      values (p_user, gen_random_uuid()::text, v_product, 'simulation', 'purchase', true, 'simulation');

      insert into public.subscriptions
        (user_id, store, product_code, status, will_renew, original_transaction_id,
         current_period_start, current_period_end, is_simulation, source)
      values (p_user, 'simulation', v_product, 'active', true,
              'sim-' || p_user::text || '-' || v_product, now(), now() + v_duration, true, 'simulation')
      on conflict (user_id, product_code) do update
        set status = 'active', will_renew = true,
            current_period_start = now(), current_period_end = now() + v_duration,
            source = 'simulation', is_simulation = true, updated_at = now();

      insert into public.entitlements (user_id, key, store, expires_at, is_simulation, source)
      values (p_user, 'premium', 'simulation', now() + v_duration, true, 'simulation')
      on conflict (user_id, key) do update
        set store = 'simulation', expires_at = now() + v_duration,
            is_simulation = true, source = 'simulation', updated_at = now();

    when 'trial_start' then
      if v_product = 'premium_monthly' then
        raise exception 'trial only on annual' using errcode = '22023';
      end if;

      insert into public.purchases (user_id, rc_event_id, product_code, store, event_type, is_simulation, source)
      values (p_user, gen_random_uuid()::text, v_product, 'simulation', 'trial_started', true, 'simulation');

      insert into public.subscriptions
        (user_id, store, product_code, status, will_renew, original_transaction_id,
         current_period_start, current_period_end, is_simulation, source)
      values (p_user, 'simulation', v_product, 'active', true,
              'sim-' || p_user::text || '-' || v_product, now(), now() + interval '7 days', true, 'simulation')
      on conflict (user_id, product_code) do update
        set status = 'active', will_renew = true,
            current_period_start = now(), current_period_end = now() + interval '7 days',
            source = 'simulation', is_simulation = true, updated_at = now();

      insert into public.entitlements (user_id, key, store, expires_at, is_simulation, source)
      values (p_user, 'premium', 'simulation', now() + interval '7 days', true, 'simulation')
      on conflict (user_id, key) do update
        set store = 'simulation', expires_at = now() + interval '7 days',
            is_simulation = true, source = 'simulation', updated_at = now();

    when 'renew' then
      select coalesce(current_period_end, now())
      into v_period_end from public.subscriptions
      where user_id = p_user and product_code = v_product;

      v_period_end := greatest(v_period_end, now()) + v_duration;

      insert into public.purchases (user_id, rc_event_id, product_code, store, event_type, is_simulation, source)
      values (p_user, gen_random_uuid()::text, v_product, 'simulation', 'renewal', true, 'simulation');

      insert into public.subscriptions
        (user_id, store, product_code, status, will_renew, original_transaction_id,
         current_period_start, current_period_end, is_simulation, source)
      values (p_user, 'simulation', v_product, 'active', true,
              'sim-' || p_user::text || '-' || v_product, now(), v_period_end, true, 'simulation')
      on conflict (user_id, product_code) do update
        set status = 'active', will_renew = true,
            current_period_end = v_period_end, source = 'simulation',
            is_simulation = true, updated_at = now();

      insert into public.entitlements (user_id, key, store, expires_at, is_simulation, source)
      values (p_user, 'premium', 'simulation', v_period_end, true, 'simulation')
      on conflict (user_id, key) do update
        set store = 'simulation', expires_at = v_period_end,
            is_simulation = true, source = 'simulation', updated_at = now();

    when 'cancel' then
      insert into public.purchases (user_id, rc_event_id, product_code, store, event_type, is_simulation, source)
      values (p_user, gen_random_uuid()::text, v_product, 'simulation', 'cancellation', true, 'simulation');

      insert into public.subscriptions
        (user_id, store, product_code, status, will_renew, original_transaction_id,
         current_period_start, current_period_end, is_simulation, source)
      values (p_user, 'simulation', v_product, 'active', false,
              'sim-' || p_user::text || '-' || v_product, now(), now() + v_duration, true, 'simulation')
      on conflict (user_id, product_code) do update
        set will_renew = false, source = 'simulation', is_simulation = true, updated_at = now();
      -- entitlement SIN cambios: el acceso se conserva hasta la expiración.

    when 'expire' then
      insert into public.purchases (user_id, rc_event_id, product_code, store, event_type, is_simulation, source)
      values (p_user, gen_random_uuid()::text, v_product, 'simulation', 'expiration', true, 'simulation');

      insert into public.subscriptions
        (user_id, store, product_code, status, will_renew, original_transaction_id,
         current_period_start, current_period_end, is_simulation, source)
      values (p_user, 'simulation', v_product, 'expired', false,
              'sim-' || p_user::text || '-' || v_product, now(), now(), true, 'simulation')
      on conflict (user_id, product_code) do update
        set status = 'expired', will_renew = false, current_period_end = now(),
            source = 'simulation', is_simulation = true, updated_at = now();

      update public.entitlements
      set expires_at = now(), is_simulation = true, source = 'simulation', updated_at = now()
      where user_id = p_user and key = 'premium';

    when 'refund' then
      insert into public.purchases (user_id, rc_event_id, product_code, store, event_type, is_simulation, source)
      values (p_user, gen_random_uuid()::text, v_product, 'simulation', 'refund', true, 'simulation');

      insert into public.subscriptions
        (user_id, store, product_code, status, will_renew, original_transaction_id,
         current_period_start, current_period_end, is_simulation, source)
      values (p_user, 'simulation', v_product, 'refunded', false,
              'sim-' || p_user::text || '-' || v_product, now(), now(), true, 'simulation')
      on conflict (user_id, product_code) do update
        set status = 'refunded', will_renew = false, current_period_end = now(),
            source = 'simulation', is_simulation = true, updated_at = now();

      update public.entitlements
      set expires_at = now(), is_simulation = true, source = 'simulation', updated_at = now()
      where user_id = p_user and key = 'premium';

    when 'billing_issue' then
      insert into public.purchases (user_id, rc_event_id, product_code, store, event_type, is_simulation, source)
      values (p_user, gen_random_uuid()::text, v_product, 'simulation', 'billing_issue', true, 'simulation');

      insert into public.subscriptions
        (user_id, store, product_code, status, will_renew, original_transaction_id,
         current_period_start, current_period_end, is_simulation, source)
      values (p_user, 'simulation', v_product, 'in_grace_period', false,
              'sim-' || p_user::text || '-' || v_product, now(), now() + v_duration, true, 'simulation')
      on conflict (user_id, product_code) do update
        set status = 'in_grace_period', source = 'simulation',
            is_simulation = true, updated_at = now();
      -- entitlement SIN cambios: gracia no revoca.

    when 'transfer' then
      if p_target_user is null then
        raise exception 'transfer requires target user' using errcode = '22023';
      end if;
      if not exists (select 1 from auth.users where id = p_target_user) then
        raise exception 'unknown target user' using errcode = '22023';
      end if;

      select expires_at into v_src_expiry
      from public.entitlements where user_id = p_user and key = 'premium';

      delete from public.subscriptions where user_id = p_user and product_code = v_product;
      delete from public.entitlements where user_id = p_user and key = 'premium';

      insert into public.purchases (user_id, rc_event_id, product_code, store, event_type, is_simulation, source, payload)
      values (p_user, gen_random_uuid()::text, v_product, 'simulation', 'transfer', true, 'simulation',
              jsonb_build_object('from', p_user, 'to', p_target_user));

      insert into public.subscriptions
        (user_id, store, product_code, status, will_renew, original_transaction_id,
         current_period_start, current_period_end, is_simulation, source)
      values (p_target_user, 'simulation', v_product, 'active', true,
              'sim-' || p_target_user::text || '-' || v_product, now(), now() + v_duration, true, 'simulation');

      insert into public.entitlements (user_id, key, store, expires_at, is_simulation, source)
      values (p_target_user, 'premium', 'simulation', coalesce(v_src_expiry, now() + v_duration), true, 'simulation')
      on conflict (user_id, key) do update
        set expires_at = greatest(coalesce(public.entitlements.expires_at, now()),
                                  coalesce(v_src_expiry, now() + v_duration)),
            store = 'simulation', is_simulation = true, source = 'simulation', updated_at = now();

    when 'restore' then
      select current_period_end into v_period_end
      from public.subscriptions
      where user_id = p_user and product_code = v_product
        and status in ('active', 'in_grace_period')
        and current_period_end > now()
      order by current_period_end desc
      limit 1;

      if v_period_end is not null then
        insert into public.entitlements (user_id, key, store, expires_at, is_simulation, source)
        values (p_user, 'premium', 'simulation', v_period_end, true, 'simulation')
        on conflict (user_id, key) do update
          set expires_at = greatest(public.entitlements.expires_at, v_period_end),
              store = 'simulation', is_simulation = true, source = 'simulation', updated_at = now();
      end if;

      insert into public.purchases (user_id, rc_event_id, product_code, store, event_type, is_simulation, source)
      values (p_user, gen_random_uuid()::text, v_product, 'simulation', 'restore', true, 'simulation');
  end case;

  insert into public.admin_audit_log (admin_user_id, action, target_user_id, payload, reason)
  values (p_admin, 'sim_lifecycle:' || v_event, p_user,
          jsonb_build_object('product', v_product, 'userId', p_user, 'targetUserId', p_target_user),
          p_reason);

  return jsonb_build_object('ok', true, 'event', v_event, 'product', v_product, 'userId', p_user);
end;
$$;

revoke all on function public.admin_sim_lifecycle(uuid, uuid, text, text, text, uuid) from public;
revoke all on function public.admin_sim_lifecycle(uuid, uuid, text, text, text, uuid) from anon;
revoke all on function public.admin_sim_lifecycle(uuid, uuid, text, text, text, uuid) from authenticated;
grant execute on function public.admin_sim_lifecycle(uuid, uuid, text, text, text, uuid) to service_role;

commit;
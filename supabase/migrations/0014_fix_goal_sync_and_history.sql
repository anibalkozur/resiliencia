-- ResiliencIA — migración 0014: fix del historial de objetivo y sincronización
-- del goal del usuario al servidor (hallazgos de la revisión F0).
--
-- Problemas que corrige:
--  1) profiles.goal quedaba NULL (handle_new_user no lo setea y la app solo
--     guardaba el goal en prefs locales) -> la Edge Function rechazaba TODO
--     reto con challenge_mismatch porque no había goal server-side.
--  2) El trigger maintain_goal_history cerraba la fila abierta con
--     valid_until = current_date - 1; si la fila se abrió hoy, quedaba
--     valid_until < valid_from (viola el CHECK) y el UPDATE de profiles.goal
--     fallaba.
--  3) No existía historial para los usuarios ya creados.

begin;

-- ---------------------------------------------------------------------------
-- handle_new_user: setear goal por defecto en la creación del perfil para que
-- profiles.goal nunca quede NULL a partir de ahora.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_goal text;
begin
  v_goal := new.raw_user_meta_data ->> 'goal';
  if v_goal is null or v_goal not in ('perder_grasa', 'ganar_musculo', 'mantener') then
    v_goal := 'mantener';
  end if;
  insert into public.profiles (user_id, nickname, language, goal)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'nickname'), ''), 'atleta'),
    coalesce(new.raw_user_meta_data ->> 'language', 'es'),
    v_goal
  );
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- maintain_goal_history corregido:
--  - Si el cambio es sobre una fila abierta del MISMO día, se actualiza su
--    goal en lugar de cerrarla (evita valid_until < valid_from).
--  - Las filas abiertas de días ANTERIORES se cierran con current_date - 1.
--  - Solo se abre una fila nueva si no quedó una abierta para hoy.
-- ---------------------------------------------------------------------------
create or replace function public.maintain_goal_history()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.goal is not null then
      insert into public.goal_history (user_id, goal, valid_from)
      values (new.user_id, new.goal, current_date);
    end if;
    return new;
  end if;

  -- UPDATE: solo reaccionar si el objetivo cambió.
  if new.goal is distinct from old.goal then
    -- Fila del día en curso: actualizar el goal, no cerrar.
    update public.goal_history
    set goal = new.goal
    where user_id = new.user_id
      and valid_until is null
      and valid_from = current_date;

    -- Filas abiertas de días anteriores: cerrar ayer.
    update public.goal_history
    set valid_until = current_date - 1
    where user_id = new.user_id
      and valid_until is null
      and valid_from < current_date;

    if new.goal is not null then
      insert into public.goal_history (user_id, goal, valid_from)
      select new.user_id, new.goal, current_date
      where not exists (
        select 1 from public.goal_history
        where user_id = new.user_id
          and valid_until is null
          and valid_from = current_date
      );
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_goal_history on public.profiles;
create trigger trg_profiles_goal_history
  after insert or update of goal on public.profiles
  for each row execute function public.maintain_goal_history();

-- ---------------------------------------------------------------------------
-- Backfill: usuarios existentes con goal NULL pasan a 'mantener' y obtienen
-- historial abierto para hoy (el trigger lo crea al actualizar).
-- ---------------------------------------------------------------------------
update public.profiles
set goal = 'mantener'
where goal is null;

-- Cobertura extra: cualquier perfil sin fila abierta en goal_history recibe
-- una (por robustez, aunque el trigger ya debería haberla creado).
insert into public.goal_history (user_id, goal, valid_from)
select p.user_id, p.goal, current_date
from public.profiles p
where p.goal is not null
  and not exists (
    select 1 from public.goal_history gh
    where gh.user_id = p.user_id and gh.valid_until is null
  );

-- ---------------------------------------------------------------------------
-- set_goal: RPC seguro para que la app sincronice su objetivo (prefs) con el
-- servidor. El trigger mantiene el historial. Solo el dueño de la fila.
-- ---------------------------------------------------------------------------
create or replace function public.set_goal(p_goal text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_goal not in ('perder_grasa', 'ganar_musculo', 'mantener') then
    raise exception 'invalid_goal';
  end if;
  update public.profiles
  set goal = p_goal
  where user_id = auth.uid();
end;
$$;

revoke all on function public.set_goal(text) from public;
revoke all on function public.set_goal(text) from anon;
grant execute on function public.set_goal(text) to authenticated;

commit;
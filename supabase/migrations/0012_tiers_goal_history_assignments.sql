-- ResiliencIA — migración 0012: tiers de ejercicios + historial de objetivo +
-- asignaciones diarias server-side (PLAN v4 / F0)
--
-- Decisiones (sesión 2026-09-28, registro en docs/BITACORA.md):
--  D-A  Reto libre rotando entre 3 ejercicios gratuitos; rachas para todos.
--  F0   Autoridad del reto: goal_history + daily_challenge_assignments.
--       FEATURE_DATE = '2026-09-28': antes la rotación usaba 7 ejercicios por
--       objetivo; desde esa fecha rota solo dentro del pool FREE.
--
-- Fail-closed: cualquier ejercicio sin tier explícito queda 'premium'.

begin;

-- ---------------------------------------------------------------------------
-- exercises.tier: el catálogo en la DB manda (no listas hardcodeadas en edge).
-- ---------------------------------------------------------------------------
alter table public.exercises
  add column if not exists tier text not null default 'premium'
    check (tier in ('free', 'premium'));

-- Pool FREE del reto/nivel base. El resto queda 'premium' (default fail-closed).
update public.exercises set tier = 'free' where code in ('sentadillas', 'flexiones');

-- ---------------------------------------------------------------------------
-- abdominales: 8º ejercicio, reps, GRATIS (nuevo pool de reto libre).
-- ---------------------------------------------------------------------------
alter table public.exercises drop constraint if exists exercises_code_check;

alter table public.exercises
  add constraint exercises_code_check
  check (code in (
    'sentadillas',
    'flexiones',
    'plancha',
    'zancadas',
    'puente_gluteo',
    'mountain_climbers',
    'sentadilla_isometrica',
    'abdominales'
  ));

insert into public.exercises (code, name_es, name_en, name_pt, measurement_type, tier) values
  ('abdominales', 'Abdominales', 'Sit-ups', 'Abdominais', 'reps', 'free')
on conflict (code) do update set
  name_es = excluded.name_es,
  name_en = excluded.name_en,
  name_pt = excluded.name_pt,
  measurement_type = excluded.measurement_type,
  tier = excluded.tier;

-- ---------------------------------------------------------------------------
-- goal_history: historial server-side de qué objetivo gobernaba cada fecha.
-- El cliente puede cambiar profiles.goal (RPC/update), pero nunca escribir
-- este historial: un trigger lo mantiene y cierra filas abiertas.
-- ---------------------------------------------------------------------------
create table if not exists public.goal_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  goal text not null check (goal in ('perder_grasa', 'ganar_musculo', 'mantener')),
  valid_from date not null,
  valid_until date check (valid_until is null or valid_until >= valid_from),
  created_at timestamptz not null default now()
);

alter table public.goal_history enable row level security;

create policy "goal_history_select_own"
  on public.goal_history for select
  using (auth.uid() = user_id);

revoke insert, update, delete on public.goal_history from anon, authenticated;
grant select on public.goal_history to authenticated;

create index if not exists idx_goal_history_user_dates
  on public.goal_history (user_id, valid_from desc, valid_until);

-- Mantenimiento del historial cuando cambia el objetivo del perfil.
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
    update public.goal_history
    set valid_until = current_date - 1
    where user_id = new.user_id
      and valid_until is null;

    if new.goal is not null then
      insert into public.goal_history (user_id, goal, valid_from)
      values (new.user_id, new.goal, current_date);
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
-- daily_challenge_assignments: la asignación del reto es server-side.
-- El cliente SOLO lee su asignación del día; nunca la escribe. La Edge
-- Function la crea/actualiza con la rotación del pool FREE vigente para la
-- fecha y el goal que regía según goal_history.
-- ---------------------------------------------------------------------------
create table if not exists public.daily_challenge_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  challenge_date date not null,
  goal_snapshot text not null check (goal_snapshot in ('perder_grasa', 'ganar_musculo', 'mantener')),
  exercise_code text not null references public.exercises (code),
  target int not null check (target > 0),
  unit text not null check (unit in ('reps', 'seconds')),
  feature_version int not null,
  created_at timestamptz not null default now(),
  unique (user_id, challenge_date)
);

alter table public.daily_challenge_assignments enable row level security;

create policy "daily_assignment_select_own"
  on public.daily_challenge_assignments for select
  using (auth.uid() = user_id);

revoke insert, update, delete on public.daily_challenge_assignments from anon, authenticated;
grant select on public.daily_challenge_assignments to authenticated;

create index if not exists idx_daily_assignments_user_date
  on public.daily_challenge_assignments (user_id, challenge_date desc);

-- ---------------------------------------------------------------------------
-- reset_own_progress: el reset también limpia asignaciones (no son progreso,
-- pero evita reintroducir retos viejos tras reiniciar). goal_history persiste:
-- es el historial de objetivo, no progreso.
-- ---------------------------------------------------------------------------
create or replace function public.reset_own_progress()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.workout_sessions where user_id = auth.uid();
  delete from public.daily_challenges where user_id = auth.uid();
  delete from public.workout_submissions where user_id = auth.uid();
  delete from public.daily_challenge_submissions where user_id = auth.uid();
  delete from public.daily_challenge_assignments where user_id = auth.uid();
$$;

commit;
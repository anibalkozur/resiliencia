-- ResiliencIA — migración 0019: períodos del ranking (Hoy/Semana/Mes/Año/Histórico) + visibilidad
-- Reemplaza las firmas existentes: las ELIMINA primero para evitar sobrecargas
-- ambiguas al invocar por PostgREST (PGRST203). Las funciones ganan p_since
-- (null = histórico) y filtran por profiles.show_in_ranking (ADR free/premium:
-- solo premium compite, pero el filtro de visibilidad es del usuario).

begin;

-- 1) Visibilidad en perfiles
alter table public.profiles
  add column if not exists show_in_ranking boolean not null default true;

create index if not exists idx_profiles_show_in_ranking on public.profiles (show_in_ranking);

-- 2) Índice para el corte por período en el ranking de reps/total
create index if not exists idx_workout_sessions_ranked_created
  on public.workout_sessions (created_at)
  where ranked and series_ok and source = 'libre' and status = 'verified';

-- 3) Eliminar firmas antiguas (int) / (text, int) para no dejar sobrecargas
drop function if exists public.get_ranking(int);
drop function if exists public.get_reps_ranking(text, int);
drop function if exists public.get_total_reps_ranking(int);

-- 4) Racha (completed_challenges dentro del período; rachas sobre todo el histórico)
create or replace function public.get_ranking(
  p_max_rows int default 50,
  p_since timestamptz default null
)
returns table (
  user_id uuid,
  nickname text,
  completed_challenges bigint,
  current_streak int,
  best_streak int
)
language sql
security definer
set search_path = public
stable
as $$
  with completed_all as (
    select dc.user_id, dc.challenge_date
    from public.daily_challenges dc
    join public.profiles p on p.user_id = dc.user_id
    where dc.status = 'completed'
      and dc.completion_source = 'server'
      and coalesce(p.show_in_ranking, true)
  ),
  completed_period as (
    select c.user_id
    from completed_all c
    where (p_since is null or c.challenge_date >= p_since::date)
  ),
  runs as (
    select
      c.user_id,
      c.challenge_date,
      c.challenge_date
        - (row_number() over (partition by c.user_id order by c.challenge_date))::int as grp
    from completed_all c
  ),
  runs_agg as (
    select r.user_id, r.grp, count(*)::int as len, max(r.challenge_date) as last_day
    from runs r
    group by r.user_id, r.grp
  ),
  totals as (
    select c.user_id, count(*)::bigint as completed_challenges
    from completed_period c
    group by c.user_id
  )
  select
    p.user_id,
    p.nickname,
    coalesce(t.completed_challenges, 0)::bigint as completed_challenges,
    coalesce((
      select a.len
      from runs_agg a
      where a.user_id = p.user_id and a.last_day >= current_date - 1
      order by a.last_day desc
      limit 1
    ), 0) as current_streak,
    coalesce((
      select max(a.len)
      from runs_agg a
      where a.user_id = p.user_id
    ), 0) as best_streak
  from public.profiles p
  left join totals t on t.user_id = p.user_id
  where coalesce(p.show_in_ranking, true)
  order by
    completed_challenges desc,
    current_streak desc,
    best_streak desc,
    p.nickname asc
  limit greatest(1, least(coalesce(p_max_rows, 50), 200));
$$;

revoke all on function public.get_ranking(int, timestamptz) from public;
revoke all on function public.get_ranking(int, timestamptz) from anon;
grant execute on function public.get_ranking(int, timestamptz) to authenticated;

-- 5) Reps ranking (mejor sesión por ejercicio, período sobre created_at)
create or replace function public.get_reps_ranking(
  p_exercise_code text,
  p_max_rows int default 50,
  p_since timestamptz default null
)
returns table (
  user_id uuid,
  nickname text,
  best_value int,
  sessions bigint
)
language sql
security definer
set search_path = public
stable
as $$
  select
    p.user_id,
    p.nickname,
    max(ws.server_value)::int as best_value,
    count(*)::bigint as sessions
  from public.workout_sessions ws
  join public.exercises e on e.code = ws.exercise_code
  join public.profiles p on p.user_id = ws.user_id
  where e.code = any (string_to_array(p_exercise_code, ','))
    and e.measurement_type = 'reps'
    and ws.source = 'libre'
    and ws.status = 'verified'
    and ws.verification_source = 'server'
    and ws.ranked
    and ws.series_ok
    and ws.server_value >= ws.server_target
    and coalesce(p.show_in_ranking, true)
    and (p_since is null or ws.created_at >= p_since)
  group by p.user_id, p.nickname
  order by best_value desc, p.nickname asc
  limit greatest(1, least(coalesce(p_max_rows, 50), 200));
$$;

revoke all on function public.get_reps_ranking(text, int, timestamptz) from public;
revoke all on function public.get_reps_ranking(text, int, timestamptz) from anon;
grant execute on function public.get_reps_ranking(text, int, timestamptz) to authenticated;

-- 6) Total reps ranking (volumen acumulado, período sobre created_at)
create or replace function public.get_total_reps_ranking(
  p_max_rows int default 50,
  p_since timestamptz default null
)
returns table (
  user_id uuid,
  nickname text,
  total_value bigint
)
language sql
security definer
set search_path = public
stable
as $$
  select
    p.user_id,
    p.nickname,
    sum(ws.server_value)::bigint as total_value
  from public.workout_sessions ws
  join public.exercises e on e.code = ws.exercise_code
  join public.profiles p on p.user_id = ws.user_id
  where e.measurement_type = 'reps'
    and ws.source = 'libre'
    and ws.status = 'verified'
    and ws.verification_source = 'server'
    and ws.ranked
    and ws.series_ok
    and ws.server_value >= ws.server_target
    and coalesce(p.show_in_ranking, true)
    and (p_since is null or ws.created_at >= p_since)
  group by p.user_id, p.nickname
  order by total_value desc, p.nickname asc
  limit greatest(1, least(coalesce(p_max_rows, 50), 200));
$$;

revoke all on function public.get_total_reps_ranking(int, timestamptz) from public;
revoke all on function public.get_total_reps_ranking(int, timestamptz) from anon;
grant execute on function public.get_total_reps_ranking(int, timestamptz) to authenticated;

commit;

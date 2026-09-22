-- ResiliencIA — migración 0008: sesiones verificadas con reps y rankings de repeticiones
-- La app verifica ejercicios por pose/cámara; hasta ahora las repeticiones reales
-- se descartaban (solo se guardaba daily_challenges.status). Este cambio:
--   1. Amplía workout_sessions para guardar sesiones libres verificadas (reps o segundos),
--      su fuente (reto_diario | libre), si participan del ranking y si la serie fue
--      continua (sin descansos largos / sin dejar la posición).
--   2. Agrega get_reps_ranking(exercise)  → mejor sesión (máx valor cumplido) por usuario.
--   3. Agrega get_total_reps_ranking()    → volumen total verificado por usuario.
-- Solo sesiones libres, participation ranked y serie continua entran a estos rankings.
-- El reto del día alimenta únicamente la racha (constancia tipo Duolingo).
-- Autor: [BE].

begin;

-- ---------------------------------------------------------------------------
-- workout_sessions: agregar dimensión verificada
-- ---------------------------------------------------------------------------
alter table public.workout_sessions
  add column if not exists exercise_code text references public.exercises (code),
  add column if not exists value int check (value > 0),
  add column if not exists target int check (target > 0),
  add column if not exists source text not null default 'libre'
    check (source in ('reto_diario', 'libre')),
  add column if not exists ranked boolean not null default false,
  add column if not exists series_ok boolean not null default false;

create index if not exists idx_workout_sessions_ranked
  on public.workout_sessions (exercise_code, value desc)
  where ranked and series_ok;

-- ---------------------------------------------------------------------------
-- get_reps_ranking: mejor sesión por ejercicio y usuario (máx reps en una sesión)
-- ---------------------------------------------------------------------------
create or replace function public.get_reps_ranking(
  p_exercise_code text,
  p_max_rows int default 50
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
    max(ws.value)::int as best_value,
    count(*)::bigint as sessions
  from public.workout_sessions ws
  join public.exercises e on e.code = ws.exercise_code
  join public.profiles p on p.user_id = ws.user_id
  where e.code = any (string_to_array(p_exercise_code, ','))
    and ws.source = 'libre'
    and ws.ranked
    and ws.series_ok
    and ws.value >= ws.target
  group by p.user_id, p.nickname
  order by best_value desc, p.nickname asc
  limit greatest(1, least(coalesce(p_max_rows, 50), 200));
$$;

-- ---------------------------------------------------------------------------
-- get_total_reps_ranking: volumen total verificado por usuario
-- ---------------------------------------------------------------------------
create or replace function public.get_total_reps_ranking(p_max_rows int default 50)
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
    sum(ws.value)::bigint as total_value
  from public.workout_sessions ws
  join public.exercises e on e.code = ws.exercise_code
  join public.profiles p on p.user_id = ws.user_id
  where e.measurement_type = 'reps'
    and ws.source = 'libre'
    and ws.ranked
    and ws.series_ok
    and ws.value >= ws.target
  group by p.user_id, p.nickname
  order by total_value desc, p.nickname asc
  limit greatest(1, least(coalesce(p_max_rows, 50), 200));
$$;

-- Solo usuarios autenticados consultan los rankings de reps.
revoke all on function public.get_reps_ranking(text, int) from public;
revoke all on function public.get_reps_ranking(text, int) from anon;
grant execute on function public.get_reps_ranking(text, int) to authenticated;

revoke all on function public.get_total_reps_ranking(int) from public;
revoke all on function public.get_total_reps_ranking(int) from anon;
grant execute on function public.get_total_reps_ranking(int) to authenticated;

commit;
-- ResiliencIA — migración 0020: el reto diario también alimenta el ranking de reps
--
-- Hallazgo (2026-10-18, reportado por el PO): completar el reto del día marcaba
-- "completado", pero Ranking > Hoy > Reps > <ejercicio> devolvía vacío.
--
-- Causa: al completar un reto sólo se escribía daily_challenges (retos y racha).
-- get_reps_ranking y get_total_reps_ranking leen workout_sessions y filtraban
-- source = 'libre', así que una completación verified server-side nunca llegaba
-- al ranking de reps. El cliente tampoco encolaba sesión desde retos.tsx (sólo
-- lo hace camretos.tsx, en el modo Libre).
--
-- Solución (decisión del PO, 2026-10-18): el reto también cuenta en Reps.
--   1) las dos funciones aceptan source in ('libre', 'reto_diario');
--   2) el índice parcial cubre ambas fuentes;
--   3) backfill idempotente de las completaciones server verified sin fila de
--      sesión (clave client_op_id = 'reto:' || challenge_date);
--   4) validate_workout pasa a escribir esa fila desde la rama de completaciones.
--
-- ADR 2026-09-29 free-sin-ranking: ranked = entitlement premium vigente al
-- momento de verificar; el free queda fuera del ranking de reps (igual que en
-- el modo Libre). series_ok = true porque una completación verified exige
-- evidencia continua (duration >= value * 350 ms), prueba de vida
-- (requireLiveness) y cadencia estricta (strict=1) en una sola corrida de
-- cámara; ver camera-verification.html y acta 012/018.

begin;

-- ---------------------------------------------------------------------------
-- 1) Índice parcial: debe cubrir las dos fuentes que ahora filtran las funciones
-- ---------------------------------------------------------------------------
drop index if exists public.idx_workout_sessions_ranked_created;

create index if not exists idx_workout_sessions_ranked_created
  on public.workout_sessions (created_at)
  where ranked
    and series_ok
    and source in ('libre', 'reto_diario')
    and status = 'verified';

-- ---------------------------------------------------------------------------
-- 2) Ranking de reps por ejercicio (mejor sesión por usuario)
-- ---------------------------------------------------------------------------
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
    and ws.source in ('libre', 'reto_diario')
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

-- ---------------------------------------------------------------------------
-- 3) Ranking de volumen total de reps (suma de sesiones)
-- ---------------------------------------------------------------------------
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
    and ws.source in ('libre', 'reto_diario')
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

-- ---------------------------------------------------------------------------
-- 4) Backfill: completaciones server verified que todavía no tienen su fila de
--    sesión. Idempotente (NOT EXISTS + client_op_id determinista), así que se
--    puede re-ejecutar. Se descartan las legacy (completion_source = 'server'
--    es el único estado que get_ranking cuenta como retos).
-- ---------------------------------------------------------------------------
insert into public.workout_sessions (
  user_id,
  client_op_id,
  challenge_id,
  exercise_code,
  session_date,
  value,
  target,
  source,
  ranked,
  series_ok,
  status,
  verification_source,
  server_value,
  server_target,
  evidence_hash,
  verification_version,
  created_at
)
select
  dc.user_id,
  'reto:' || dc.challenge_date::text,
  dc.id,
  e.code,
  dc.challenge_date,
  dcs.client_value,
  dc.target,
  'reto_diario',
  public.has_active_entitlement(dc.user_id, 'premium'),
  true,
  'verified',
  'server',
  dcs.client_value,
  dc.target,
  dcs.evidence_hash,
  dc.verification_version,
  -- created_at es lo que usan los períodos del ranking: debe ser el momento en
  -- que el servidor verificó la completación, no el día en que se corre este
  -- backfill (si no, todas las completaciones históricas caerían en "Hoy").
  coalesce(dc.verified_at, now())
from public.daily_challenges dc
join public.exercises e
  on e.id = dc.exercise_id
join public.daily_challenge_submissions dcs
  on dcs.user_id = dc.user_id
 and dcs.challenge_date = dc.challenge_date
where dc.status = 'completed'
  and dc.completion_source = 'server'
  and dcs.verification_status = 'verified'
  and not exists (
    select 1
    from public.workout_sessions ws
    where ws.user_id = dc.user_id
      and ws.client_op_id = 'reto:' || dc.challenge_date::text
  );

commit;

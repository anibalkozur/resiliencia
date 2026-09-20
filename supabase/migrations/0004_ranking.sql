-- ResiliencIA — migración 0004: ranking (Fase 1)
-- Reutiliza tablas existentes (profiles, daily_challenges). No crea tablas
-- nuevas y no depende de que streaks esté poblado: la racha se calcula desde
-- las fechas completadas (fuente de verdad del propio registro).
-- Expone solo nickname + agregados vía función SECURITY DEFINER para no abrir
-- las RLS de profiles (que si no filtrarían datos sensibles como peso/edad).
-- Autor: [BE].

begin;

-- Índice parcial para contar/ordenar retos completados por usuario.
create index if not exists idx_daily_challenges_completed
  on public.daily_challenges (user_id, challenge_date)
  where status = 'completed';

-- ---------------------------------------------------------------------------
-- get_ranking(max_rows): leaderboard de solo lectura.
-- - completed_challenges: total de retos completados.
-- - current_streak: días consecutivos terminando hoy o ayer (gracia de 1 día).
-- - best_streak: mejor racha histórica.
-- SECURITY DEFINER con search_path fijo para evitar secuestro de search_path.
-- ---------------------------------------------------------------------------
create or replace function public.get_ranking(max_rows int default 50)
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
  with completed as (
    select dc.user_id, dc.challenge_date
    from public.daily_challenges dc
    where dc.status = 'completed'
  ),
  runs as (
    select
      c.user_id,
      c.challenge_date,
      c.challenge_date
        - (row_number() over (partition by c.user_id order by c.challenge_date))::int as grp
    from completed c
  ),
  runs_agg as (
    select r.user_id, r.grp, count(*)::int as len, max(r.challenge_date) as last_day
    from runs r
    group by r.user_id, r.grp
  ),
  totals as (
    select c.user_id, count(*)::bigint as completed_challenges
    from completed c
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
  order by
    completed_challenges desc,
    current_streak desc,
    best_streak desc,
    p.nickname asc
  limit greatest(1, least(coalesce(max_rows, 50), 200));
$$;

-- Solo usuarios autenticados pueden consultar el ranking.
revoke all on function public.get_ranking(int) from public;
revoke all on function public.get_ranking(int) from anon;
grant execute on function public.get_ranking(int) to authenticated;

commit;

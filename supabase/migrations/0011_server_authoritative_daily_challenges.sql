-- ResiliencIA — migración 0011: retos diarios server-authoritative
--
-- El cliente puede informar que terminó un reto, pero no puede crear ni
-- modificar el registro que alimenta rachas/rankings. Las propuestas se
-- guardan en esta bandeja y quedan SIEMPRE pending: hasta que exista un
-- validador server-side real (video/attestation), ninguna aprobación se
-- escribe en daily_challenges con completion_source = 'server'. La evidencia
-- se conserva para auditoría y futura revisión manual.

begin;

-- La Edge Function también conserva el hash y la versión de evidencia de las
-- sesiones libres. Estas columnas deben existir antes de recibir propuestas.
alter table public.workout_submissions
  add column if not exists evidence_hash text,
  add column if not exists verification_version text;

-- ---------------------------------------------------------------------------
-- Resultado autoritativo del reto
-- ---------------------------------------------------------------------------
alter table public.daily_challenges
  add column if not exists completion_source text not null default 'legacy'
    check (completion_source in ('legacy', 'server', 'manual')),
  add column if not exists verified_at timestamptz,
  add column if not exists verification_version text;

-- Los completados históricos se conservan para auditoría, pero no se
-- consideran verificados por el servidor.
create index if not exists idx_daily_challenges_server_completed
  on public.daily_challenges (user_id, challenge_date)
  where status = 'completed' and completion_source = 'server';

-- ---------------------------------------------------------------------------
-- Propuestas de completado enviadas por la app
-- ---------------------------------------------------------------------------
create table if not exists public.daily_challenge_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  client_op_id text not null,
  challenge_date date not null,
  exercise_code text not null references public.exercises (code),
  client_value int not null check (client_value > 0),
  client_target int not null check (client_target > 0),
  goal_requested text check (goal_requested in ('perder_grasa', 'ganar_musculo', 'mantener')),
  evidence jsonb not null default '{}'::jsonb,
  evidence_hash text,
  verification_version text,
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'verified', 'manual_review', 'rejected')),
  verification_reason text,
  created_at timestamptz not null default now(),
  unique (user_id, challenge_date)
);

alter table public.daily_challenge_submissions enable row level security;

create policy "daily_submission_select_own"
  on public.daily_challenge_submissions for select
  using (auth.uid() = user_id);

revoke insert, update, delete on public.daily_challenge_submissions from anon, authenticated;
grant select on public.daily_challenge_submissions to authenticated;

create index if not exists idx_daily_submissions_user_status
  on public.daily_challenge_submissions (user_id, verification_status, created_at desc);

-- ---------------------------------------------------------------------------
-- El cliente ya no puede falsificar completados ni borrarlos.
-- El reset autorizado sigue funcionando mediante su RPC SECURITY DEFINER.
-- ---------------------------------------------------------------------------
drop policy if exists "challenge_insert_own" on public.daily_challenges;
drop policy if exists "challenge_update_own" on public.daily_challenges;
drop policy if exists "challenge_delete_own" on public.daily_challenges;
revoke insert, update, delete on public.daily_challenges from anon, authenticated;

-- El reset también elimina propuestas pendientes. De lo contrario, una
-- propuesta enviada antes del reset podría aprobarse después y reintroducir
-- progreso que el usuario ya había borrado.
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
$$;

revoke all on function public.reset_own_progress() from public;
revoke all on function public.reset_own_progress() from anon;
grant execute on function public.reset_own_progress() to authenticated;

-- ---------------------------------------------------------------------------
-- Ranking de rachas: solo resultados aprobados por el servidor.
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
      and dc.completion_source = 'server'
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

revoke all on function public.get_ranking(int) from public;
revoke all on function public.get_ranking(int) from anon;
grant execute on function public.get_ranking(int) to authenticated;

commit;

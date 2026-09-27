-- ResiliencIA — migración 0010: sesiones server-authoritative
--
-- El cliente puede enviar una propuesta de sesión, pero nunca puede escribir
-- directamente una sesión que alimente el ranking. Las propuestas quedan en
-- workout_submissions como pending hasta que un validador server-side las
-- apruebe y cree una fila verified en workout_sessions.

begin;

-- ---------------------------------------------------------------------------
-- Datos de validación que solo puede completar el servidor
-- ---------------------------------------------------------------------------
alter table public.workout_sessions
  add column if not exists verification_source text not null default 'legacy'
    check (verification_source in ('legacy', 'server', 'manual')),
  add column if not exists server_value int check (server_value > 0),
  add column if not exists server_target int check (server_target > 0),
  add column if not exists evidence_hash text,
  add column if not exists verification_version text;

-- Las filas creadas por el cliente antes de esta migración no tienen evidencia
-- server-side. Se conservan para auditoría, pero dejan de alimentar rankings.
update public.workout_sessions
set status = 'manual_review',
    verification_source = 'legacy'
where source = 'libre'
  and verification_source = 'legacy';

-- El cliente ya no puede insertar ni modificar sesiones directamente.
drop policy if exists "session_insert_own" on public.workout_sessions;
drop policy if exists "session_update_own" on public.workout_sessions;
revoke insert, update, delete on public.workout_sessions from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Bandeja de propuestas enviadas por la app
-- ---------------------------------------------------------------------------
create table if not exists public.workout_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  client_op_id text not null,
  exercise_code text not null references public.exercises (code),
  client_value int not null check (client_value > 0),
  client_target int not null check (client_target > 0),
  source text not null default 'libre'
    check (source in ('reto_diario', 'libre')),
  ranked_requested boolean not null default false,
  series_ok_reported boolean not null default false,
  liveness_ok_reported boolean not null default false,
  session_date date not null,
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'verified', 'manual_review', 'rejected')),
  verification_reason text,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, client_op_id)
);

alter table public.workout_submissions enable row level security;

-- El usuario puede consultar sus propuestas, pero no insertar, editar ni
-- aprobarlas por REST. La Edge Function usa service_role server-side.
create policy "submission_select_own"
  on public.workout_submissions for select
  using (auth.uid() = user_id);

revoke insert, update, delete on public.workout_submissions from anon, authenticated;
grant select on public.workout_submissions to authenticated;

create index if not exists idx_workout_submissions_user_status
  on public.workout_submissions (user_id, verification_status, created_at desc);

-- ---------------------------------------------------------------------------
-- El ranking solo lee resultados aprobados por el servidor
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
  group by p.user_id, p.nickname
  order by best_value desc, p.nickname asc
  limit greatest(1, least(coalesce(p_max_rows, 50), 200));
$$;

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
  group by p.user_id, p.nickname
  order by total_value desc, p.nickname asc
  limit greatest(1, least(coalesce(p_max_rows, 50), 200));
$$;

commit;

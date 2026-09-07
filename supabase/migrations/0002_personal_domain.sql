-- ResiliencIA — migración 0002: domínio personal completo
-- (workout_exercises, progress) + gamificación (levels, achievements)
-- Autor: [BE]. Social/gyms, ads y sync_queue llegan con sus fases (DF06+),
-- no se portan aún para evitar tablas muertas y drift.

begin;

-- ---------------------------------------------------------------------------
-- Detalle de sesión: qué ejercicios, cuánto, en cada workout
-- ---------------------------------------------------------------------------
create table if not exists public.workout_exercises (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.workout_sessions (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id),
  sets int check (sets between 1 and 30),
  reps int check (reps between 1 and 1000),
  weight numeric(6,2) check (weight >= 0),
  duration_s int check (duration_s between 1 and 7200),
  distance_m numeric(6,1) check (distance_m >= 0)
);

alter table public.workout_exercises enable row level security;

create policy "workout_exercises_select_own"
  on public.workout_exercises for select
  using (
    exists (
      select 1 from public.workout_sessions s
      where s.id = session_id and s.user_id = auth.uid()
    )
  );

create policy "workout_exercises_insert_own"
  on public.workout_exercises for insert
  with check (
    exists (
      select 1 from public.workout_sessions s
      where s.id = session_id and s.user_id = auth.uid()
    )
  );

create policy "workout_exercises_update_own"
  on public.workout_exercises for update
  using (
    exists (
      select 1 from public.workout_sessions s
      where s.id = session_id and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.workout_sessions s
      where s.id = session_id and s.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Progress: historial por ejercicio (métricas del usuario)
-- ---------------------------------------------------------------------------
create table if not exists public.progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  exercise_id uuid not null references public.exercises (id),
  metric text not null check (metric in ('reps', 'seconds', 'sets', 'weight')),
  value numeric(8,2) not null check (value >= 0),
  recorded_at timestamptz not null default now()
);

alter table public.progress enable row level security;

create policy "progress_select_own"
  on public.progress for select
  using (auth.uid() = user_id);

create policy "progress_insert_own"
  on public.progress for insert
  with check (auth.uid() = user_id);

create index if not exists idx_progress_user_exercise_recorded
  on public.progress (user_id, exercise_id, recorded_at desc);

-- ---------------------------------------------------------------------------
-- Gamificación: niveles y logros (contenido; la cuenta XP la hace el backend)
-- ---------------------------------------------------------------------------
create table if not exists public.levels (
  id uuid primary key default gen_random_uuid(),
  min_xp bigint not null,
  unlocks_json jsonb not null default '{}'::jsonb,
  unique (min_xp)
);

alter table public.levels enable row level security;

create policy "levels_select_all"
  on public.levels for select
  using (auth.role() = 'authenticated' or auth.role() = 'anon');

create table if not exists public.user_levels (
  user_id uuid references public.profiles (user_id) on delete cascade,
  level_id uuid references public.levels (id),
  xp_total bigint not null default 0 check (xp_total >= 0),
  primary key (user_id, level_id)
);

alter table public.user_levels enable row level security;

-- La XP es fuente de verdad del backend (regla dura): el cliente solo lee su
-- nivel actual y envía resultados vía Edge Function. No hay insert/update del
-- cliente para evitar auto-boostearse.
create policy "user_levels_select_own"
  on public.user_levels for select
  using (auth.uid() = user_id);

create table if not exists public.achievements (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name_es text not null,
  name_en text not null,
  name_pt text not null,
  description_es text,
  description_en text,
  description_pt text,
  icon text
);

alter table public.achievements enable row level security;

create policy "achievements_select_all"
  on public.achievements for select
  using (auth.role() = 'authenticated' or auth.role() = 'anon');

create table if not exists public.user_achievements (
  user_id uuid references public.profiles (user_id) on delete cascade,
  achievement_id uuid references public.achievements (id),
  unlocked_at timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

alter table public.user_achievements enable row level security;

-- Desbloqueo verificado por el backend (misma regla que XP):
create policy "user_achievements_select_own"
  on public.user_achievements for select
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Índices
-- ---------------------------------------------------------------------------
create index if not exists idx_workout_exercises_session
  on public.workout_exercises (session_id);

create index if not exists idx_user_levels_user
  on public.user_levels (user_id);

create index if not exists idx_user_achievements_user
  on public.user_achievements (user_id);

commit;
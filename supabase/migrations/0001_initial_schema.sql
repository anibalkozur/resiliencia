-- ResiliencIA — migración 0001: base del dominio (users, profiles, catálogo, retos, gamificación)
-- Orden [BE]: users → profiles → catálogo → retos → gamificación → social/gyms → ads → sync
-- Autor: [BE]. Aplicar con: supabase db reset (local) o `supabase link` + `supabase db push`.

begin;

-- ---------------------------------------------------------------------------
-- Extensiones (idempotente en Supabase)
-- ---------------------------------------------------------------------------
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Profiles: una fila por usuario autenticado. NUNCA confiar en el cliente para
-- privilegios: el rol se deriva de auth/jwt, verificado por RLS.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 40),
  age int check (age between 13 and 100),
  weight_kg numeric(5,1) check (weight_kg between 30 and 300),
  height_cm numeric(5,1) check (height_cm between 100 and 250),
  goal text check (goal in ('perder_grasa', 'ganar_musculo', 'mantener')),
  days_per_week int check (days_per_week between 2 and 6),
  language text not null default 'es' check (language in ('es', 'en', 'pt')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profile_select_own"
  on public.profiles for select
  using (auth.uid() = user_id);

create policy "profile_insert_own"
  on public.profiles for insert
  with check (auth.uid() = user_id);

create policy "profile_update_own"
  on public.profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Catálogo de ejercicios (lectura pública, sin RLS restrictivo: es contenido)
-- ---------------------------------------------------------------------------
create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code in ('sentadillas', 'plancha', 'flexiones')),
  name_es text not null,
  name_en text not null,
  name_pt text not null,
  measurement_type text not null check (measurement_type in ('reps', 'seconds'))
);

alter table public.exercises enable row level security;

create policy "exercises_select_all"
  on public.exercises for select
  using (auth.role() = 'authenticated' or auth.role() = 'anon');

-- ---------------------------------------------------------------------------
-- Retos diarios y sesiones
-- ---------------------------------------------------------------------------
create table if not exists public.daily_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  challenge_date date not null,
  exercise_id uuid not null references public.exercises (id),
  target int not null check (target > 0),
  status text not null default 'pending'
    check (status in ('pending', 'completed', 'missed')),
  goal_requested text check (goal_requested in ('perder_grasa', 'ganar_musculo', 'mantener')),
  unique (user_id, challenge_date)
);

alter table public.daily_challenges enable row level security;

create policy "challenge_select_own"
  on public.daily_challenges for select
  using (auth.uid() = user_id);

create policy "challenge_insert_own"
  on public.daily_challenges for insert
  with check (auth.uid() = user_id);

create policy "challenge_update_own"
  on public.daily_challenges for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  challenge_id uuid references public.daily_challenges (id),
  session_date date not null default current_date,
  status text not null default 'pending'
    check (status in ('pending', 'verified', 'manual_review', 'rejected')),
  felt_rating int check (felt_rating between 1 and 5),
  created_at timestamptz not null default now()
);

alter table public.workout_sessions enable row level security;

create policy "session_select_own"
  on public.workout_sessions for select
  using (auth.uid() = user_id);

create policy "session_insert_own"
  on public.workout_sessions for insert
  with check (auth.uid() = user_id);

create policy "session_update_own"
  on public.workout_sessions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Gamificación: rachas (source of truth server-side, nunca client-only)
-- ---------------------------------------------------------------------------
create table if not exists public.streaks (
  user_id uuid primary key references public.profiles (user_id) on delete cascade,
  current_streak int not null default 0,
  best_streak int not null default 0,
  last_active_date date,
  updated_at timestamptz not null default now()
);

alter table public.streaks enable row level security;

create policy "streak_select_own"
  on public.streaks for select
  using (auth.uid() = user_id);

create policy "streak_update_own"
  on public.streaks for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Solo el servidor (service_role) crea/actualiza streaks de forma autoritativa.
-- El cliente solo consulta la suya; si necesita insertar (primera vez), lo
-- hace a través de una Edge Function o trigger. RLS impide inserts directos del
-- cliente para evitar falsificar rachas.

-- ---------------------------------------------------------------------------
-- Índices
-- ---------------------------------------------------------------------------
create index if not exists idx_daily_challenges_user_date
  on public.daily_challenges (user_id, challenge_date desc);

create index if not exists idx_workout_sessions_user_date
  on public.workout_sessions (user_id, session_date desc);

commit;
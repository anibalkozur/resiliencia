-- ResiliencIA — migración 0023: objetivos del onboarding y nivel de experiencia
-- Los valores nuevos amplían el modelo sin borrar `mantener`, que queda como
-- compatibilidad para perfiles y retos históricos.

begin;

alter table public.profiles
  add column if not exists experience_level text;

alter table public.profiles
  drop constraint if exists profiles_goal_check,
  drop constraint if exists profiles_experience_level_check;

alter table public.profiles
  add constraint profiles_goal_check
    check (goal in ('perder_grasa', 'ganar_musculo', 'crear_habito', 'sentirme_mejor', 'mantener')),
  add constraint profiles_experience_level_check
    check (experience_level in ('nunca_entrene', 'principiante', 'intermedio', 'avanzado'));

alter table public.daily_challenges
  drop constraint if exists daily_challenges_goal_requested_check;

alter table public.daily_challenges
  add constraint daily_challenges_goal_requested_check
    check (goal_requested in ('perder_grasa', 'ganar_musculo', 'crear_habito', 'sentirme_mejor', 'mantener'));

alter table public.daily_challenge_submissions
  drop constraint if exists daily_challenge_submissions_goal_requested_check;

alter table public.daily_challenge_submissions
  add constraint daily_challenge_submissions_goal_requested_check
    check (goal_requested in ('perder_grasa', 'ganar_musculo', 'crear_habito', 'sentirme_mejor', 'mantener'));

alter table public.goal_history
  drop constraint if exists goal_history_goal_check;

alter table public.goal_history
  add constraint goal_history_goal_check
    check (goal in ('perder_grasa', 'ganar_musculo', 'crear_habito', 'sentirme_mejor', 'mantener'));

alter table public.daily_challenge_assignments
  drop constraint if exists daily_challenge_assignments_goal_snapshot_check;

alter table public.daily_challenge_assignments
  add constraint daily_challenge_assignments_goal_snapshot_check
    check (goal_snapshot in ('perder_grasa', 'ganar_musculo', 'crear_habito', 'sentirme_mejor', 'mantener'));

-- Nuevos perfiles comienzan con un objetivo de constancia, sin alterar perfiles
-- ya existentes ni sus historiales.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_goal text;
begin
  v_goal := new.raw_user_meta_data ->> 'goal';
  if v_goal is null or v_goal not in (
    'perder_grasa', 'ganar_musculo', 'crear_habito', 'sentirme_mejor', 'mantener'
  ) then
    v_goal := 'crear_habito';
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

create or replace function public.set_goal(p_goal text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_goal not in (
    'perder_grasa', 'ganar_musculo', 'crear_habito', 'sentirme_mejor', 'mantener'
  ) then
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

-- ResiliencIA — migración 0003: Auth auto-profile + seed catálogo + hardening
-- 1) Trigger que crea profiles al registrarse (Auth users -> profiles).
-- 2) Seed del catálogo base (3 ejercicios del MVP Fase 1).
-- 3) Revocar EXECUTE público del helper de RLS automática de la plataforma
--    (rls_auto_enable) para cerrar el hallazgo del Security Advisor.

begin;

-- ---------------------------------------------------------------------------
-- Hardening: rls_auto_enable() es SECURITY DEFINER instalado por la plataforma
-- con el toggle "Enable automatic RLS". No debe ser ejecutable vía /rest/v1/rpc.
-- ---------------------------------------------------------------------------
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Trigger: al crear un usuario en auth.users, crear su fila en profiles.
-- Patrón estándar Supabase; la función no queda expuesta por RPC (sin grants).
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (user_id, nickname, language)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'nickname'), ''), 'atleta'),
    coalesce(new.raw_user_meta_data ->> 'language', 'es')
  );
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Seed del catálogo base (respeta el check de public.exercises.code)
-- ---------------------------------------------------------------------------
insert into public.exercises (code, name_es, name_en, name_pt, measurement_type) values
  ('sentadillas', 'Sentadillas', 'Squats', 'Agachamentos', 'reps'),
  ('plancha', 'Plancha', 'Plank', 'Prancha', 'seconds'),
  ('flexiones', 'Flexiones', 'Push-ups', 'Flexões', 'reps')
on conflict (code) do nothing;

commit;
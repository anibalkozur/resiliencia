-- ResiliencIA — migración 0022: perfil mínimo de onboarding
-- La preferencia visual es personalización de interfaz, no una regla de
-- entrenamiento ni un dato usado para validar repeticiones.

begin;

alter table public.profiles
  add column if not exists visual_model text,
  add column if not exists onboarding_completed_at timestamptz;

alter table public.profiles
  drop constraint if exists profiles_visual_model_check;

alter table public.profiles
  add constraint profiles_visual_model_check
  check (visual_model in ('mujer', 'hombre'));

commit;

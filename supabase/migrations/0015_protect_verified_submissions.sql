-- ResiliencIA — migración 0015: verified es terminal/server-authoritative
--
-- El invariante del sistema es que una propuesta aprobada por el servidor no
-- puede degradarse. Solo la capa de validación (hoy la edge, mañana el
-- validador real) escribe workout_submissions / daily_challenge_submissions,
-- pero un re-sync del cliente, una reinstalación, un bug de la edge o un
-- UPDATE accidental podrían sobrescribir una fila verified con pending/rejected.
--
-- Este trigger hace que verified sea un estado terminal a nivel de la DB:
-- ningún UPDATE puede cambiar una fila verified a otro estado. La edge, por su
-- parte, lee primero y no re-escribe lo que ya está decidido (verificación
-- redundante explicada en validate_workout/index.ts).

begin;

create or replace function public.protect_verified_submission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if OLD.verification_status = 'verified'
     and NEW.verification_status is distinct from 'verified' then
    raise exception
      'server_authoritative: cannot downgrade a verified submission from % to %',
      OLD.verification_status,
      NEW.verification_status
      using errcode = '23514'; -- check_violation
  end if;
  return NEW;
end;
$$;

-- Propuestas de reto diario
drop trigger if exists protect_verified_daily_submissions on public.daily_challenge_submissions;
create trigger protect_verified_daily_submissions
  before update on public.daily_challenge_submissions
  for each row
  execute function public.protect_verified_submission();

-- Propuestas de sesiones libres
drop trigger if exists protect_verified_workout_submissions on public.workout_submissions;
create trigger protect_verified_workout_submissions
  before update on public.workout_submissions
  for each row
  execute function public.protect_verified_submission();

commit;
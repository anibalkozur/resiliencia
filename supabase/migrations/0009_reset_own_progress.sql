-- ResiliencIA — migración 0009: reset propio completo + idempotencia de sesiones libres
-- Complementa 0007 (que solo ponía los retos diarios en 'pending'): "Reiniciar retos y
-- ranking" también borra en la nube las sesiones verificadas (workout_sessions), que son
-- las que alimentan los rankings de reps de 0008.
-- Agrega client_op_id a workout_sessions para que el alta de sesiones libres sea
-- idempotente (la app sube con UPSERT por (user_id, client_op_id)).
-- Autor: [BE] · decidido en sesión 2026-09-27 (evaluación de auditoría externa).

begin;

-- ---------------------------------------------------------------------------
-- workout_sessions: credencial de operación del cliente para upsert idempotente
-- ---------------------------------------------------------------------------
alter table public.workout_sessions
  add column if not exists client_op_id text;

create unique index if not exists workout_sessions_user_op_uidx
  on public.workout_sessions (user_id, client_op_id);

-- ---------------------------------------------------------------------------
-- reset_own_progress: vuelve a cero el progreso del propio usuario en la nube.
-- RLS deja delete/update; esta RPC hace el borrado de ambas tablas como la app
-- conoce el resignificado 2026-09-27 ("Reiniciar retos y ranking").
-- ---------------------------------------------------------------------------
create or replace function public.reset_own_progress()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.workout_sessions where user_id = auth.uid();
  delete from public.daily_challenges where user_id = auth.uid();
$$;

-- Solo usuarios autenticados ejecutan el reset de su propio progreso.
revoke all on function public.reset_own_progress() from public;
revoke all on function public.reset_own_progress() from anon;
grant execute on function public.reset_own_progress() to authenticated;

commit;
-- ResiliencIA — migración 0013: cierre de superficies heredadas (PLAN v4 / F0)
--
-- Complementa 0010/0011 (workout_sessions y daily_challenges ya son
-- server-authoritative). Cierra las tablas que todavía aceptaban escrituras
-- del cliente y que podrían falsificar progreso: workout_exercises, progress,
-- streaks, user_levels y user_achievements. El cliente solo lee; la escritura
-- autoritativa queda reservada a service_role (Edge Functions / triggers).
--
-- La app actual no escribe estas tablas (verificado en 2026-09-28), así que
-- este cierre es seguro y no rompe el cliente.

begin;

-- ---------------------------------------------------------------------------
-- workout_exercises: detalle de sesión. Sin escrituras del cliente.
-- ---------------------------------------------------------------------------
drop policy if exists "workout_exercises_insert_own" on public.workout_exercises;
drop policy if exists "workout_exercises_update_own" on public.workout_exercises;
revoke insert, update, delete on public.workout_exercises from anon, authenticated;

-- ---------------------------------------------------------------------------
-- progress: historial por ejercicio. Sin escrituras del cliente.
-- ---------------------------------------------------------------------------
drop policy if exists "progress_insert_own" on public.progress;
drop policy if exists "progress_update_own" on public.progress;
drop policy if exists "progress_delete_own" on public.progress;
revoke insert, update, delete on public.progress from anon, authenticated;

-- ---------------------------------------------------------------------------
-- streaks: las rachas se derivan de daily_challenges verificados server-side.
-- ---------------------------------------------------------------------------
drop policy if exists "streak_update_own" on public.streaks;
drop policy if exists "streak_insert_own" on public.streaks;
drop policy if exists "streak_delete_own" on public.streaks;
revoke insert, update, delete on public.streaks from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Gamificación: XP y logros los calcula el backend. Cliente solo lee.
-- ---------------------------------------------------------------------------
revoke insert, update, delete on public.user_levels from anon, authenticated;
revoke insert, update, delete on public.user_achievements from anon, authenticated;

commit;
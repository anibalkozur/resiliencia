-- ResiliencIA — migración 0007: reset de progreso propio
-- Habilita borrar los retos del propio usuario desde la app (RLS delete).
-- Se usa junto a un botón de "Reiniciar retos y ranking" para volver a cero
-- el histórico local y la nube (el ranking se recalcula solo con get_ranking).

begin;

alter table public.daily_challenges enable row level security;

drop policy if exists "challenge_delete_own" on public.daily_challenges;

create policy "challenge_delete_own"
  on public.daily_challenges for delete
  using (auth.uid() = user_id);

commit;
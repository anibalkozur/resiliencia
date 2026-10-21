-- ResiliencIA — migración 0021: catálogo de ejercicios incluye fondos_silla
--
-- Contexto: el catálogo móvil (apps/mobile/src/retos/catalog.ts) ofrecía 9
-- ejercicios incluyendo `fondos_silla` (premium), pero la tabla `exercises` de
-- producción tenía un CHECK que hardcodeaba solo 8 códigos (migraciones 0005 y
-- 0012), y las migraciones de seed nunca lo insertaban. Resultado: cualquier
-- sesión de `fondos_silla` era rechazada por la edge `validate_workout` (el
-- `exercise_code` violaba el CHECK/referencia), pese a que la cámara
-- (camera-verification.html v53), la técnica y el i18n ya lo soportan completo.
--
-- Decisión (PO, 2026-10-20): completar el catálogo, no retirarlo del cliente.
-- Esta migración replica el cambio aplicado directo en prod el 2026-10-20 para
-- dejar la fuente versionada e idempotente.
--
-- Idempotente: recrea el CHECK con la lista completa y upserta la fila.

begin;

alter table public.exercises drop constraint if exists exercises_code_check;
alter table public.exercises
  add constraint exercises_code_check check (
    code = any (array[
      'sentadillas',
      'flexiones',
      'plancha',
      'zancadas',
      'puente_gluteo',
      'mountain_climbers',
      'sentadilla_isometrica',
      'abdominales',
      'fondos_silla'
    ])
  );

insert into public.exercises (code, name_es, name_en, name_pt, measurement_type, tier) values
  ('fondos_silla', 'Fondos en silla', 'Chair dips', 'Mergulho na cadeira', 'reps', 'premium')
on conflict (code) do update set
  name_es = excluded.name_es,
  name_en = excluded.name_en,
  name_pt = excluded.name_pt,
  measurement_type = excluded.measurement_type,
  tier = excluded.tier;

commit;

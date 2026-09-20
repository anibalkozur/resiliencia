-- ResiliencIA — migración 0005: catálogo de ejercicios completo (Fase 1)
-- La app usa 7 ejercicios, pero 0001 limitó public.exercises.code a 3 y 0003
-- sembró solo esos 3. Sin esto, sincronizar daily_challenges (exercise_id FK)
-- falla para 4 de los 7 retos. Se relaja el check y se siembran los 7.
-- Autor: [BE].

begin;

-- El check original se declaró inline sobre la columna code; su nombre por
-- defecto en Postgres es exercises_code_check. Se elimina de forma defensiva.
alter table public.exercises drop constraint if exists exercises_code_check;

alter table public.exercises
  add constraint exercises_code_check
  check (code in (
    'sentadillas',
    'flexiones',
    'plancha',
    'zancadas',
    'puente_gluteo',
    'mountain_climbers',
    'sentadilla_isometrica'
  ));

-- Seed/actualización de los 7 ejercicios (idempotente por code).
insert into public.exercises (code, name_es, name_en, name_pt, measurement_type) values
  ('sentadillas',           'Sentadillas',           'Squats',             'Agachamentos',             'reps'),
  ('flexiones',             'Flexiones',             'Push-ups',           'Flexões',                  'reps'),
  ('plancha',               'Plancha',               'Plank',              'Prancha',                  'seconds'),
  ('zancadas',              'Zancadas',              'Lunges',             'Avanços',                  'reps'),
  ('puente_gluteo',         'Puente de glúteos',     'Glute bridge',       'Ponte de glúteo',          'reps'),
  ('mountain_climbers',     'Escaladores',           'Mountain climbers',  'Escaladores',              'seconds'),
  ('sentadilla_isometrica', 'Sentadilla isométrica', 'Wall sit',           'Agachamento isométrico',   'seconds')
on conflict (code) do update set
  name_es = excluded.name_es,
  name_en = excluded.name_en,
  name_pt = excluded.name_pt,
  measurement_type = excluded.measurement_type;

commit;

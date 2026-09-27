# ResiliencIA — Modelo de datos (Postgres / Supabase)

Agrupado por dominio. Todas las tablas con `gym_id` nullable usan Row Level
Security para aislar datos entre gimnasios (multi-tenancy, sección 33).

## Usuarios y ejercicios

```
users(id, email, created_at)
profiles(user_id, name, avatar, age_range, experience_level, goal,
         frequency, home_gym_pref, equipment, is_public)
exercise_categories(id, name)
exercises(id, category_id, name, description, instructions, difficulty,
          measurement_type, media_url)
exercise_variants(id, exercise_id, name, difficulty_delta)
```

## Retos y entrenamiento

```
challenge_templates(id, name, days, difficulty_tier, is_gym_only)
challenges(id, template_id?, owner_user_id?, gym_id?, name, config_json,
           privacy)
challenge_days(id, challenge_id, day_number, exercises_json)
challenge_participants(id, challenge_id, user_id, joined_at, status)

workout_sessions(id, user_id, challenge_id?, date, status, felt_rating,
                  pain_flag, synced_at)
workout_exercises(id, session_id, exercise_id, sets, reps, weight,
                   duration_s, distance_m)
progress(id, user_id, exercise_id, metric, value, recorded_at)
```

## Gamificación

```
streaks(user_id, current_streak, best_streak, last_active_date)
levels(id, min_xp, unlocks_json)
user_levels(user_id, level_id, xp_total)
achievements(id, code, name, description, icon)
user_achievements(user_id, achievement_id, unlocked_at)
daily_challenges(id, user_id, date, exercises_json, status)
```

## Social y gimnasios

```
friendships(id, user_id, friend_id, status)
groups(id, name, owner_user_id)
group_members(group_id, user_id, role)
group_challenges(group_id, challenge_id)

gyms(id, name, logo_url, description, location, plan_tier)
gym_members(gym_id, user_id, role)  -- role: GYM_MEMBER | GYM_ADMIN
gym_settings(gym_id, branding_json)
gym_challenges(gym_id, challenge_id)
gym_events(id, gym_id, name, starts_at, ends_at)
seasons(id, scope, gym_id?, group_id?, name, starts_at, ends_at)
season_participants(season_id, user_id, points)
invitations(id, type, from_user_id, to_user_id?, gym_id?, code)
qr_codes(id, target_type, target_id, opaque_code)
```

## Monetización, publicidad y notificaciones

```
subscriptions(id, user_id?, gym_id?, plan, status, renews_at)
purchases(id, user_id, product_id, amount, currency, status)
entitlements(user_id, key, value)  -- validado en backend, nunca en cliente
advertisements(id, gym_id, type, target_json, starts_at, ends_at)
promotions(id, gym_id, kind, status)
sponsored_challenges(challenge_id, gym_id, starts_at, ends_at)
sponsored_rankings(ranking_id, gym_id, starts_at, ends_at)
notifications(id, user_id, type, payload_json, read_at)
```

## Sincronización

```
sync_queue(id, user_id, entity, entity_id, operation, payload_json,
           status, attempts, created_at)
```

Reglas duras: `entitlements`, XP y resultados de ranking se calculan y
validan en backend; el cliente offline los propone vía `sync_queue` pero
nunca son fuente de verdad final.

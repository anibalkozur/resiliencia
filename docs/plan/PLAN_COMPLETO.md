# ResiliencIA — Plan Maestro Completo

### De prototipo HTML a app de producción publicada en Google Play

> **Qué es este documento:** el plan de construcción paso a paso, al mínimo
> detalle, para llevar la app desde el estado actual de la carpeta hasta una
> app comercial en Play Store. Complementa (y en algunos puntos reemplaza en
> detalle) a `PRODUCT_SPEC.md`, `DATABASE.md`, `IA_ENTRENADOR.md` y
> `ROADMAP.md`. **No modifica ningún archivo existente.**
>
> **Regla de oro:** cada fase termina con algo **funcional y probado** (no
> "en proceso"). Toda tarea tiene su "Definición de Terminado" (DoD). No se
> avanza a la siguiente fase hasta cumplir el DoD de la anterior.

---

## 0. Reglas de oro del proyecto

1. **Offline-first.** El usuario siempre puede entrenar. La red solo se usa
   para sincronizar y para las features que la exigen (ranking, social, ads).
2. **El ranking verificado se calcula en el servidor, nunca en el cliente.**
   El cliente propone; el servidor valida, puntúa y publica. (Es la única
   forma de que "hacer trampa" sea caro.)
3. **El LLM nunca toca la base de datos ni decide progresión.** (Ver
   `IA_ENTRENADOR.md`: patrón `ContextBuilder`.)
4. **XP, rachas, niveles y logros se otorgan por eventos validados por el
   motor**, nunca por texto libre del usuario.
5. **Monetización B2B nunca altera resultados** (rankings patrocinados se
   etiquetan "Presentado por X"). Regla dura de producto.
6. **Cada fase termina en `main` con tests verdes y CI pasando.**

---

## 1. Punto de partida: qué hay en la carpeta hoy

| Archivo                         | Qué es                                                                                                                        | Qué hacemos con él                                                                                                                         |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `app.html`                      | MVP Fase 1 (Home, reto diario, XP, racha, logros, calendario, offline con localStorage)                                       | **Puerto** de su lógica de dominio (ProgressionEngine, applyStreak, ACHIEVEMENTS, levelForXp) a TypeScript puro en el módulo `src/domain/` |
| `index.html`                    | Verificación por cámara (MediaPipe Pose, anti-cheat: orientación obligatoria, liveness, continuidad, calibración por persona) | **Rediseño** en React Native con **ML Kit Pose** (nativo) + misma lógica de estados. La evidencia viaja al backend                         |
| `PRODUCT_SPEC.md`               | Spec de producto (33 puntos)                                                                                                  | **Fuente de producto** (se mantiene como referencia de decisiones)                                                                         |
| `DATABASE.md`                   | Modelo de datos (~40 entidades)                                                                                               | **Base** del esquema real; este documento lo expande con tablas de ranking, temporadas, anuncios y comercios                               |
| `IA_ENTRADOR.md`                | Análisis del entrenador LLM local (Qwen3.5-2B, llama.cpp, ContextBuilder)                                                     | **Fase 9**: se implementa como módulo nativo o en la nube                                                                                  |
| `ROADMAP.md`                    | 5 fases resumidas                                                                                                             | Reemplazado por el detalle de este documento                                                                                               |
| `brand-style-guide.html` + PNGs | Identidad ResiliencIA (paleta teal→cyan→blue + plata, íconos SVG, tipografía)                                                 | **Tokens de diseño** para la app nativa (no emoji; íconos de línea)                                                                        |

Entrega actual convertida a recursos de diseño: los íconos PNG de ejercicios
(`icono_*.png`) se regeneran como **SVG tipográficos del brand guide** para la
app nativa (vectores, resolución infinita, coherentes). El logo
`Logo mas limpio.png` es el candidato oficial.

---

## 2. Visión y modelo de negocio

**ResiliencIA** = plataforma de retos de ejercicio físico con verificación
por cámara + IA, gamificación, y competencias justas.

**Loop central:** reto → entrenamiento (opcionalmente verificado) → racha/XP →
nivel → ranking → comunidad → hábito → retorno diario.

**Audiencias:**

- B2C: personas que quieren empezar/vover/competir (13+).
- B2B: gimnasios, tiendas de suplementos y marcas de suplementos (anunciantes).

---

## 3. Fuentes de ingreso (todas)

| Fuente                       | Tipo                  | Descripción                                                                                                       | Cuándo   |
| ---------------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------- | -------- |
| **Anuncios en app**          | B2C ad-supported      | AdMob (banner, interstitial, rewarded) con consentimiento UMP                                                     | Fase 8   |
| **Gimnasios anunciantes**    | B2B                   | Destacados en la app ("Gimnasio destacado"), retos patrocinados, rankings patrocinados (etiquetados)              | Fase 8   |
| **Tiendas de suplementos**   | B2B local             | Cupones descuento in-app, tarjeta + mapa de tiendas, deep-link a su tienda                                        | Fase 8   |
| **Marcas de suplementos**    | B2B nacional/regional | "Reto del mes presentado por [Marca]", campañas con código promocional, afiliación (enlace de compra comisionado) | Fase 8   |
| **Premium (suscripción)**    | B2C                   | Sin anuncios, estadísticas avanzadas, contenido premium, personalización                                          | Fase 8   |
| **Gimnasios Pro (B2B SaaS)** | B2B                   | Dashboard web, retos propios, reportes, QR de membresía                                                           | Fase 7+8 |

Reglas: nunca bloquear el ecosistema Gym detrás de Premium; los patrocinios
siempre etiquetados.

---

## 4. Arquitectura global

```
┌─────────────────────────────── APP (React Native + Expo) ───────────────────────────────┐
│  UI (React Native / Expo Router)                                                        │
│  Estado global (Zustand)  ──  Stores de dominio                                          │
│  ┌─────────────────────────────────────────────────────────────────────────────┐        │
│  │ src/domain/   (TypeScript puro, sin RN, reutilizable, testeable)            │        │
│  │  • ProgressionEngine   • SafetyEngine   • CameraVerificationEngine           │        │
│  │  • StreakEngine        • XpLevelEngine  • RankingsClient (propone)           │        │
│  │  • ChallengeBuilder (semanal, +1 por disciplina)                             │        │
│  └─────────────────────────────────────────────────────────────────────────────┘        │
│  Persistencia local: expo-sqlite (fuente de verdad offline)                             │
│  SyncQueue (offline→nube con estado pending/syncing/synced/error)                       │
│  Cámara: react-native-vision-camera + ML Kit Pose (módulo nativo)                       │
│  Ads: react-native-admob + UMP;  Subs: react-native-purchases; Push: Expo Notifications │
└──────────────────────────────────────────────────────────────────────────────────────────┘
                                         │ HTTPS + RLS
┌─────────────────────────────────────── SUPABASE ────────────────────────────────────────┐
│  Postgres (+ RLS multi-tenancy) │ Auth (email, Google, Apple) │ Storage (evidencias)   │
│  Edge Functions (Node/Deno):                                                             │
│   • validate_workout      (recibe evidencia, valida, puntúa, marca verificado)           │
│   • recompute_rankings    (rebuilds por scope/temporada)                                  │
│   • create_season         • join_challenge   • submit_workout                             │
│   • sponsor_slots         • coupon_validate   • audit_sampling (top)                     │
│  Realtime (comentarios, desafíos en vivo)                                                │
└──────────────────────────────────────────────────────────────────────────────────────────┘
       │
       ├── Panel B2B web (Next.js, solo gimnasios/admins): dashboard, retos, reportes
       └── Cron jobs (pg_cron): cierre de temporadas, rank recompute, notificaciones
```

---

## 5. Stack definitivo

| Capa         | Elección                                                                      | Por qué                                                                     |
| ------------ | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| App          | **React Native + Expo (SDK 53+)** + TypeScript                                | Stack recomendado en PRODUCT_SPEC; EAS Build/Submit para publicar           |
| Navegación   | **Expo Router**                                                               | File-based, deep links                                                      |
| Estado       | **Zustand** + persistencia                                                    | Liviano, testeable                                                          |
| DB local     | **expo-sqlite**                                                               | Offline-first real                                                          |
| Backend      | **Supabase** (Postgres + Auth + Storage + Edge Functions + Realtime)          | RLS multi-tenant, costo inicial bajo, se mantiene la recomendación del spec |
| Pose         | **ML Kit Pose Detection** (Android) / **Vision Pose** (iOS) vía módulo nativo | GPU, 100% offline, mejor FPS que WASM web                                   |
| Cámara       | **react-native-vision-camera**                                                | Soporte oficial, permisos controlados                                       |
| Ads          | **react-native-admob (Google Mobile Ads + UMP)**                              | Consentimiento UE obligatorio                                               |
| Subs/in-app  | **RevenueCat** (wrap) o **react-native-billing**                              | Billing V7 de Play                                                          |
| Push         | **expo-notifications** + Expo Push Service                                    | Gratis, simple                                                              |
| Build/Deploy | **EAS Build + EAS Submit**                                                    | Firmado, .aab a Play                                                        |
| Analytics    | **PostHog** (self-host o cloud)                                               | Eventos + funnels, GDPR-friendly                                            |

---

## 6. Modelo de datos completo (Supabase / Postgres)

Extiende `DATABASE.md`. **Todo ranking que alimenta scores se recalcula en
servidor.**

### 6.1 Usuarios y perfil

```sql
users(id uuid pk default gen_random_uuid(), email text unique, created_at timestamptz);
profiles(user_id uuid pk fk users, name text, avatar_url text, country char(2),
         state_region text, city text, lat numeric, lng numeric,
         age_range text, experience_level text, goal text, equipment jsonb,
         home_gym_id uuid null, is_public bool default true,
         referrer_code text unique, referred_by uuid null);
devices(user_id fk, device_fingerprint text, platform text, last_seen_at timestamptz)
        -- fingerprinting con hash salado (anti-multi-cuenta)
```

### 6.2 Ejercicios, catálogo y retos

```sql
exercise_categories(id, name, icon_svg);
exercises(id, category_id, name, description, instructions, difficulty,
          measurement_type, media_url, posture_profile text);
   -- posture_profile: 'frontal' | 'lateral' (define perfil de cámara)
exercise_variants(id, exercise_id, name, difficulty_delta);

challenge_templates(id, name, days, difficulty_tier, is_gym_only, recurrence,
                    recurrence_config jsonb);
   -- recurrence: 'none' | 'daily' | 'weekly'
challenge_days(id, challenge_id, day_number, exercises_json);
challenges(id, template_id null, owner_user_id null, gym_id null, name,
           config_json, privacy, schedule_start, schedule_end, is_weekly bool,
           allow_verified_only bool);
challenge_participants(id, challenge_id, user_id, joined_at, status,
                       standing_score numeric default 0);
weekly_challenges(id, challenge_id, week_start date, week_end date, status);
weekly_progress(id, weekly_challenge_id, participant_id, workout_sessions day,
                 reps_done int, xp_earned int);
```

### 6.3 Entrenamiento y evidencia

```sql
workout_sessions(id, user_id, challenge_id null, date, status, felt_rating,
                 pain_flag, auth_type text,           -- 'manual' | 'verified'
                 client_op_id text unique,            -- idempotencia anti-replay
                 run_mode text,                       -- 'real' | 'emulator' | 'sandbox'
                 verification jsonb,                   -- resumen (ver 6.3.1)
                 continuity_ok bool, orientation_ok bool, liveness_ok bool,
                 elapsed_s int, device_fingerprint text,
                 synced_at timestamptz);
workout_exercises(id, session_id, exercise_id, sets, reps, weight, duration_s);
workout_evidence(id, session_id, evidence_type text, -- 'landmarks_pack' | 'video_clip'
                 storage_path text, sample_status text default 'pending',
                 audited_by uuid null, audited_at timestamptz,
                 verdict text null);                  -- 'ok' | 'fraud' | 'manual_review'
rep_timestamps(id, session_id, position int, t_ms int);  -- para continuidad/anomalías
```

**6.3.1 `verification` JSON** (lo que manda el cliente y re-valida el server):

```json
{
  "model": "mlkit-pose-v1",
  "fps_avg": 28,
  "exercise": "pushups",
  "posture": "lateral",
  "total_reps": 18,
  "rep_timestamps_ms": [0, 2200, ...],
  "continuity": {"ok": true, "max_gap_ms": 5200},
  "orientation": {"ok": true, "avg_beta": 89.2},
  "liveness": {"passed": true, "challenge_ms": 7250, "type": "hold"},
  "angles_min_max": [{"rep":1,"min":72,"max":168}, ...],
  "landmarks_pack_hash": "sha256:..."
}
```

El servidor **recomputa** las métricas básicas de plausibilidad (reps/seg,
distribución de ángulos, gap mínimos), compara contra rangos humanos y
guarda el paquete de landmarks muestreados para auditoría.

### 6.4 Gamificación

```sql
streaks(user_id pk, current_streak, best_streak, last_active_date,
        protected_by_rest_days int);            -- descansos planificados no rompen
levels(id, min_xp, unlocks_json);
user_levels(user_id, level_id, xp_total);
achievements(id, code, name, description, icon_svg, requires_verified bool);
user_achievements(user_id, achievement_id, unlocked_at);
daily_challenges(id, user_id, date, exercises_json, status);
xp_events(id, user_id, event_type, amount, ref_id, created_at); -- auditoría de XP
```

### 6.5 Rankings y temporadas (NUCLEO)

```sql
seasons(id, scope text,            -- 'global'|'national'|'regional'|'gym'
        country char(2) null, region text null, gym_id uuid null,
        name, starts_at, ends_at, status);
season_participants(season_id, user_id, points_total, verified_only bool,
                    updated_at);
leaderboard_entries(season_id, scope, country, region, gym_id,
                    user_id, points, position int, verified_only bool,
                    updated_at);                      -- MATERIALIZED/rebuilt por job
points_rules(id, action text, base int, multiplier jsonb); -- ej: verified_x1.0 / manual_x0.3
gym_rank_entries(season_id, gym_id, total_points, active_members int, position); -- ranking GYMS

-- Auditoría de puntaje (append-only, fuente de verdad anti-fraude):
points_audit(id, season_id null, user_id null, gym_id null, points_delta int,
             ref_type text, ref_id uuid, reason text, created_at);
fraud_events(id, user_id null, gym_id null, type text, severity text,
             evidence jsonb, status text, created_at);
```

**Scopes:** mundial (global), nacional (country), regional (state/region/city),
y por gimnasio (gym). Cada uno con su propio `leaderboard_entries`.

### 6.6 Social

```sql
friendships(id, user_id, friend_id, status);
groups(id, name, owner_user_id, invite_code);
group_members(group_id, user_id, role);
group_challenges(group_id, challenge_id);
group_achievements(group_id, achievement_id, unlocked_at);
messages(id, group_id null, challenge_id null, user_id, body, created_at);
notifications(id, user_id, type, payload_json, read_at);
```

### 6.7 Gimnasios (B2B)

```sql
gyms(id, name, logo_url, description, location, country, region, city,
     plan_tier text default 'free',   -- free | pro | enterprise
     owner_user_id, verified bool, sponsored_until timestamptz);
gym_members(gym_id, user_id, role, joined_at, qr_code_hash);
gym_settings(gym_id, branding_json);
gym_challenges(gym_id, challenge_id);
gym_events(id, gym_id, name, starts_at, ends_at, kind text); -- 'flash'|'seasonal'|'live'
seasons(scope='gym', gym_id fk)  -- temporadas por gimnasio
qr_codes(id, target_type, target_id, opaque_code);  -- solo uuid opaco
```

### 6.8 Monetización, anuncios y comercios

```sql
subscriptions(id, user_id null, gym_id null, plan, status, renews_at,
              source text);                        -- 'play'|'manual_b2b'
entitlements(user_id, key, value);                 -- validado en backend
advertisements(id, advertiser_type text,           -- 'gym'|'supplement_shop'|'supplement_brand'
               advertiser_id, campaign_id, ad_type text,  -- 'banner'|'interstitial'|'rewarded'|
               target_json, starts_at, ends_at, budget_cents int,
               status);                            -- 'active'|'paused'|'ended'
ad_campaigns(id, advertiser_id, name, budget_cents, cpm_cents, geo_target jsonb);
ad_impressions(id, campaign_id, ad_id, user_id null, type, revenue_cents,
               served_at);                          -- reporte de inventario
sponsored_challenges(challenge_id, advertiser_id, campaign_id, label, starts, ends);
sponsored_rankings(ranking_id, advertiser_id, campaign_id, label, starts, ends);
coupons(id, advertiser_id, code, discount_text, deep_link, max_uses, used int,
        user_id null, expires_at);
affiliate_links(id, advertiser_id, product_name, url, commission_pct,
                clicks int, conversions int);
supplement_shops(id, name, logo_url, gym_id null, location, country, region,
                 website, verified bool);
supplement_products(id, shop_id null, brand_id null, name, price, currency,
                    image_url, category, affiliate_url null, in_app_discount jsonb);
```

**RLS base:** el cliente solo lee `advertisements` en estado `active`; las
`ad_impressions`, `coupons` y `affiliate_links` se validan por Edge Function
(nunca incrementes crédito desde el cliente).

### 6.9 Sincronización y jobs

```sql
sync_queue(id, user_id, entity, entity_id, operation, payload_json,
           status, attempts, created_at, synced_at);
scheduled_jobs(id, kind, run_at, payload)          -- o pg_cron
```

---

## 7. Fase 0 — Fundaciones (Semanas 1–2)

**Objetivo:** repo listo, CI verde, marca aplicada, scaffolding oficial.

### Tareas

1. **Repo monorepo**: `apps/mobile` (Expo), `apps/web-b2b` (Next.js vacío),
   `supabase/` (migraciones SQL), `packages/domain` (TS puro).
2. **Scaffolding**: `npx create-expo-app@latest mobile --template blank-typescript`.
3. **Design tokens**: crear `packages/design-tokens` a partir de
   `brand-style-guide.html`: `--teal #2DD4A8, --cyan #22C9E8, --blue #2E6BFF,
--silver #E8EAED→#8B909A, --ember #FF6B4A, --bg #030405, --surface #12161C,
--line #262E37`. Tipografía: Archivo Black + Inter (via expo-font + Google
   Fonts listado de Expo). Íconos: set SVG de línea del brand guide (sin emoji).
4. **CI/CD**: GitHub Actions — `pnpm typecheck`, `pnpm test`, `pnpm lint` en
   cada PR; EAS Build configurado (`eas.json` con profiles dev/preview/prod).
5. **Husky + lint-staged + Prettier + ESLint** con reglas del equipo.
6. **Router + 3 pantallas placeholder**: Home, TabBar inferiore, Perfil.
7. **expo-sqlite** + capa de repositorios (interfaz `IRepo` para testeabilidad).

**DoD Fase 0**

- `pnpm typecheck && pnpm test && pnpm lint` verdes en CI.
- App corre en emulador Android y physical device (Expo Go).
- Pantallas con tokens del brand guide, sin emoji.
- Un PR con cada tarea, código revisado.

---

## 8. Fase 1 — Backend base (Semanas 3–4)

**Objetivo:** Supabase levantado con auth y datos maestros; la app se conecta.

### Tareas

1. **Proyecto Supabase + CLI**: `supabase init`, `supabase start` local, pool
   local para desarrollo.
2. **Migraciones SQL** de 6.1–6.4 + 6.6–6.9 (orden: users→profiles→catálogo→
   retos→gamificación→social→gyms→ads→sync).
3. **Auth**: email+contraseña, Google, Apple (para iOS futuro). Confirmación
   de email. `profiles` auto-creado por trigger en `users`.
4. **RLS**: políticas por tabla:
   - `profiles`: SELECT si `is_public OR auth.uid()=user_id`; UPDATE solo propio.
   - `workout_sessions`: INSERT autenticado (propio), SELECT propio o amigos/grupo.
   - `exercises`, catálogo: SELECT público (lectura).
   - `gyms`: SELECT público, UPDATE solo `owner_user_id` o `GYM_ADMIN`.
   - **Regla**: nunca permitir UPDATE de XP/points desde el cliente.
5. **Seed** de catálogo: 9 ejercicios base (pushups, squats, situps + 6 de
   gimnasio), categorías, plantillas Challenge 30 días, plantilla semanal.
6. **Edge Function `submit_workout`** (esqueleto v1): recibe workout manual,
   valida auth, inserta `workout_sessions(status='manual')` + xp_event +
   streak update. (La versión verificada es Fase 3 con `validate_workout`.)
7. **SyncQueue en la app**: `@react-native-community/netinfo` + cola SQLite;
   concluye `offline → reconnect → enviamos cola → confirmación → resolución
por idempotencia (client_op_id)`.
8. **Conectar Home del MVP**: portar `freshState`/`ProgressionEngine`/
   `applyStreak`/`levelForXp`/`xpForNextLevel`/`ACHIEVEMENTS` a
   `packages/domain` en TS puro con tests unitarios (copiar exacto de app.html
   primero, refactorizar después).

**DoD Fase 1**

- Registro/login fluido en Android; sesión persistida (supabase-js react).
- Crear un workout manual offline → al reconectar → aparece en Supabase.
- 100% de los tests de dominio del port verdes (misma lógica que app.html).
- RLS probadas: un usuario no puede modificar XP/points de otro.

---

## 9. Fase 2 — Motor de retos y gamificación (Semanas 5–6)

**Objetivo:** el loop de app.html completo pero con backend y nuevos tipos de reto.

### Tareas

1. **Home real**: reto del día (ProgressionEngine), stats (nivel/racha/XP),
   XP bar, tarjeta "hoy".
2. **Workout flow**: ejercicio por ejercicio, con **conteo manual rápido
   (counter +) y opción "Verificar con cámara"** (habilita Fase 3).
3. **finishWorkout server-aware**: guardar local si offline → encolar →
   `submit_workout` al sincronizar → server aplica XP/streak/Racha (nunca en
   cliente).
4. **Sistema de niveles + logros** con `requires_verified` (ej: logro
   "Ranking verificado #1" solo con sesiones verificadas).
5. **Racha saludable**: descansos planificados (`health_days` en streak) →
   no rompen la racha; `SafetyEngine` readapta tras 7/14 días sin entrenar.
6. **Challenge semanal - reto 7 días**: `weekly_challenges` (lunes→domingo),
   meta = `+1 rep por disciplina por día` (desde la base del usuario). El
   `ChallengeBuilder` genera el plan.
7. **Retos de incremento +1 por disciplina**: configuración por ejercicio
   `progression: {type:'linear', delta_by:'day', step:1}` con techo de
   `SafetyEngine` (`maxAllowed = last + 3`).
8. **Pantalla "Reto/Calendario"**: camino de 4 semanas, días de descanso,
   historial desde el servidor (cache local).
9. **Pantalla de perfil:**
   - Resumen (nivel, racha, XP, mejor marca por ejercicio).
   - País/región/ciudad detectados (para armar rankings regionales) → editables.
   - Toggle de perfil público/privado.
   - Código de referido.
   - **Verificación de identidad** (foto/selfie). Requerida para sesiones
     verificadas (Fase 3/4).

**DoD Fase 2**

- Loop completo end-to-end: reto → completar → XP/racha → calendario → nivel.
- Descanso planificado no rompe racha (test unitario).
- Reto semanal genera incremento +1/día y se persistie correctamente.
- Offline: completar reto sin red; sincroniza después.

---

## 10. Fase 3 — Cámara verificada en RN + evidencia server-side (Semanas 6–9)

**Objetivo:** el anti-cheat de `index.html` portado a nativo, y la evidencia
respalda el ranking.

### Tareas

1. **Módulo nativo de pose**: `react-native-vision-camera` + bottleneck a ML
   Kit Pose Detection (Android) / Vision (iOS). Salida: 33 landmarks con
   visibilidad + timestamp por frame.
2. **Port de la lógica de conteo** (1:1 desde index.html):
   - Máquina de estados por ángulos + suavizado (media móvil).
   - Confirmación multi-frame (`STATE_CONFIRM_FRAMES`) + `MIN_REP_INTERVAL_MS`.
   - Calibración por persona (`attemptCalibration`, umbrales relativos).
   - Perfiles: frontal (sentadilla, ambas piernas) / lateral (flexiones,
     abdominales, detección automática de lado).
   - Chequeo de postura real (`groundedRatio`, `kneeStandingMargin`,
     alineación de plancha, `torsoHorizontalAngle`).
   - Continuidad (rep timestamps, `MAX_GAP_BETWEEN_REPS_MS=40s`) y aviso de
     ritmo (`SLOW_PACE_WARN_MS`).
   - Liveness tipo hand/hold según ejercicio (momento aleatorio).
3. **Sensor de orientación nativo** (DeviceOrientation → expo-sensors
   `DeviceMotion`): `beta≈90°`, tolerancia 35°, obligatorio para modo
   verificado (sesión no arranca sin confirmar).
4. **Sonido/voz**: beeps + `expo-speech` para los avisos (sin depender de
   síntesis web).
5. **Checks UX**: checklist de landmarks en pantalla, ángulo en vivo, badges
   de estado (vertical/continuidad/liveness).
6. **Evidencia**: al terminar sesión verificada se construye el paquete:
   - `rep_timestamps_ms` + `angles_min_max` + resumen (6.3.1).
   - **collage de landmarks muestreados** (paquete ligero, ~5–8% de frames,
     se guarda en Storage, NO video crudo — privacidad).
   - hash sha256 de los data packs (detección de manipulación).
7. **Edge Function `validate_workout`**:
   - Re-valida: estructura, rangos (>0, <180), continuidad, plausibilidad
     de reps/s (rango humano), patrón de ángulos, hash integrity.
   - Calcula `verified_score` = f(xp_earned, verified_bonus, difficulty,
     reputation del usuario).
   - Escribe `workout_sessions(auth_type='verified')` + `workout_evidence` +
     encola la actualización de rankings (job async).
   - Marca sesiones sospechosas → `verdict='manual_review'`.
8. **Auditoría por muestreo**: job semanal que selecciona N% del **top del
   ranking** + anomalías estadísticas → `workout_evidence.sample_status=
'sampled'` → panel de revisión (Fase 7). Si fraude → puntos revertidos y
   badge de sanción.
9. **Protección cuenta/dispositivo**: fingerprint con hash salado; límite de
   sesiones verificadas/día; anti-multi-cuenta (emails rotativos detectados
   por patrón de fingerprint+device).

**DoD Fase 3**

- Sentadilla/flexión/abdominales contadas por ML Kit nativo (tests de campo
  con 3 tipos de cuerpo).
- Un workout verificado aparece en Supabase con `auth_type='verified'`,
  evidencia guardada en Storage y hash validado.
- Manipular el paquete (editar JSON) → el server rechaza o marca revisión.
- Sesión con pausa >40s → `continuity_ok=false` → no apta ranking.
- El sensor de orientación bloquea sesión si no se confirma en 3s (port del
  comportamiento actual).

---

## 11. Fase 4 — Rankings y temporadas (Semanas 9–11)

**Objetivo:** los rankings que pediste: individual + gym, mundiales,
nacionales y regionales, íntegros.

### Tareas

1. **Cálculo de puntos (rules en `points_rules`):**
   - Sesión manual: base `xp * 0.3` (sigue siendo ranking "libre").
   - Sesión verificada: `xp * 1.0 * verified_bonus(1 + repeticiones_mile) `
     con `multiplier` según categoría del reto.
   - Estrella "rutina": bonus de consistencia (`streak`) multiplicador limitado.
   - **Anti-inflación**: tope de puntos por sesión verificada/día; decay de
     temporadas para que nadie acumule infinito.
2. **Ranking individual por scope:**
   - `global` (mundial), `national` (country from profile), `regional`
     (city/state). Pestañas dentro del ranking screen.
   - Filtro: **"libre" | "verificado"** (nunca se mezclan — tabla separada).
   - Weekly highlights (mejores de la semana).
3. **Ranking de gimnasios** (`gym_rank_entries`): puntos = suma de los
   verificados de sus miembros / raíz(miembros activos) → ranking de GYMS
   mundial/nacional/regional.
4. **Temporadas**: `seasons` por scope con `starts_at/ends_at`; al cerrar:
   - Se "congela" el ranking y se emiten **recompensas** (medallas en perfil,
   - logros de temporada, cupones de marca para top, o cosméticos).
   - `recompute_rankings` job (pg_cron) reconstruye `leaderboard_entries`.
5. **Ranking screen (UI)**: rows con posición, avatar, nombre (o alias),
   puntos, badge "verificado"; pull-to-refresh; página de detalle de usuario
   (perfil público) con historial de sesiones verificadas y evidencia opcional.
6. **Anti-trampa server-side adicional:**
   - Recomptación del puntaje ANTES de mostrar (nunca confiar en el stored).
   - Detección de sesiones idénticas (mismo hash/landmark pack) entre
     usuarios → labor fraud.
   - Límite de sesiones verificadas por IP/device/día.
   - Anomalías de temporada (jumps imposibles) → freezes con revisión manual.
7. **Notificaciones**: "subiste al top 10 de tu región", "la temporada cierra
   en 3 días", "un amigo te superó".
8. **Definir el tamaño de validación de membresía para el ranking de gyms**
   (detalle en 11.8): un socio solo "cuenta" para el ranking del gym si tiene
   ≥2 sesiones verificadas en los últimos 30 días.

### 11.7 Matriz de trampas Y defensas — usuarios (en uso y en ranking)

Cada vector = cómo lo detectamos server-side + qué pasa. Esta matriz se
implementa en la Fase 3–4 (reglas de `validate_workout`, `recompute_rankings`
y los jobs anti-fraude).

| #   | Trampa del usuario                                                         | Capa de detección                                                                                                                                                   | Defensa / respuesta                                                                    |
| --- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| U1  | Reproducir un **video pregrabado**                                         | Liveness aleatorio (hand/hold) + continuidad de timestamps                                                                                                          | Challenger a timing impredecible; si pasa, el server igual valida plausibilidad global |
| U2  | **Otra persona** hace el ejercicio por ti                                  | Comparación biomecánica con tus sesiones pasadas (distribución de ángulos); opcional reconocimiento facial contra el selfie de identidad (consentimiento explícito) | Marca `manual_review` en el top; reincidencia = sanción                                |
| U3  | **Editar el JSON** de la evidencia (inflar reps)                           | Hash SHA-256 + firma HMAC del paquete; re-validador recalcula estructura, gap de timestamps y rep/s en rango humano                                                 | Rechazo automático + `fraud_attempt` en la cuenta                                      |
| U4  | **Ritmo artificial**: tocar botones/cuentas reales pero con meta editable  | Los puntajes se recalcular en server; nunca se confía en `repCount` del cliente                                                                                     | La única fuente de puntos es `validate_workout`                                        |
| U5  | **Múltiples cuentas** para inflar un gym o el propio                       | Hash salado del fingerprint de dispositivo + red IP/segmento + patrón de mails                                                                                      | Detección de clúster → congelar puntajes del clúster y revisión                        |
| U6  | **Bot / emulador / sandbox**                                               | Pose ML Kit no produce personas reales en emulador → `run_mode` registrado; plausibilidad (flujo de ángulos suave, micro-movimientos)                               | Sesión marcada no válida (no puntúa)                                                   |
| U7  | **Sesiones muy largas / horas tramposas** (entrenar a las 3 AM con ánimos) | Ventana de "horario razonable" configurable por país + límite de sesiones/día                                                                                       | Marca de sospecha leve, no rechazo automático                                          |
| U8  | Enviar **la misma sesión repetida** (replay)                               | `client_op_id` idempotente + hash duplicado entre sesiones                                                                                                          | Rechazo de duplicado + alerta                                                          |
| U9  | **Descansos que engañan la continuidad** (cada 39s hay una rep)            | Distribución de gaps entre reps comparada contra la histórica del usuario                                                                                           | Límite máximo de reps "en el límite"; scoring con penalidad de pausas                  |
| U10 | **Ranking con sesiones solo manuales**                                     | Peso manual XP×0.3 y tabla separada (nunca se mezclan)                                                                                                              | Es el diseño de producto: ranking libre vs verificado                                  |

### 11.8 Matriz de trampas Y defensas — gimnasios (en el ranking de gyms)

El ranking de gyms es un objetivo nuevo de fraude (más valor de negocio que
el individual): quien gana, consigue visibilidad para sus patrocinios.

**Regla de membresía activa (base de todo):** un socio **cuenta** para el
ranking de su gym solo si cumple `≥2 sesiones verificadas en los últimos 30
días`. Los integrantes que no cumplen se excluyen del cálculo (no inflan ni
el numerador ni el denominador).

| #   | Trampa del gym                                                                      | Detección                                                                                                                                               | Defensa / respuesta                                                                |
| --- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| G1  | **Gym crea cuentas falsas** de socios que "entrenan" solo lo justo para puntuar     | Fingerprint/red en clúster (U5) + patrón de "activación mínima" repetida (mismas 2 sesiones/semana en horario sospechoso)                               | Clúster congelado; el duo falsos no suman hasta revisión humana                    |
| G2  | **Socios fantasma** que se unen y no entrenan (solo inflan la masa del gym)         | Regla de membresía activa: quienes no cumplen ≥2 verificadas/30 días se excluyen del cálculo                                                            | Exclusión automática del puntaje del gym                                           |
| G3  | **Gym crea un reto "blando"** (config con puntos gigantes) para inflar a sus socios | `points_rules` fijo y común a todos los gyms (el gym no configura puntos; solo el ejercicio y la meta); tope de puntos por sesión                       | El config del reto no altera puntos; el scoring es central y no negociable por gym |
| G4  | **Robo de identidad del gym** (alguien reclama un gym real y cobra sus sponsor)     | Verificación de `owner_user_id`: email de dominio del gym, prueba de administración (foto de instalaciones), revisión manual                            | Solo `verified=true` puede editar el gym y crear campanas                          |
| G5  | **Bot de autounión de miembros** para llegar a masa crítica                         | Rate limit de `join` por IP/device + validación de captcha en el primer join                                                                            | Límite de bajas/altas; validación del primer join                                  |
| G6  | **Un usuario suma puntos a muchos gyms a la vez** (afiliado masivo)                 | Límite de membresías activas por usuario (configurable, ej. 3) + conteo de "solo para sumar" (mínimo de sesiones del propio usuario fuera de esos gyms) | Top de membresías; low "afiliado nomás" no puntúa para el gym                      |
| G7  | **Salto brusco de puntos del gym** entre re-computes                                | Comparación delta del re-compute + alerta PostHog                                                                                                       | Freeze del ranking del gym + revisión de composición                               |
| G8  | **Gym paga por ranking patrocinado y confunde posición real**                       | `sponsored_rankings` con etiqueta "Presentado por X" + separación visual total                                                                          | Regla dura de producto: patrocinio ≠ posición; sin mezcla                          |
| G9  | **Diferencias de tamaño injustas** (gym 2 socios vs gym 500 socios)                 | **Divisiones por tamaño (ligas)**: p.ej. <25, 25–99, 100–499, 500+ socios activos                                                                       | Cada liga tiene su propio ranking (mundial/nacional/regional)                      |
| G10 | **Composición no auditable** de los puntos del gym                                  | Vista "desglose": lista de socios que aportan (público/agregado con permisos)                                                                           | Transparencia total en api + panel B2B                                             |

**Regla transversal:** todos los eventos de puntaje (usuario y gym) se guardan
en `xp_events`/`points_audit` (append-only) y las acciones de fraude en
`fraud_events` para trazabilidad y apelaciones.

**DoD Fase 4**

- Endpoint/pantalla muestra los 3 scopes con datos reales coherentes.
- Sesión manual vs verificada NO se mezclan en la misma tabla de puntos.
- Fecha de temporada → al cerrar se congela, recomputa y notifica.
- Tests: manipular puntaje vía API directa → server rechaza / revierte.
- Ranking de gimnasio refleja sumas verificadas reales.
- Tests de matriz: un gym con 5 cuentas falsas del mismo dispositivo → clúster
  detectado y excluido; un socio fantasma sin ≥2 verificadas/30 días no suma;
  un clúster o saltos bruscos disparan freeze + revisión.

---

## 12. Fase 5 — Retos semanales y retos "+1 por disciplina" (producto)

**Objetivo:** la mecánica central de retención que pediste.

### Tareas

1. **Reto semanal global** (todos los usuarios): misma disciplina todas las
   semanas (rotación pushups→squats→situps→…), meta = tu base + 7 (una por
   día). Registro de participantes y progreso semanal.
2. **Reto "+1 por disciplina":** para cada disciplina que el usuario elija,
   la meta diaria = última marca + 1 (o configurable `daily|weekly` según
   `progression.delta_by`). El `ChallengeBuilder` del día usa esto.
3. **Retos de gimnasio (B2B)**: el gym crea reto propio con template; los
   socios se unen por QR o código; ranking interno del gym.
4. **Retos flash**: 24–48h de duración (ej. fin de semana), con recompensa
   extra; vía `gym_events(kind='flash')`.
5. **UI de retos**: pestaña "Retos" (semanal vigente, gimnasio, flash, +1 por
   disciplina), estado de avance, CTA entrar.

**DoD Fase 5**

- Un usuario se une a reto semanal, hace 1 sesión/día, la meta sube +1/día.
- El ranking del reto semanal refleja progreso de participantes.
- Un gym crea reto y socios se unen por QR (hola). Se aísla por gym.

---

## 13. Fase 6 — Social (Semanas 12–13)

> **Núcleo del segmento amateur:** amigos + retos de amigos son el gancho de
> retención del usuario casual que no compite por rankings verificados. Los
> rankings y la verificación son el "modo competitivo"; esto es el **"modo
> pareja/grupo"**: simple, privado y sin presión pública. El amateur recién
> llegado entra por aquí antes de atreverse con el ranking.

### Tareas

1. **Agregar amigos**: búsqueda por nombre/código de usuario, QR propio, opt-in
   de contactos y sugerencias del círculo. Solicitudes + lista de amigos.
2. **Retos entre amigos (duelos 1vs1)**:
   - Crear duelo: disciplina + meta (repeticiones o "+1 semanal") + fecha
     límite ("este domingo"). Se elige **verificado** (cámara) o **casual**
     (manual).
   - El amateur decide el nivel de compromiso: si es verificado, suma marca
     verificada y es el ensayo ideal para el ranking; si es casual, no suma al
     ranking público (privacidad por diseño: `friend_duels` visible solo al
     grupo, RLS).
   - Notificación al crearse, al 50% del avance y al resultado; historial de
     duelos con racha ganada.
   - **"Modo sombra"**: enfrentarse a la mejor marca del amigo en los últimos
     7 días sin que el amigo tenga que aceptar (gamificación sin fricción).
   - Recompensa: XP de duelo (controlada en `points_rules`, sin desbalancear
     el ranking) y **tarjeta de compartir del duelo** (expo-image) → UGC
     orgánico de la pareja.
3. **Retos grupales de amigos**: grupo 3–10, meta común con contador en vivo y
   leaderboard del grupo (solo los miembros lo ven).
4. **Racha en grupo**: si todos entrenan hoy, bonus XP; si uno corta, se
   avisa (no los castiga a todos).
5. Muro de actividad (solo sesiones verificadas o manuales públicas) +
   reacciones (emojis controlados, no chat libre).
6. Compartir logro fuera de la app (card generada con expo-image).
7. Notificaciones sociales (solo eventos de amigos/duelos, sin spam general).

**DoD Fase 6:** 2 usuarios pueden hacerse amigos por código/QR, crear un duelo
1vs1 verificado y uno casual (ambos con progreso y resultado correctos), un
grupo de amigos ve su leaderboard interno con RLS respetada (jamás público) y
una tarjeta de duelo es compartible fuera de la app.

---

## 14. Fase 7 — B2B: Gimnasios y Panel Web (Semanas 13–15)

### Tareas

1. **Registro de gimnasio** (plan free/pro), verificación manual (admin).
2. **QR de membresía**: el gym imprime QR (solo uuid opaco) → el socio
   escanea → `gym_members` → puede competir en `seasons(scope='gym')`.
3. **Panel web B2B (Next.js `apps/web-b2b`)**:
   - Dashboard de socios activos, retención, ingresos.
   - Crear/editar retos propios, eventos flash, rankings internos.
   - Reportes de sesiones verificadas por socio (vista de auditoría).
   - Gestión de campañas (anunciar su gym en la app).
4. **Moderación de "ranking gym"**: reclamar tu gym como dueño (email de
   dominio o verificación administrativa).
5. **PLAN Pro**: billing manual B2B (fuera de Play, factura simple) → habilita
   dashboard avanzado + analytics.

**DoD Fase 7:** un gym real puede registrarse, imprimir QR, sumar socios,
crear retos y ver reportes con datos reales de Supabase.

---

## 15. Fase 8 — Monetización completa (Semanas 15–17)

### 15.1 Anuncios in-app (AdMob + UMP)

1. **Google AdMob** app-id + unidades: banner (Home), interstitial (entre
   ejercicios, post-entrenamiento con límite de 1/5 min), **rewarded**
   ("mirá un video y ganá un descanso extra / bonus XP diario").
2. **UMP consent**: para usuarios EEUU/EU/UK — mostrar TODO test; sin
   consentimiento → sin ads personalizados (solo contextuales o ninguno).
3. **Menores 13–17**: publicidad solo "Familias" apropiadas (política Play);
   **PG13+** gating; nunca rewarded para menores.
4. Estados: `npa=1` respeta la política de consentimiento.

### 15.2 Publicidad de gimnasios, tiendas y marcas de suplementos

5. **Gimnasios**: `advertisements(advertiser_type='gym')` → tarjeta destacada
   en Home/Mapa "Gimnasios cerca", targeting por geo (`ad_campaigns.geo_target`).
6. **Tiendas de suplementos locales**: ficha establecimiento con mapa +
   cupón de descuento in-app (Cupon digital con `coupons.code`), deep-link a
   su web/tienda.
7. **Marcas de suplementos**: "Reto del mes presentado por [Marca]" →
   `sponsored_challenges` con etiqueta obligatoria; campaña con código
   promocional `SUPLEMENTO10` en la ficha; y **afiliación** (`affiliate_links`)
   con comisión (ej. Amazon Associates / tienda oficial): enlaces comisionados
   en fichas de productos recomendados dentro del plan de entrenamiento.
8. **Ad placement engine (server-side)**: para un usuario + geo + momento →
   devuelve el ad activo de mayor CPM compatible (sin tocar integridad del
   ranking). Impresiones con `ad_impressions` para facturar CPM.
9. **Reporte B2B**: dashboard del anunciante (clics, impresiones, cupones
   usados, conversiones) → `ad_campaigns` + `ad_impressions` + `coupons`.

### 15.3 Premium y consumibles

10. **Premium (suscripción)**: React Native Purchases (RevenueCat) con
    productos: `premium_monthly`, `premium_annual` (flujo: sin ads,
    estadísticas avanzadas, equipo de entrenamiento +, contenido premium,
    cosméticos).
11. **Entitlement en backend**: `entitlements(user_id,key='premium')` validado
    por webhook de RevenueCat/Play; **nunca en cliente**.
12. Los gimnasios Pro (B2B) no pasan por Play: factura manual/stripe.

### 15.4 Reglas de monetización ética

- Los anuncios NUNCA cubren botones críticos ni durante el entrenamiento
  verificado (el conteo no se interrumpe).
- El reto del día y el ecosistema Gym son gratis para siempre.
- El ranking verificado NUNCA se puede acelerar con dinero.

### 15.5 Facturación B2B fuera de Play (flujo de dinero y reglas)

El B2B no pasa por Play (15.3.12), lo que obliga a operar el ciclo de pago
propio. Así se hace con mínima inversión y máximo orden:

1. **Vías de cobro por región** (sin necesidad de abrir empresa ya):
   - **LatAm**: MercadoPago (checkout/link de pago + suscripciones; es el
     estándar regional y cubre PSE/Pix-OXXO según el país del pagador).
   - **Global**: Stripe (tarjeta + Apple Pay/Google Pay en la web del panel B2B).
   - **Anuales grandes**: transferencia bancaria directa + factura.
2. **Facturación**: comprobante simple electrónico por país (MercadoPago/Stripe
   emiten comprobante automático en la mayoría de regímenes; recibo si se opera
   como persona física). **Gate de formalización**: registrar empresa/RFC/RUT
   cuando MRR B2B supere ~300 USD recurrentes — el ingreso no se bloquea por
   burocracia antes de eso.
3. **Contrato de 1 página** firmable digitalmente: alcance del plan, derechos
   de uso de campañas y logo del gym/marca, privacidad de datos de socios,
   rescisión, y reembolso **pro-rata** (campaña ya entregada no reembolsable).
4. **Ciclo de cobro**: tablas `billing_invoices` (issued→paid→overdue→refunded)
   y `billing_recurrence`; webhook de MercadoPago/Stripe al pagar → se activan
   features del panel Pro; corte por falta de pago a los 15 días de vencido.
5. **Regla dura: cobrar antes de servir.** Ninguna campaña ni panel Pro se
   activa sin el primer pago confirmado (evita "gyms que apilan deuda").

**DoD Fase 8**

- Ads servidos solo con consentimiento válido; rewarded funciona y otorga
  bonus controlado por el backend.
- Un gym/tienda/marca puede crear campaña desde el panel y ver reportes.
- Suscripción Premium otorga entitlement vía webhook y desbloquea features.
- Impresiones y cupones facturables con datos reales en Supabase.

---

## 16. Fase 9 — Entrenador IA (Semanas 17–19)

> Según `IA_ENTRENADOR.md`. MVP primero en la nube (rápido), luego local.

### Tareas

1. **MVP nube**: Edge Function `coach_chat` (o llamada a API) con el system
   prompt del punto 10 del doc + `ContextBuilder` (bloque JSON del perfil).
   El LLM nunca decide progresión. Streaming vía SSE/Realtime.
2. **Disparadores** (ya existen en el cliente): `announceSessionStart`,
   `checkRepCheckpoints` (50%/80%/meta) → comentario del coach.
3. **Elección de modelo on-device** (si se prioriza local): Qwen3.5-2B GGUF
   (~1.5GB) o Qwen3.5-0.8B (gama baja); descarga con Play Asset Delivery o
   descarga propia + tarjeta de selección por RAM. Integrar como módulo nativo
   en Android (llama.cpp) — iOS limitado, evaluar cloud ahí.
4. **Selección automática por gama** de dispositivo; fallback a mensajes de
   plantilla (sin IA rota).
5. **Privacidad**: nada del historial del chat se sube si está en modo local;
   si es cloud, minimizar contexto.
6. **Corpus verificado on-device** (sección 16.1): documentos comprimidos de
   nutrición/ejercicio/anatomía/bienestar; el coach responde solo con el
   corpus aprobado (RAG estricto), sin salirse del dominio.

**DoD Fase 9:** el coach reacciona al completar hoy con datos frescos del
perfil, en <1.5s (cloud) o <2s (local), sin errores de inventar datos.

---

## 16.1 Conocimiento cerrado del Entrenador IA (corpus verificado y hardwired)

> Directiva del PO (2026-09-06) + consulta a [CV], [MOB], [BE]/[SRE], [SEC],
> [QA] y [LEG]. Decisión de arquitectura: corpus **on-device** (~2–6 MB),
> compatible con la directiva D7 (cero infraestructura pagada).

### Qué significa "hardwired" (no puede salir de ahí)

1. La IA **solo aconseja** dentro de: entrenamiento, ejercicios, anatomía,
   nutrición y bienestar. Si la consulta es ajena: respuesta de plantilla y
   trae la charla de vuelta al tema.
2. El conocimiento sale **únicamente** del corpus verificado (documentos
   reales de médicos, nutricionistas, deportólogos). RAG estricto: la
   respuesta de salud/entrenamiento se arma solo con el fragmento (chunk)
   recuperado del corpus; nunca de "memoria general" del modelo.
3. Sin chunk del corpus → plantilla segura fija ("no tengo información
   verificada sobre eso; consultá a un profesional de la salud"). Prohibido
   inventar datos de dieta, ejercicio o salud.

### Dónde vive el corpus

- **Dentro de la app, comprimido (~2–6 MB)**: lectura 100% local, offline,
  privada y sin costo de servidor. El modelo local (Qwen3.5) lee de su
  paquete de conocimiento del dispositivo, no por red.
- **Actualizaciones**: el corpus se versiona y viaja con el release de la
  app; opcionalmente un delta firmado se descarga cuando hay conexión
  (free tier de storage, sin base propia del corpus).
- **Se evita consultar un servidor para responder**: nada de costo,
  latencia, dependencia de red o exposición del historial del usuario.

### Cadena de verificación del conocimiento

1. Cada documento entra por **autor verificado**: título, especialidad,
   matrícula/firma y fecha (ej. "Lic. en Nutrición — M.N. 1234").
2. Revisión previa a publicar: [QA] valida integridad del corpus; [CSC]
   valida redacción clara para el usuario; **el PO da el OK final** de cada
   publicación de versión.
3. **Manifiesto con hash firmado** ([SEC]): el corpus no se altera ni en el
   dispositivo ni en tránsito; si el hash no matchea, se rechaza la
   actualización y se usa la última versión íntegra.
4. Versionado: cada corrección o doc nuevo sube versión; el chat muestra
   "dato del corpus vX.Y" cuando aplica.

### Reglas legales ([LEG])

- Posicionamiento: **coach de bienestar y entrenamiento**; explícitamente
  NO es asesor médico: sin diagnósticos, sin tratamiento, sin prometer
  resultados.
- Disclaimer visible en el primer uso del chat y repetido ante temas de
  salud ("esto no reemplaza a un profesional de la salud").
- Las fuentes acreditadas se publican (transparencia), alineándose con las
  políticas de salud de Play Store y la normativa local.
- Preguntas de dolor intenso, lesión, mareos o dificultad respiratoria →
  detener el ejercicio y derivar a un profesional. Siempre.

### DoD de esta sección

- 100% de las respuestas de entrenamiento/salud/nutrición con chunk del
  corpus; cero alucinaciones en pruebas [QA].
- Consulta fuera de tema o sin chunk → plantilla segura en ≤1 turno.
- Manifiesto firmado verificado en cada release ([SEC]).

---

## 17. Fase 10 — Play Store y cumplimiento legal (Semanas 19–20)

### Tareas

1. **Cuentas**: Google Play Console (pagador verificado), AdMob, RevenueCat,
   Supabase producción (duplicados: `supabase production` project).
2. **App Bundle** vía EAS Submit (`eas.json` prod) → `.aab` firmado con
   **App Signing de Play** (crear upload key, guardar privada en secreto).
3. **Target API level**: cumplir el nivel requerido del año (SDK 35+);
   hacer el **Data safety form** (cámara, sensores, ubicación aproximada,
   almacenamiento, ads).
4. **Política de privacidad y Términos**: página pública (URL en consola) +
   enlace dentro de la app. Responsable de datos / contacto.
5. **Content rating**: PEGI/SK→13+ (publicidad de suplementos apta solo 13+);
   **targeting 13+**; si se declara para menores → aplicar "Familias".
6. **Consentimiento UMP** activo (EU/UK/EEUU).
7. **Testing on-device obligatorio** (Fase de revisión): Testflight & Play
   closed track con el checklist del plan de calidad (sección 18).
8. **Ficha store**: título "ResiliencIA — Retos y entrenamiento verificado",
   ícono (del logo), capturas (6+ config), eligbo texto español castellano,
   categoría "Salud y bienestar" + "Deportes". Full description localizada
   (ES/EN/PT).
9. **Pre-lanzamiento**: closed testing 12+ testers activos 14 días (Play exige
   para cuentas nuevas no verificadas usen play console).
10. **Lanzamiento**: production rollout por etapas (10% → 50% → 100%).
11. **Landing + waitlist** (Vercel, gratis) con los 3 pilares del mensaje
    (sección 23.1) y capture de email **antes** del día del lanzamiento.
12. **Assets de marketing**: los del cuadro de lanzamiento de la sección 23
    (demo 15–30 s, kit QR por ciudad, guion de nota local, pitch B2B, kit de
    influencers) producidos y probados en la PR del release.

**DoD Fase 10:** bundle en producción aprobado, con política/términos,
data-safety y consentimiento; **ingresos testeados** (compra real sandbox);
**landing + waitlist online** y bundle de assets de marketing listo (23).

### 17.1 ASO — la ficha que convierte (detalle)

La ficha de Play es la página de aterrizaje más visitada: la mayoría decide por
ficha/ícono/capturas.

1. **Título (30 car.) + subtítulo (30 car.)**: formato marca + beneficio en
   título ("ResiliencIA — Retos fitness verificado"); el subtítulo es la
   bolsa de keywords ("Cuenta repeticiones con cámara"). Play combina ambos
   para búsqueda.
2. **Keywords (loop continuo)**: Play Console → _Búsqueda/descubrimiento_ →
   queries que ya generan impresiones; apuntar long-tail ES: "app para contar
   flexiones", "contar sentadillas con cámara", "reto fitness verificado",
   "reto de amigos". Churn por release: el ASO es un loop, no un 1-shot.
3. **Ícono**: legible a 7 mm (tamaño real de lista), alto contraste de la
   marca, sin texto pequeño; testear con _Experimentos de ficha_ de Play
   (gana el que sube impresiones→instalaciones).
4. **Capturas + video (30 s recomendado)**:
   - 1ª captura = hook en 4 segundos ("¿Dejás que la app te cague con tus
     repeticiones?", "El reto que cuenta por cámara").
   - Secuencia narrativa: verificación → reto semanal → ranking justo →
     amigos/duelos → gimnasio → premium. Localizar captions: ES-419/EN/PT-BR.
5. **Descripción**: 2–3 párrafos de propuesta + diferenciador (verificación
   real = ranking justo); bullets de features con keywords naturales. La
   búsqueda genérica la gana quien explica mejor.
6. **Reseñas (la métrica social de Play)**: pedir reseña in-app SOLO en logros
   (racha de 7 días, duelo ganado), nunca al azar; responder todas (señal al
   algoritmo + confianza).
7. **Localización de ficha y precios**: cuando la "ciudad faro" sea MX o BR,
   activar store listing localizado con precios locales (no USD al peso).
8. **KPI de ASO**: conversión impresiones→instalaciones (meta **8–12%** en la
   ficha ES) y queries top por mercado; revisar mensual post-lanzamiento.

### 17.2 Reembolsos y atención al cliente (reglas)

1. **Play Billing (consumidores)**: los reembolsos los tramitan las tiendas
   (ventana de 48 h; en UE rigen los 14 días de retracto). La app solo debe:
   recibir el **webhook de reembolso** → revocar entitlement en backend
   (nunca en cliente) y registrar `refund_events`.
2. **Reducir "malas compras"**: trial de 7 días para Premium; pantalla de
   confirmación con precio claro y botón "probar gratis" destacado; sin
   trampas de cancelación (cumplir política de transparencia de Play).
3. **Soporte**: canal único `soporte@resiliencia.app` + FAQ pública; SLA de
   72 h; triaje por tipo (compras / ads / trampas / B2B).
4. **B2B**: reembolso pro-rata según contrato (15.5.3); campaña ya entregada
   no es reembolsable (trabajo realizado).
5. **Métricas**: % de reembolsos (meta <3% mensual), encuesta de motivo en la
   baja, tiempo de resolución — revisar en cada release. Si reembolsos >5%,
   frenar promos agresivas antes que el producto.

---

## 18. Calidad permanente (todas las fases)

### 18.1 Testing

- **Unit**: `packages/domain` (ProgressionEngine, SafetyEngine, ChallengeBuilder,
  StreakEngine, validador de plausibilidad) — Vitest.
- **Integration**: Supabase local + supabase-js; RLS test suite (rol anon vs
  autenticado); edge functions con `supabase functions test`.
- **E2E**: Detox (Android) para flujos críticos: onboarding→reto→verificado;
  suspender caso offline → sync.
- **Field testing de pose**: tabla de validación con 5 perfiles (adulto,
  adolescente, gama baja) y 5 ejercicios → umbrales de calibración OK.

### 18.2 Seguridad (base)

- RLS como última línea; edge functions nunca confían en inputs.
- Hash + firma HMAC de paquetes de evidencia.
- Rate limiting en funciones públicas (Upstash / Supabase built-in).
- Secrets en `supabase secrets` + EAS env files (nunca en repo).
- Revisión de dependencias (`pnpm audit` en CI).

### 18.2.1 Revisión de vulnerabilidades del prototipo actual (hallazgos reales)

La revisión se hizo sobre `app.html` e `index.html` tal como están hoy.
Todas las vulnerabilidades se cierran naturalmente al portar a React Native

- backend, salvo las señaladas que requieren regla explícita de desarrollo:

| #   | Hallazgo                                                                                                                                                                                                                                                                          | Ubicación                     | Severidad                             | Cómo se mitiga en la app nativa                                                                                                                                                                              |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| V1  | **XSS por inyección del nombre**: el nombre del input se interpola en `innerHTML` (`${state.profile.name}`, `${onboardData.name}`) sin escapar. Hoy es self-XSS local; si ese nombre se sincroniza y se renderiza a otros (grupos, muro, ranking), se convierte en **stored XSS** | `app.html` 351, 384, 436, 612 | Media hoy → **Alta si es compartido** | RN renderiza texto UTF-8 sin `innerHTML` → irrelevante. Regla dura: **prohibido interpolar input en contenedores raw**. En cualquier vista web (landing, PWA de preview) escapar/sanitizar siempre           |
| V2  | **`JSON.parse` sin `try/catch`** sobre localStorage: un estado corrupto crashea todo el arranque                                                                                                                                                                                  | `app.html` 259                | Baja                                  | Capa de repositorio con parse validado + versión de esquema + migraciones                                                                                                                                    |
| V3  | **localStorage manipulable**: XP, racha, `repCount` y timestamps editables desde DevTools. El cliente no es fuente de verdad                                                                                                                                                      | `app.html`/`index.html`       | Media                                 | El servidor **recalcula** puntos/validación (sección 4.1); el cliente solo propone. Ya es regla del plan                                                                                                     |
| V4  | **Cadena de suministro del CDN**: MediaPipe se importa por ES module y el modelo `pose_landmarker_lite.task` se descarga en runtime desde `storage.googleapis.com`, sin pin de hash/`integrity`. Riesgo de tampering del modelo                                                   | `index.html` 165, 735, 739    | Media                                 | Nativo: ML Kit se **empaqueta con la app** (Play entrega los assets). Para la vista web: versión exacta fijada + `integrity` donde el formato lo permita + hash del `.task` verificado antes de cargar + CSP |
| V5  | **Sin Content-Security-Policy** (no aplicable en `file://`; se asume hosting futuro)                                                                                                                                                                                              | `index.html`                  | Baja                                  | En la web/preview: CSP estricta (sin `unsafe-inline`, sin `eval`)                                                                                                                                            |
| V6  | **`innerHTML` con contenido dinámico** en checklist/badges (hoy solo constantes; si algún tag se vuelve dinámico → vector)                                                                                                                                                        | `index.html` 881–882          | Baja                                  | Preferir `textContent`/`createElement`; nunca texto de usuario en `innerHTML`                                                                                                                                |
| V7  | **Sensor de orientación spoofeable**: en desktop se puede emular `deviceorientation` (mock), y la sesión depende solo de `beta`                                                                                                                                                   | `index.html` 1276–1288        | Baja (web) → N/A (nativo)             | Nativo: eventos `DeviceMotion` del SO + plausibilidad server-side como respaldo (reps/s, gap)                                                                                                                |
| V8  | **Privacidad de la evidencia**: los landmarks compartidos identifican biomecánicamente a la persona                                                                                                                                                                               | —                             | Privacidad                            | Seudonimizar + **retención de 30 días** (borrado automático) + consentimiento explícito en el flujo de verificación                                                                                          |
| V9  | **Sin fingerprinting anti-multi-cuenta** en el prototipo                                                                                                                                                                                                                          | —                             | Baja                                  | Tabla `devices` con hash salado (esquema 6.1) en Fase 3.9 + rate limiting                                                                                                                                    |
| V10 | **Exposición de reputación**: la sesión verificada depende de credenciales de cámara; un video pregrabado pasa liveness una vez                                                                                                                                                   | `index.html` (liveness)       | Media                                 | Ya está cubierto por la estrategia de escalamiento: evidencia + auditoría por muestreo + anomalías server-side (sección 10.8)                                                                                |

### 18.2.2 Endurecimientos adicionales (producción)

- **Pinning de assets ML**: hash del `.task`/de los modelos comprobado en el primer arranque.
- **ATS/TLS**: todas las llamadas a Supabase sobre HTTPS con certificados válidos; sin excepciones.
- **Sanitización de entradas** (nombre, alias, mensajes): longitud + caracteres permitidos en API.
- **Rate limiting y throttling** por usuario/IP en todas las Edge Functions públicas.
- **Detección de emulador/sandbox**: los emuladores no generan pose real de persona → marcar y no validar.
- **Auditoría de XP** (`xp_events`) para detectar manipulación de la máquina de puntos.
- **Privacidad por diseño (datos biométricos)**: los landmarks crudos **no se
  guardan**. Se persisten solo características agregadas (ángulos/conteos por
  ventana), el hash del paquete y una muestra mínima para auditoría muestreada
  (ver 10.8). Esto reduce el riesgo legal (GDPR/LGPD: biometría = dato
  sensible) y el volumen de Storage a la vez.
- **`ad_impressions` partitionada por mes** (partición PostgreSQL) y limpieza
  de filas agregadas al cerrar mes: es la tabla de mayor volumen de escritura;
  sin particionar, el plan free se llena de registros muertos.
- **Sincronización offline**: `client_op_id` + regla last-write-wins por
  entidad y tombstones para los borrados (evita que un dato borrado "reviva"
  al sincronizar).
- **Secretos**: nunca en el bundle (Sentry/PostHog/AdMob se inyectan vía EAS env y se ofuscan); claves de servicio solo en el servidor.
- **2FA opcional + recovery codes** para cuentas que compiten por premios (top rankings).

### 18.3 Analytics & observabilidad

- PostHog: eventos (onboarding completado, reto verificado, racha, premium,
  impresiones ads) con privacy-by-design (no PII innecesaria).
- Sentry (crash) + serverless logs de Edge Functions; alertas de fraud (jump
  de puntos).

### 18.4 Rendimiento

- ML Kit en GPU; la sesión verificada a 60fps objetivo, mínimo 30.
- Caches locales para catálogo; lazy-load de imágenes (expo-image).
- Bundle JS por pestaña (lazy routes de Expo Router).
- **Batería/temperatura (punto crítico en gimnasio)**: limitar frames
  procesados (ej. 20–30 fps de inferencia con interleave de captura),
  capa de **sesión de máximo ~30 min continuos** con aviso, apagado del
  canvas en segundo plano y medición de thermal headroom (expo-device /
  API de nivel térmico) para degradar suavemente.
- **Dual-write SQLite↔Supabase**: idempotencia por `client_op_id`, verificar
  conflicto de esquema a nivel de migraciones compartidas; las Edge Functions
  tratan cada request como atómico (sin confiar en estado del cliente).

---

## 19. Lanzamiento a costo CERO y operación

### 19.1 ¿Es posible lanzar a 0 coste? Sí, con dos matices honestos

**Cero coste recurrente: sí.** Toda la infraestructura entra en planes
gratuitos. Las dos únicas excepciones que no tienen vuelta:

1. **Google Play Console: US$25 (pago único)** al registrar la cuenta de
   desarrollador. Es el único desembolso de dinero de todo el proyecto.
   (Sin esto no se puede publicar en Play Store.)
2. **Verificación de identidad + datos fiscales/bancarios** para _cobrar_:
   AdMob y las ventas requieren que la cuenta esté verificada y con datos de
   pago (no es un costo, pero hay que hacer el trámite; depende del país,
   puede ser persona física o empresa).

Con eso claro, **el resto es gratis de verdad**, siempre que cada servicio se
mantenga dentro de su capa gratuita (ver 19.2) y se apliquen las
mitigaciones de 19.3.

### 19.2 Tabla de recursos a costo cero

| Recurso                               | Plan gratis             | Límite inicial (holgado para el arranque)                                                                                      | Riesgo si se supera                                                      |
| ------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| Supabase                              | Free                    | 2 proyectos (dev + prod), DB 500 MB, **Storage 1 GB**, Auth 50K MAU/mes, **Edge Functions 500K invoc./mes**, Realtime incluido | Proyecto free se **pausa tras 7 días de inactividad** (mitigado en 19.3) |
| EAS Build/Submit                      | Free                    | 30 builds/mes en infra compartida; submit sin cargo                                                                            | Cola de espera en builds                                                 |
| GitHub (repo privado)                 | Free                    | 2.000 min de Actions/mes (CI)                                                                                                  | Moderación: solo CI en PR y `main`                                       |
| Vercel (panel B2B + hosting)          | Hobby                   | Web del panel, páginas estáticas, **cron** (despierta Supabase), hosting de Política de Privacidad y Términos                  | 100 GB de bandwidth/mes                                                  |
| Expo (updates/OTA + push)             | Free                    | Updates OTA + push sin cargo                                                                                                   | —                                                                        |
| AdMob                                 | Gratis                  | Integración US$0; **genera** ingreso (payout de cada país)                                                                     | Requiere cuenta verificada + ads.txt + política de privacidad            |
| RevenueCat                            | Free hasta ~US$2.5k MRR | Wrapper de billing                                                                                                             | Migrar a plan pago cuando se supere                                      |
| PostHog cloud                         | Free                    | 1M eventos/mes                                                                                                                 | Self-host o plan pago                                                    |
| Sentry                                | Free                    | 5K errores/mes                                                                                                                 | —                                                                        |
| Google Fonts + íconos del brand guide | Gratis                  | Sin límite                                                                                                                     | —                                                                        |

**Total recurrente: US$0/mes.**

### 19.3 Mitigaciones específicas del plan gratis (para que no "aparezcan" costos)

1. **Pausa del proyecto por inactividad (Supabase free)**: programar un
   **cron en Vercel cada 20–30 min** que invoque una Edge Function mínima
   (`healthz`). Las llamadas "despiertan" el proyecto y evitan la pausa.
   Costo: una fracción mínima de la cuota gratis de Edge Functions.
2. **Backups sin PITR (el plan free no trae point-in-time)**: cron semanal en
   Vercel que corre un `pg_dump` del esquema + datos críticos → a un bucket
   de **Supabase Storage** (persistente aunque se pause el proyecto). En el
   arranque, esto **sustituye al PITR del plan Pro**.
3. **Storage de evidencias limitado a 1 GB**: las evidencias se
   **seudonimizan y caducan en 30 días** (job de retención, regla de
   producto de privacidad). El ranking conserva solo hashes y resúmenes →
   el Storage gratis nunca se llena.
4. **No gastar minutos de CI**: `pnpm` cacheado, builds de EAS por fuera de
   Actions, y workflows solo en `push/PR` a `main`.
5. **Monitorear topes** (PostHog alertas): cuando una métrica se acerque al
   techo (DB, Edge Functions, MAU), migrar ese servicio a pago **con el
   ingreso que la app ya está generando** — nunca se paga infra antes de
   tener ingresos.

### 19.4 Flujo de dinero: 0 → ingresos → escala

1. Fases 0–7: se construye **sin comprar nada** (todo gratis de 19.2).
2. Fase 8: se activan AdMob, patrocinios B2B y Premium → **empieza a
   generar ingresos sin pagar infraestructura**.
3. Cuando se acerque a algún techo gratis, se migra a plan pago **usando el
   dinero que la app ya produjo** (ej. Supabase Pro ~US$25/mes, sentry/pghog
   paid según volumen).
4. El B2B (gimnasios Plan Pro, campañas de marcas) genera ingresos directos
   sin pasar por Play → esos fondos también cubren escala.

### 19.5 Costos en escala (una vez con ingresos)

| Recurso             | Costo con escala                                                    |
| ------------------- | ------------------------------------------------------------------- |
| Supabase (Pro)      | ~25 USD/mes → 200 USD/mes                                           |
| EAS (builds)        | 0 → 50 USD/mes                                                      |
| RevenueCat          | 0 → plan pago (~0–100 USD)                                          |
| PostHog/Sentry paid | según volumen (~0–100 USD)                                          |
| Vercel (panel B2B)  | 0 → 20 USD/mes (Pro)                                                |
| **Total**           | **hasta ~300–500 USD/mes, cubierto por el ingreso de ads/subs/B2B** |

**Backups:** cron `pg_dump` semanal a Storage (costo 0) desde el día 1; en
escala, activar PITR de Supabase Pro como respaldo adicional.

### 19.6 Escalabilidad paso a paso según usuarios y publicidad

Escalera concreta de "cómo crece el costo a medida que crece la app y la
publicidad". Los números son **estimaciones conservadoras** (el costo real
depende de uso; el disparador de migración manda por encima del MAU previsto).

| Tramo                | Usuarios MAU | Planes activos                                                                                                                 | Costo servir           | Ingreso publicidad estimado (mercado B2C)                                         | ¿Cuándo migrar al siguiente? (disparadores)                                                     |
| -------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| **T0 — Lanzamiento** | 0–500        | Todo gratis (19.2): Supabase free, EAS free, Vercel hobby, AdMob, RevenueCat free                                              | **US$0/mes**           | 0 o mínimo                                                                        | —                                                                                               |
| **T1 — Validación**  | 500–2K       | Supabase free + monitoreo PostHog de topes                                                                                     | **US$0/mes**           | Ads bajando (eCPM 1–3 USD); sponsor B2B local                                     | DB >40% de 500 MB, Edge Functions >40% de 500K, o Storage >600 MB → pasar a T2                  |
| **T2 — Crecimiento** | 2K–10K       | **Supabase Pro (~25 USD/mes)**; RevenueCat sigue free (<$2.5k MRR); Vercel Pro opcional (~20)                                  | **~25–50 USD/mes**     | eCPM 2–5; primer empaquetado de campañas B2B (gym/tienda) en ~1.000 USD/mes bruto | MAU >10K, DB >2 GB, o RevenueCat cerca de $2.5k MRR → T3                                        |
| **T3 — Escala**      | 10K–50K      | Supabase Pro + escala (add-ons DB/Storage); EAS paid (~50); RevenueCat paid (~0–100); PostHog paid (~50)                       | **~150–300 USD/mes**   | RevenueCat supera $2.5k MRR; ads eCPM 3–6 + campañas B2B sostenidas               | Latencia/fila en Edge Functions esporádicas o topes de Compute → T4                             |
| **T4 — Masa**        | 50K–250K     | Supabase scale/enterprise o migración a Postgres dedicado (Neon/AWS); CDN de evidencias a Storage distinto; múltiples regiones | **~500–2.000 USD/mes** | Ads + suscripciones + B2B: ~10–40K USD/mes bruto (depende de mix)                 | **Regla: infra nunca >30% del ingreso bruto** — si se acerca, se ajusta primero la monetización |

**Reglas de la escalera (evitar "apagarse" sin aviso):**

1. **Migrar por disparador, no por calendario**: monitorea 4 métricas (DB usada,
   Edge Functions/mes, Storage, MAU) con alertas PostHog al 60/80%.
2. **El ingreso paga la infra en orden**: primero ads B2B directos (mayor
   margen, sin comisión de Play), después AdMob, después suscripciones.
3. **Crecimiento publicitario sin infra**: el panel B2B y la venta de
   campañas no gastan Supabase (son web + PostHog); se puede escalar ingresos
   B2B con cero impacto en la infra de la app.
4. **Evidencias son el mayor consumidor de Storage**: con retención de 30 días,
   a 50K MAU con el 20% verificando, se necesitan ~100 GB/mes → Storage
   externo (S3/Cloudflare R2, ~5–10 USD/100GB) desde T3-T4.

---

## 20. Backlog de ideas extra (sugeridas)

1. **Retos en vivo (torneos sincrónicos)**: ventana horaria real, ranking en
   vivo por horas (Realtime). Alto engagement; sponsoreable.
2. **Mapa de esfuerzo ciudad/región**: ver dónde se entrenó más ("Heatmap") →
   campañas de gimnasios por cada zona (geo targeting publicitario).
3. **Clubes y ligas**: grupos con ascenso/descenso entre temporadas.
4. **Retos flash de fin de semana**: por una marca (24h) → monetización.
5. **Tienda cosmética con XP** (avatares, frames de perfil): sin dinero → no
   toca políticas de juego, aumenta retención.
6. **Programa de referidos**: invitar amigo → bonus de racha/xp de ambos.
7. **Wearables**: Health Connect / Apple Health para validar pasos/kilómetros
   como "disciplina cardio" (medición distinta, no pose).
8. **Fotos de evidencia + verificación por imagen** (progreso físico, antes/
   después) — backend marca como "no verificado por pose", revisión manual.
9. **Soporte multiidioma ES/EN/PT + i18n completo** desde Fase 0 (clave para
   mercados de suplementos regionales).
10. **Mercado B2C de retos**: communities crean retos y los publican.
11. **Sistema de "bloques de descanso" inteligente**: SafetyEngine + modelo
    predictivo del individuo (Fase 9 IA).
12. **Modo oscuro con brand tokens** y tema adaptive.
13. **Widget de home** (racha + reto de hoy) — aumenta retorno diario.
14. **A/B testing** (PostHog flags) para metas, punteos y placements de ads.
15. **Verificación por two-cameras** (opcional, iOS/Android dual) para
    ejercicios complejos — roadmap lejano.

---

## 21. Cronograma y Definición de "Done" (resumen)

| Fase                | Semanas | Qué deja                                    | Ingresos     |
| ------------------- | ------- | ------------------------------------------- | ------------ |
| 0 Fundaciones       | 1–2     | Repo+CI+marca+scaffold                      | 0            |
| 1 Backend base      | 3–4     | Auth+catálogo+sync+dominio portado          | 0            |
| 2 Motor retos       | 5–6     | Loop completo + retos semanales/+1          | 0            |
| 3 Cámara verificada | 6–9     | Pose nativa + evidencia + validate_workout  | 0            |
| 4 Rankings          | 9–11    | Individual+gym×mundial/nac/reg + temporadas | 0            |
| 5 Retos flujo       | 11–12   | Retos semanales/gym/flash                   | 0            |
| 6 Social            | 12–13   | Amigos/grupos/muro                          | 0            |
| 7 B2B panel         | 13–15   | Gimnasios + QR + panel + Plan Pro           | B2B temprano |
| 8 Monetización      | 15–17   | Ads + sponsors + suplementos + Premium      | Ads + Subs   |
| 9 IA                | 17–19   | Coach IA (cloud/local)                      | Retención    |
| 10 Play Store       | 19–20   | Lanzamiento en producción                   | —            |

**DoD global:** las 10 fases cumplidas = app en Play con ranking justo,
monetización activa y auditado. Revisar métricas de retención antes del
escalado de ad campaigns.

---

## 22. Riesgos y mitigaciones

| Riesgo                                                                                                            | Mitigación                                                                                                                                                                         |
| ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Trampa sigue siendo posible                                                                                       | Estrategia de escalamiento: evidencia + auditoría + anomalías; nunca "imposible", siempre "costoso"                                                                                |
| Uso de datos de cámara en menores                                                                                 | Data-safety + consentimiento parental / gating 13+; borrado de evidencias en plazos                                                                                                |
| Adivinación de umbrales de pose                                                                                   | Test de campo con 5 perfiles; calibración por persona ya implementada                                                                                                              |
| Desgaste del ranking injusto                                                                                      | Decay de temporada + verificación visual + moderación                                                                                                                              |
| Complejidad offline+sync                                                                                          | `sync_queue` con idempotencia; tests E2E de reconexión                                                                                                                             |
| Costos de IA on-device                                                                                            | Escoger por gama; fallback plantillas                                                                                                                                              |
| Cambios de política Play (ads)                                                                                    | UMP + org ADS policies desde el inicio; actualizar antes de cada release                                                                                                           |
| B2B pago directo                                                                                                  | Facturación manual obligatoria antes del lanzamiento publicitario                                                                                                                  |
| **Techo del plan gratuito** (pausa por inactividad, límites de DB/Edge Functions/MAU)                             | Cron `healthz` que despierta el proyecto + alertas PostHog de topes + escalado pagado **usando el ingreso ya generado** (sección 19.3–19.4)                                        |
| **XSS si se compartiera información del usuario** (ver V1)                                                        | Port a RN (sin `innerHTML`) + regla dura de sanitización en cualquier vista web + sanitización en API                                                                              |
| **Fraude de gimnasios en el ranking** (cuentas falsas, socios fantasma, retos blandos, robo de identidad del gym) | Matriz 11.8: membresía activa (excluir <2 verificadas/30 días), ligas por tamaño, scoring central no configurable por gym, verificación de owner, dedupe y freeze por salto brusco |
| **Escalada de costos sin ingreso que la cubra**                                                                   | Escalera 19.6 con disparadores (DB/Edge/Storage/MAU a 60/80%) + regla dura: infra nunca >30% del ingreso bruto                                                                     |

---

## 23. Marketing pre-lanzamiento y lanzamiento (mínima inversión, máxima escalabilidad)

**Principio rector:** 0 USD de pauta hasta el tramo T2. El crecimiento se
siembra con contenido (la cámara anti-trampa **es** el producto de marketing),
comunidad, y el canal B2B local como distribuidor. Pagado solo cuando la
telemetría demuestre LTV > CAC por canal.

### 23.1 El ángulo de venta (hook)

- La historia vende sola: **"la app que cuenta tus repeticiones y te cacha si
  haces trampa"** (liveness, inclinación del teléfono, calibración por
  persona). Una demo de 15–30 s es contenido viralizable nativo de TikTok.
- 3 pilares del mensaje: **Verificación real** (cámara), **Competencia justa**
  (ranking auditado), **Constancia** (racha).
- Mercados por orden: **ES/LatAm primero** (hispanohablantes desatendidos en
  gamificación fitness), EN en la versión en inglés, PT (Brasil) en la fase de
  escala — el idioma es el primer filtro de costo de adquisición.

### 23.2 Estrategia "ciudad faro" (nicho geográfico barato y de alta visualización)

- Lanzar a lo ancho de **una ciudad**: 3–5 gimnasios boutique + 2–3 tiendas
  de suplementos locales + influencers micro locales. El ranking regional y de
  gimnasios es el embudo: cada socio desafiado produce retos, contenido y
  retención del resto de su gym.
- Por qué es el nicho ideal: el marketing local es el más barato (una
  comunidad, un influencer, 3 notas de prensa local) y el de **mayor
  visualización por dinero** (el tablero del gimnasio en su recepción es
  publicidad permanente en pared).
- Escalado: repetir el playbook ciudad por ciudad con **assets de campaña
  reutilizables** (plantilla de video, kit QR, guion de nota, pitch B2B), no
  crear marketing nuevo por ciudad.

### 23.3 Dónde hacer propaganda (gratis → pagado)

| Canal                                                  | Costo                                      | Intención                                                     | Cuándo                                           |
| ------------------------------------------------------ | ------------------------------------------ | ------------------------------------------------------------- | ------------------------------------------------ |
| TikTok / IG Reels / YT Shorts                          | 0                                          | Demo + UGC: "¿dejás que la app te cague?", 15–30 s, 3/semana  | Pre-lanzamiento y siempre                        |
| Discord + WhatsApp de comunidad                        | 0                                          | Beta, feedback, lista de espera (objetivo 500 early adopters) | Pre-lanzamiento                                  |
| Landing + waitlist en Vercel (gratis)                  | 0                                          | Capture de email + cuenta regresiva + descarga el día 1       | Pre-lanzamiento                                  |
| Notas de prensa / radios locales                       | 0                                          | Credibilidad y adopción de gimnasios ("la app nacida aquí")   | Lanzamiento por ciudad                           |
| Product Hunt / r/androidapps / comunidades fitness ES  | 0                                          | Tracción del día del lanzamiento                              | Lanzamiento                                      |
| Influencers micro fitness locales (5–50K)              | Trueque (Premium + cupón B2B) o 20–100 USD | Confianza y aprendizaje del demo                              | Lanzamiento por ciudad                           |
| WhatsApp/email directo a gyms y tiendas de suplementos | 0                                          | Ventas B2B → cada cierre = instalaciones (23.7)               | Siempre                                          |
| Pasacalles/Flyer QR con código de referido             | Impresión mínima                           | Rastrear instalaciones offline por ciudad                     | Lanzamiento por ciudad                           |
| Google Ads buscador / TikTok / IG geo                  | Pagado                                     | Adquisición masiva                                            | **Solo T2+**, con LTV > CAC validado y D30 > 20% |

### 23.4 Nichos económicos pero de alta visualización

- **Gimnasios boutique y de barrio**: Plan Comunidad barato (10–50 USD/mes o
  trueque por visibilidad) pero con **efecto de distribución**: sus socios
  instalan y llenan el ranking, que es publicidad viva en su recepción.
- **Tiendas de suplementos de barrio**: pagan cupones/marcas de "reto del mes"
  que sus clientes ven dentro de la app; margen entregado en producto (no en
  efectivo) y sin mínimo de audiencia.
- **Marcas regionales de nutrición (no multinacionales)**: quieren audiencia
  demo/geo sin pagar TV; presupuestos de guerrilla y decisión en 2 semanas.
- **Universidades, crossfit, plazas de entrenamiento libre**: visibilidad
  alta, costo 0, alta densidad de práctica — idóneos para la primera "ciudad
  faro".
- Precios B2B: **Plan Comunidad** (10–50 USD/mes, trueque) o **Plan Gimnasio**
  (50–150 USD/mes + patrocinio del ranking) — enlazado a 14.x/15.4.

### 23.5 Calendario de marketing

- **M-3 → M0 (pre-lanzamiento):** marca y tono definidos; comunidad beta de
  500; 3 videos/semana del demo; landing + waitlist (Vercel); acuerdos con 3–5
  gimnasios; alta al pre-registro de Google Play en la región donde aplique.
- **M0 → M2 (lanzamiento):** closed testing → rollout escalonado; notas
  locales + influencers micro; **campaña de referidos** (doble XP, subir el
  backlog #6 a Fase 5–6); lanzamiento de la primera "ciudad faro".
- **M3+ (escala):** réplica del playbook por ciudad; primer paid geo **solo si
  LTV > CAC**; SEO/análisis de fitness (contenido perenne); programa de
  embajadores; el círculo B2B (23.7) como motor continuo.

### 23.6 Métricas de marketing (dashboard PostHog)

Instalaciones, D1/D7/D30, WAU/MAU, % de sesiones verificadas, compartidos y
campañas, miembros activos por gym, MRR y **MRR B2B**, LTV vs CAC por canal.

- **Gate de escalado:** no activar pauta paga sin `CAC < LTV/3` y `D30 > 20%`.
- **Gate por ciudad:** no abrir otra ciudad sin >60% de retención D30 y >3
  gyms activos en la actual.

### 23.7 Círculo virtuoso B2B → adquisición (el moat)

El gimnasio **no es solo cliente, es el canal de instalaciones**: su socio con
la app juega en el ranking de su gimnasio, que el gym exhibe en recepción. La
app es publicidad del gym; el gym es publicidad de la app. CAC ≈ 0 y
escalable por metro cuadrado de ciudad — y además defiende el producto (red de
gyms como barrera de entrada). El B2B se diseña desde Fase 7 con eso en mente,
no como mera facturación de banners.

---

## Apéndice A — Orden de prioridad de las tareas críticas para no romper nada

1. Portar `packages/domain` con tests idénticos a app.html (Fase 1.8) →
   nunca reescribir lógica de negocio a mano sin tests.
2. Conectar `validate_workout` antes de exponer el ranking (Fase 3.7 antes de
   Fase 4).
3. RLS y `points_rules` son las primeras piezas de Fase 4.1 (sin races).
4. Monetización (Fase 8) solo después de que `recompute_rankings` esté
   establecido y el panel B2B pueda facturar impresiones (Fase 7.5/8.2).

## Apéndice B — Checklist semanal de release (antes de subir a Play)

- [ ] `pnpm typecheck/test/lint` verde; EAS build release exitoso.
- [ ] Data safety form actualizado (nueva feature = re-chequeo).
- [ ] Consentimiento UMP testeado (EEUU+UE simulado).
- [ ] RLS test suite en CI.
- [ ] Fraude scenario manual pasa: reportar sesión editada → rechazo.
- [ ] Analytics de eventos nuevos presentes (PostHog).
- [ ] Traducciones (ES/EN/PT) completas para strings nuevos.
- [ ] Política de privacidad actualizada (URL vigente).
- [ ] Backups: cron `pg_dump` semanal a Storage funcionando (y PITR si se está en Pro).
- [ ] Evidencias con más de 30 días eliminadas (retención verificada en prod).
- [ ] Cron `healthz` activo (proyecto Supabase nunca en pausa por inactividad).
- [ ] Escaneo XSS/sanitización de inputs incluido en el diff-review.
- [ ] Landings/waitlist y assets de marketing (23.3/23.5) actualizados con el contenido del release.

---

*Fin del plan maestro. Cuando se complete la Fase 3 (cámara verificada nativa

- evidencia) y la Fase 4 (rankings), el producto queda en su estado "10/10"
  en integridad competitiva; las fases 5–10 llevan el producto completo a
  mercado y a ingresos.*

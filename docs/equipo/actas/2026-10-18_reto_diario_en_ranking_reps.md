# Acta 019 — Reto diario: el reto ahora alimenta el ranking de reps (source `reto_diario`)

- **Fecha**: 2026-10-18 · **Tipo**: bug (ranking/datos) + decisión de producto · **Fase**: Fase 4 (ranking).
- **Estado**: **implementado, migración 0020 aplicada en prod y edge redesplegada**. Código en `b386170`.
- **Participan**: [PO] (reporta y decide), [BE]/[SEC] (migración + edge), [QA] (verificación), [DER] (diagnóstico).
- **Relacionada**: acta 017 (validador server-side + encendido del ranking), acta 016 (ranking por ejercicio),
  acta 018 (cadencia estricta del reto), ADR `2026-09-29_free-sin-ranking_premium-todo.md`.

## 1. Motivo

El PO completó el **reto del día** (2026-10-18, 11 flexiones): aparecía **completado**, pero en
**Ranking → Hoy → Reps → Flexiones** decía _"Todavía no hay resultados en este periodo"_.

## 2. Diagnóstico (evidencia de producción)

| Consulta                                           | Resultado                                                      |
| -------------------------------------------------- | -------------------------------------------------------------- |
| `daily_challenges` 2026-10-18                      | `target=11, status=completed, completion_source=server, v53` ✓ |
| `workout_sessions where exercise_code='flexiones'` | **0 filas**                                                    |
| `get_reps_ranking('flexiones')`                    | vacío                                                          |
| `get_ranking` (Hoy)                                | `completed_challenges=1, streak=1` ✓                           |

Causa en dos capas:

1. **El cliente no encolaba sesión desde el reto.** `app/(tabs)/retos.tsx:142-160` sólo llama `markCompleted(...)`,
   que sube la _completación_ → `daily_challenges`. `pushFreeSession` sólo se invoca en
   `app/(tabs)/camretos.tsx:127` (modo Libre); de ahí sale `workout_sessions`.
2. **El servidor filtraba `source='libre'`.** `get_reps_ranking` y `get_total_reps_ranking`
   (`0019_ranking_periods_visibility.sql:131` y `:171`) y el índice parcial sólo admitían `source = 'libre'`.
   Aunque la fila existiera, `uploadSessions` manda `source:'libre'` **hardcodeado** (`syncService.ts:212`) aunque
   el tipo declara `'reto_diario' | 'libre'` (`syncService.ts:43`); el edge ya aceptaba `'reto_diario'` en el
   payload (`validate_workout/index.ts:101`, `:284`, `:529`) pero **escribía `'libre'`** en `workout_sessions`
   (`:552`). Diseño a medio cablear.

## 3. Decisión del PO

**"Que el reto cuente en Reps."** (Alternativas descartadas: dejarlo y sólo corregir el copy; sacar un plan sin
código.) Revisión cruzada `[BE] + [SEC] + [QA]` antes de declarar la entrega.

## 4. Cambios

### 4.1 Migración `0020_challenge_sessions_in_reps_ranking.sql`

- `get_reps_ranking` y `get_total_reps_ranking`: `ws.source in ('libre', 'reto_diario')`.
- Índice parcial `idx_workout_sessions_ranked_created` **recreado** para cubrir las dos fuentes (con el predicado
  viejo la consulta ya no podría usarlo).
- **Backfill idempotente**: crea la fila de sesión para toda `daily_challenges` `completed` +
  `completion_source='server'` que tenga su `daily_challenge_submissions` `verified`, con
  `client_op_id = 'reto:' || challenge_date` y `NOT EXISTS`.
  - `ranked = has_active_entitlement(user_id, 'premium')` → ADR free-sin-ranking.
  - `series_ok = true` (justificado en §6).
  - **`created_at = dc.verified_at`**, no `now()`: los períodos del ranking filtran por `created_at`; con `now()`
    todas las completaciones históricas habrían caído en el día de la migración.

### 4.2 Edge `validate_workout/index.ts`

- La rama de **completaciones** verified escribe además su fila en `workout_sessions`: `source='reto_diario'`,
  `ranked = hasPremium` (sólo el servidor lo decide, fail-closed), `series_ok=true`, `challenge_id` vinculado y
  `client_op_id` determinista por fecha → **idempotente** ante reintentos.
- Sólo se escribe para completaciones **nuevas** (mismas fechas que se acaban de materializar): no re-escribe fechas
  ya decididas (invariante server-authoritative, acta 017 / migración 0015).
- `verifiedSessions` (modo Libre) deja de hardcodear `source: 'libre'` → `item.source ?? 'libre'`.
- Mensaje de respuesta de la edge actualizado.

**No hubo que tocar la app**: sin build ni reinstalación.

## 5. Verificación

- **Dry run en prod con `rollback`** antes de aplicar: validó sintaxis y semántica **sin persistir nada**
  (comprobado después: el índice seguía con `source='libre'` y 0 filas `reto_diario`). El dry run detectó un error
  real: `CREATE INDEX` **no admite** nombre esquem-calificado.
- `pnpm typecheck` + `pnpm lint` (repo) OK · tests **214** (mobile) + **39** (console) OK.
- **Migración aplicada** y comprobada en prod:

| Verificación                         | Resultado                                                                                            |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| índice                               | `source = ANY (ARRAY['libre','reto_diario'])` ✓                                                      |
| fila creada                          | `flexiones · reto_diario · ranked=true · 11/11 · verified/server · reto:2026-10-18 · challenge_id` ✓ |
| `created_at`                         | `2026-10-18 23:51:33 UTC` (tu `verified_at` real) ✓                                                  |
| `get_reps_ranking('flexiones', Hoy)` | **`atleta → best_value 11, sessions 1`** ✓                                                           |
| `get_total_reps_ranking`             | `atleta → 16` (5 sentadillas + 11 flexiones) ✓                                                       |

- **Edge redesplegada**: `Deployed Functions.` (`validate_workout`).

## 6. Límites y notas

- **`ranked` lo decide el servidor** con `has_active_entitlement`; el cliente no lo envía. El ADR
  free-sin-ranking queda garantizado también en este camino nuevo.
- **`series_ok = true`** no es una aserción del cliente: una completación verified exige duración
  ≥ `value * MIN_MS_PER_REP` (`350 ms`), prueba de vida (`requireLiveness`) y cadencia estricta (`strict=1`,
  acta 018) dentro de una sola corrida de cámara.
- **Los períodos filtran por `created_at`, no `session_date`** (preexistente desde el acta 017): una sesión subida
  tarde cae en el período de la subida. El backfill lo compensa usando `verified_at`; conviene revisarlo cuando se
  atienda el resto de la deuda de períodos.
- **Ventana de fallo**: si el upsert de `workout_sessions` fallara _después_ de escribir `daily_challenges`, la
  fecha quedaría decidida y no se reenvía más; se repara re-ejecutando 0020 (el backfill es idempotente).
- Sólo los retos **nuevos** escriben sesión por sí solos; el del 2026-10-18 lo resolvió el backfill.
- `get_total_reps_ranking` suma Libre + Reto: 16 reps reales (5 sentadillas + 11 flexiones).

## 7. Acciones

1. **[BE]/[SEC]**: migración 0020 + rama de completaciones en la edge. — **Hecho** (aplicada y desplegada).
2. **[QA]**: dry run con rollback, typecheck/lint/tests y verificación de queries en prod. — **Hecho**.
3. **[PO]**: abrir Ranking → Hoy → Reps → Flexiones y confirmar los 11. — **Hecho (OK)**: lo muestra.
4. **[PM]/[DER]**: commit del código y registro (acta + BITACORA). — **Hecho**: `b386170` (código).

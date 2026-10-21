# Acta 026 — Prueba de vida sin reinicio por pérdida breve de pose + sincronización de versión de evidencia (v54)

- **Fecha**: 2026-10-21 · **Tipo**: fix (cámara + edge) · **Estado**: **aprobado por el PO** (probado en dispositivo: reto diario verificado en prod).
- **Participan**: [PO] (decide), [CV] (cámara), [MOB] (implementa), [BE] (edge/evidencia), [SEC] (evidencia/anti-replay), [QA] (verificación), [SRE] (deploy gh-pages y edge).
- **Relacionada**: actas 024/025; ADR de cámara; HTML en v54 (`VERIFY_VERSION`).

## 1. Motivo

El PO reportó un **bucle rápido de la señal de vida** en el reto diario de flexiones:
"señal de vida → ejercicio → señal de vida → …", muy rápido.

Diagnóstico ([CV]/[BE]) con evidencia de código en `camera-verification.html`:

- El desafío de vida se **cancelaba** (`hideLiveness()` + `livenessChallengeActive = false`)
  cada vez que un frame perdía la pose un instante: el único lugar del archivo que hacía eso
  sin limpiar el temporizador.
- Como `livenessNextTriggerAt` quedaba vencido, al recuperar la pose el desafío se **rearmaba
  al instante** (bucle).
- Además, cada rearme **renovaba la cadencia estricta** → `strict=1` dejaba de cortar la
  serie (red de seguridad anulada).
- Con flexiones (meta 10, `livenessEndOnly=true`) la vida se pide **al final de la serie**,
  el peor frame (respirando, arriba).

La iluminación **gatilló** el fallo (frame sin detección), pero el bucle era un **bug** del
HTML, no del PO ni de la luz.

## 2. Cambio aplicado (propuesta de un asesor, revisada y aprobada)

Solo `camera-verification.html` (65 inserciones, 4 borrados):

1. **No reiniciar la vida al perder pose** (`processPose`): si `livenessChallengeActive`, se
   resetean solo `livenessConfirmFrames`/`livenessHoldStartTime`; el desafío **sigue vigente**.
2. **`livenessNextTriggerAt = null`** al armar el desafío (mata el rearme instantáneo).
3. **Timeout de respuesta** `LIVENESS_TIMEOUT_MS = 10000`: si no se responde en 10 s,
   `failLiveness()` corta la serie con **REPETIR** (no queda colgado).
4. **`livenessCadenceExtended`**: la cadencia se extiende **una sola vez** por desafío → `strict`
   vuelve a ser red de seguridad.
5. **`failLiveness()`** limpia todos los temporizadores y estados; consistente con el patrón
   `failSeries`.
6. **`onLivenessPassed()`** y `resetRepState()` limpian `livenessDeadline`/`livenessCadenceExtended`.

Además, sincronización obligatoria de desplegables:

- `apps/mobile/src/retos/verify.ts`: `VERIFY_VERSION` **53 → 54**.
- `supabase/functions/validate_workout/index.ts`: `ALLOWED_EVIDENCE_VERSIONS`
  **`[12,13,53]` → `[12,13,53,54]`**.
- **Deploy**: HTML v54 a gh-pages (`f1aa0ca..da7ab49`) y edge `validate_workout` redeployada.

## 3. Incidente detectado y corregido (lección de proceso)

Tras el bump a 54 y antes de actualizar la edge, el PO hizo el reto diario y fue **rechazado**:

- `daily_challenge_submissions` (2026-10-21): `rejected` / `unsupported_evidence_version`
  (`created_at 18:00:45Z`).
- Causa: la cámara firmaba **v54** pero la edge desplegada solo aceptaba hasta **v53**
  (`index.ts:20`). No fue culpa del PO ni del registro: el flujo (guardó → pending → edge →
  rechazo por versión) fue correcto.
- Corregido agregando 54 a la edge y redeployándola. El PO rehízo el reto por cámara
  ("reintentar reto" **reenvía por cámara**, no reutiliza evidencia) y quedó **`verified`**:
  `workout_sessions` `reto:2026-10-21`, `ranked=true`, `series_ok=true`,
  `verification_version=54`, `verification_source=server`.

**Idempotencia verificada**: `decidedDates` solo bloquea fechas `verified` (`index.ts:893`);
una `rejected` no es terminal → el reenvío re-evalúa y el `upsert` por `(user_id, challenge_date)`
reemplaza la fila.

## 4. Guard automático (regla de proceso → verificada por máquina)

Nuevo test `apps/mobile/src/retos/__tests__/evidenceVersionSync.test.ts`:

- Lee `ALLOWED_EVIDENCE_VERSIONS` de `validate_workout/index.ts` y **falla** si `VERIFY_VERSION`
  no está incluida. Atrapa la desincronización **antes** de tocar producción.

## 5. Verificación

- **PO, dispositivo**: reto diario de flexiones completo con señal de vida; ya **no** hace el
  bucle; la serie se envía y queda **`verified`** en prod (evidencia arriba).
- `pnpm --filter mobile typecheck` ✓ · `lint` ✓ · **222/222 tests (20 suites)** ✓.

## 6. Alcance y límites (honestidad)

- El fix del bucle es del **HTML** (lógica de la prueba de vida). No se rediseñó la vista de
  flexiones ni se cambió el conteo (la propuesta de flexiones "de frente" quedó **descartada**:
  pelea con el motor de pose y arriesga mal conteo).
- El `unsupported_evidence_version` **puede reaparecer** si en el futuro se sube `VERIFY_VERSION`
  sin actualizar la edge: por eso el guard + esta acta fijan la regla
  **"bump + edge + deploy en el mismo movimiento"**.
- Timeout de 10 s y limpieza de estados: verificados por lectura de código; el comportamiento
  exacto bajo pérdida de pose se probó en dispositivo por el PO en el camino real (sin bucle).

# Acta 017 — Fase 4: validador server-side real + encendido del ranking

- **Fecha**: 2026-10-16 · **Tipo**: implementación + revisión cruzada (gate anti-fraude) · **Fase**: 4 (rankings).
- **Estado**: **implementado y desplegado**; verificación end-to-end **OK**. Pendiente: ranking de rutina (`seq`).
- **Participan**: [PO] (pide encender), [BE], [SEC], [QA], [MOB], [CV], [PM].
- **Relacionada**: acta 016 (períodos + ranking de rutina), ADR `2026-09-29_free-sin-ranking_premium-todo.md`.

## 1. Motivo

El PO pidió: "quiero que empiece a funcionar el rankeo ya, haz lo que falta, reúne a los especialistas y que
funcione con base de datos y todo. Que aparezca la lista si empiezo a hacer ejercicios." La infraestructura estaba
lista (tablas, RPC con `p_since`, UI, sync) pero el **validador real no existía**: todo quedaba `pending` y el
ranking nunca se poblaba.

## 2. Qué se hizo

Se implementó el validador en `supabase/functions/validate_workout/index.ts` y se desplegó a producción.

- **Evidencia v53 aceptada**: `ALLOWED_EVIDENCE_VERSIONS = {12, 13, 53}` (corrige el handshake roto, acta 016 §5).
- **Sesiones libres rankeadas** → `verified` + fila en `workout_sessions` (lo que leen `get_reps_ranking` /
  `get_total_reps_ranking`), solo si pasan **todos** los gates: tier, límites, **premium**, prueba de vida y
  `evidenceIssue`.
- **Retos diarios** → `verified` + `daily_challenges` (`completion_source='server'`), para **todos** (racha).
- `verified` es **terminal** (invariante 0015): no se re-escriben filas ya decididas.
- Fix de un bug de idempotencia en el camino `already_verified` de completions.

## 3. Revisión cruzada (criterio por rol)

- **[BE]** — "el cliente propone, el servidor recalcula": se cumple. El veredicto se calcula en el servidor; el
  cliente manda propuesta y recibe `accepted`/`pending`/`rejected`. Idempotencia por `client_op_id` (upsert) y
  `verified` terminal. **Sin migración**: las columnas ya existían (0008/0010/0011). `daily_challenges` upsert por
  `(user_id, challenge_date)`. Entrega: Edge Function v3 desplegada + `deno check` OK + evidencia SQL.
- **[SEC]** — el ranking **no** se puede falsificar desde el cliente: RLS cerrada (insert/update/delete revocados en
  `workout_sessions`/`daily_challenges`, RLS en `_submissions`), y el veredicto es server-side. Escalamiento de
  evidencia: prueba de vida obligatoria en ranked, plausibilidad (duración vs. reps, cadencia < 2 s, versión
  soportada). **Gate de free** aplicado. Señal de riesgo abierta: aún no hay validación criptográfica/attestation
  (documentado, no promesa); el anti-spoofing fuerte es Fase 3+/CV.
- **[QA]** — matriz ejecutada con usuarios desechables: (a) premium ranked → verified + aparece; (b) idempotencia →
  `already_verified`, 1 sola fila; (c) free ranked → `rejected/ranking_premium_required`, 0 filas; (d) sin evidencia
  → `pending/missing_evidence`; (e) reto diario → completed/server + racha=1. Datos de prueba eliminados.
  **Veredicto**: GO para libre 1-ejercicio + racha; NO-GO para rutina (`seq`) hasta hacer la matriz 1 vs N (acta 016 §4).
- **[MOB]** — sin cambios de app requeridos para el camino encendido: `camretos.tsx` (single) ya manda
  `ranked`/`cadence`/`evidence` y `syncAfterLogin` tras la sesión. El toggle "participar del ranking" hoy se
  muestra también a free → **[UX]/[MOB]** conviene bloquearlo/ocultarlo para free (defensa + evitar confusión con
  el `rejected` del server). Pendiente menor.
- **[CV]** — la evidencia se genera en dispositivo y se valida server-side; no se persiste evidencia cruda
  (solo hash + agregados). Umbrales provisionales (MIN_MS_PER_REP, MIN_CADENCE_SEC) sin test grid → no son
  definitivos; cualquier ajuste se hace con datos de campo, no a ojo.
- **[PM]** — **secuencia respetada**: "no se toca el ranking sin `validate_workout` primero" (Apéndice A). Se activa
  el ranking con el validador en su lugar y con gate premium del ADR. Riesgo residual: rutina no rankea aún y el
  toggle de free en UI. Recomendación: cerrar el toggle de free y decidir el alcance de rutina antes del gate.

## 4. Evidencia

- Deploy: `validate_workout` **v3**, ACTIVE, `verify_jwt=true`, `updated_at` 2026-10-16.
- `deno check supabase/functions/validate_workout/index.ts` → OK.
- 5 casos end-to-end (tabla en `docs/BITACORA.md`, entrada "2026-10-16 - Ranking Fase 4").
- Cuentas prod intactas; `qa-*` eliminadas.

## 5. Decisiones y acciones

1. **[SEC]/[BE]**: implementar el gate **premium-only** en el validador (ADR 2026-09-29). — **Hecho**.
2. **[BE]**: aceptar evidencia v53 y desplegar. — **Hecho** (acta 016 §2).
3. **[UX]/[MOB]**: bloquear/ocultar el toggle de ranking para **free**. — **Pendiente** (menor).
4. **[CV]/[MOB]/[QA]**: habilitar y validar `ranked` en **rutina (`seq`)** (gesto/cadencia/vida por tramo; matriz
   1 vs N, mezcla reps/segundos, REPETIR, rutina parcial). — **Pendiente** (Fase 4 restante).
5. **[PO]**: **revocar el PAT** usado (expuesto en el chat; no está en el repo). — **Pendiente**.
6. **[BE]/[PM]**: **commit** del trabajo (edge + 0019 + Fase A/B) cuando el PO lo autorice. — **Pendiente**.

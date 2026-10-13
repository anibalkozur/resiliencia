# Acta 011 — Revisión de seguridad y calidad (estado de la app)

- **Fecha**: 2026-10-13 · **Tipo**: revisión cruzada [QA]+[SEC] + barrido [SRE]/[UX]/[LEG] · **Fase**: 0 (insumo del gate) sobre producto en Fase 3.
- **Estado**: **borrador — pendiente de lectura y firma del PO**. No cierra el gate por sí sola.
- **Conduce**: [DER] · **Convocados**: [SEC], [QA], [SRE], [UX], [LEG] · **Ejecuta**: revisión estática (solo lectura, sin cambios de código).
- **Referencia**: acta 009 `2026-10-09_gate_fase0.md` (acciones §5), `docs/equipo/estado.md`, checklist 5.2 de `EQUIPO.md`.
- **Alcance**: migraciones `0001`–`0018`, Edge Functions `validate_workout` y `admin_console`, app móvil (auth/premium/retos), consola (main + renderer), CI, i18n y tests.

## 1. Método

- Revisión estática con evidencia `archivo:línea`, sin ejecutar cambios ni tocar el banco de pruebas.
- Cada hallazgo lleva severidad **Crítica / Alta / Media / Baja / Info**.
- Se contrasta contra el checklist 5.2 del gate de Fase 0.

## 2. Evidencia verificada (fortalezas)

### [SEC] — Seguridad

- **RLS completo**: las **22 tablas** de `public` tienen `enable row level security` (`0001`–`0018`).
- **Autoridad en el servidor**: el cliente no puede escribir rankings/progreso — `revoke insert, update, delete … from anon, authenticated` sobre `workout_sessions` (`0010:32`), `workout_submissions` (`0010:66`), `daily_challenges` (`0011:74`) y `workout_exercises/progress/streaks/user_levels/user_achievements` (`0013:19-41`). El cliente solo lee **lo suyo** (`auth.uid() = user_id`).
- **Sesiones libres siempre `pending`**: `validate_workout` guarda propuestas sin escribir el ranking hasta que exista validador real.
- **Entitlements fail-closed**: `has_active_entitlement` solo `service_role` (`0016:154-157`); el móvil solo lee su fila y cae a `false` ante error (`apps/mobile/src/premium/entitlements.ts:41-45`).
- **Consola admin cerrada**: JWT → allowlist `admin_users` (403 si no) → `service_role` server-side (`apps/console` edge `admin_console/index.ts:113-149`); escrituras auditadas en la misma transacción (`0017`, corrige fail-open de `0016`); `admin_users`, `admin_audit_log`, `subscriptions`, `purchases` **sin policies** → deny por defecto (`0016`, `0018:42,63`).
- **Sin secuestro de `search_path`**: todas las funciones `SECURITY DEFINER` declaran `set search_path = public`.
- **Sin secretos en el repo**: `service_role` solo por `Deno.env` en Edge Functions; `apps/mobile/.env` gitignoreado y no trackeado; anon key pública por diseño. Consola: sesión cifrada con `safeStorage` (fail-closed) y CSP restrictiva (`script-src 'self'`, `apps/console/src/renderer/index.html`).
- **`get_ranking`** expone solo `nickname`, `completed_challenges`, `current_streak`, `best_streak` (`0011:105+`).

### [QA] — Calidad

- ~**282 casos** relevados en 29 archivos (el equipo reportó **300** el 2026-10-09: mobile 160 · domain 69 · console 39 · bench 32).
- **typecheck 5/5 ✓**, **lint ✓** (mobile y banco).
- **`JSON.parse` siempre en `try/catch`** (p. ej. `apps/mobile/src/retos/completions.ts:53-67`); storage en SQLite.
- **i18n** ES/EN/PT: **214 claves cada uno, 0 faltantes** (`apps/mobile/src/i18n/translations.ts`); test de paridad en `apps/mobile/src/i18n/__tests__/translations.test.ts:6-12`.

## 3. Hallazgos (por severidad)

| Sev.      | Área  | Hallazgo                                                                                                    | Evidencia                                                                                    |
| --------- | ----- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| **Media** | [SEC] | Token de sesión móvil persistido en **SQLite**, no en `SecureStore`                                         | `apps/mobile/src/auth/supabase.ts:33-47`                                                     |
| **Media** | [QA]  | `verify.ts` de mobile **sin test** + deriva de versión mobile **46** vs banco **47**                        | `apps/mobile/src/retos/verify.ts:2`; `apps/banco…/src/lib/verify.ts:17`                      |
| **Media** | [QA]  | Rechazos async no manejados (unhandled rejection)                                                           | `app/(tabs)/retos.tsx:129`; `app/(tabs)/index.tsx:40-46`                                     |
| **Media** | [QA]  | `lint` no cubre console/domain/design-tokens; design-tokens sin tests; build del bundle no verificado en CI | `package.json:10-12`; `apps/console/package.json:11-12`                                      |
| **Media** | [QA]  | Consola sin cobertura de `adminApi.ts`, componentes React ni proceso main (copilot/secrets)                 | `apps/console/src/renderer/src/lib/adminApi.ts`; `apps/console/src/main/copilot.ts`          |
| **Baja**  | [SEC] | `get_ranking` expone `user_id` (UUID interno) a authenticated                                               | `0011:105+`                                                                                  |
| **Baja**  | [QA]  | `any` en handlers WebView; `arr as FreeSession[]` sin validar forma; `.catch(()=>{})` silencioso            | `camretos.tsx:91,150,346`; `retos.tsx:102,163,282`; `freeSessions.ts:27`; `camretos.tsx:145` |
| **Baja**  | [QA]  | Test i18n compara solo claves (no placeholders); algún texto sin traducir (PT `'Escaladores'`)              | `translations.ts:731`                                                                        |
| **Info**  | [SEC] | `app_config`/`feature_flags` legibles por authenticated `using(true)` (por diseño)                          | `0016:90-106`                                                                                |
| **Info**  | [SRE] | Solo existe el Keep-Alive (cron cada 3 días) — **no es un backup**                                          | `.github/workflows/supabase-keepalive.yml`                                                   |
| **Info**  | [LEG] | Chequeo formal de marca (INPI, B1) pendiente (vence 2026-10-20)                                             | acta 009 §5.3                                                                                |
| **Doc**   | —     | `estado.md` dice `VERIFY_VERSION` mobile = **16** (hoy **46**)                                              | `docs/equipo/estado.md:31-32`                                                                |

**Sin hallazgos Críticos ni Altos.**

## 4. Contraste con el gate Fase 0 (checklist 5.2)

| #   | Ítem                                             | Dueño      | Fecha      | Estado                                                          |
| --- | ------------------------------------------------ | ---------- | ---------- | --------------------------------------------------------------- |
| 2   | `[QA]` sin críticos / `[SEC]` sin hallazgos auth | [QA]+[SEC] | 2026-10-14 | **Pendiente** (este acta es el insumo; falta veredicto firmado) |
| 3   | `[UX]` aprobó pantallas + i18n ES/EN/PT          | [UX]       | 2026-10-16 | **Parcial** (paridad de claves OK; falta OK visual)             |
| 4   | `[SRE]` backups/healthz, <60% free-tier          | [SRE]      | 2026-10-16 | **Parcial** (Keep-Alive reparado; falta backup + medición)      |
| —   | Marca (B1)                                       | [LEG]      | 2026-10-20 | **Pendiente**                                                   |

## 5. Veredicto [DER]

El sistema **soporta técnicamente** la afirmación "ranking server-authoritative" y no presenta problemas críticos. Para poder **cerrar el gate** faltan: (a) los 2 cierres medios de seguridad/calidad y (b) los ítems [SRE]/[UX]/[LEG]. Nada exige rediseño; son cierres acotados.

## 6. Acciones recomendadas (dueño · prioridad)

1. **[SEC]** (Media): migrar el almacenamiento de sesión móvil a `expo-secure-store`.
2. **[QA]** (Media): test de `verify.ts` de mobile + unificar `VERIFY_VERSION` 46/47.
3. **[QA]** (Media): manejar los rejections de `retos.tsx:129` e `index.tsx:40-46`; ampliar lint a console/domain/design-tokens.
4. **[SRE]** (gate): backup `pg_dump` semanal a Storage + medición free-tier <60% + runbook.
5. **[UX]** (gate): OK visual de pantallas nuevas del mes.
6. **[LEG]** (gate): cerrar chequeo INPI (B1).
7. **[PM]** (Doc): corregir `estado.md:31-32` (`VERIFY_VERSION` = 46).

## 7. Riesgos / avisos

- El ranking **no** se comunica como verificado: la verificación real sigue `pending` (no se simula).
- Fase 0 excede cronograma; el atraso se mantiene declarado en `estado.md`.

## 8. Cierre

Borrador preparado por [DER] el 2026-10-13. **Pendiente**: lectura del PO y firma de [QA]+[SEC]. No cierra el gate ni compromete cambios de código.

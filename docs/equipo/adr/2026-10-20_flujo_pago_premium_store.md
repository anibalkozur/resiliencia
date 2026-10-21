# ADR — Flujo de monetización: cómo un free se pasa a Premium pagando en la store

- **Fecha**: 2026-10-20
- **Tipo**: Documentación / arquitectura (monetización). **No cambia código.**
- **Estado**: Documento de referencia (consolida decisiones ya tomadas; no introduce una decisión nueva)
- **Convocados**: [PM] + [FIN] (precio/plan), [BE] (webhook/entitlements), [SEC] (firma/idempotencia), [LEG] (store/compliance), [MOB] (SDK de compra), [SRE] (secrets/deploy)
- **Aprueba**: PO

## 1. Pregunta del PO

> Suponiendo que la app ya está en Play Store, un usuario se descarga, entra en modo
> free. ¿Cómo hace para pasarse a Premium? ¿Cómo lo hacen todas las apps — paga la
> suscripción y se activa solo, y se controla automáticamente el tipo (mensual o
> anual)?

Este ADR responde esa pregunta, documenta **qué existe hoy**, **qué falta** y **el
flujo canónico** ya decidido, para no reinventarlo ni volver a discutirlo.

## 2. Respuesta corta (cómo lo hace cualquier app)

El usuario **paga en la store y el Premium se activa solo**, sin que nadie toque la
base de datos. La app **nunca** se declara Premium por decisión local: la única
fuente de verdad es el servidor (`entitlements`), y esa fila la escribe **solo** un
webhook firmado de la store.

```
Usuario toca "HACERTE PREMIUM"
  → la store (Play/App Store) muestra el pago (mensual o anual)
  → la store cobra y registra la suscripción
  → RevenueCat recibe el evento de la store
  → RevenueCat llama a NUESTRO webhook (Edge Function en Supabase)
  → el webhook escribe el entitlement 'premium' de ese usuario
  → la app revalida y ya es Premium. Fin.
```

- **Automático**: el usuario no "se cambia de plan" a mano; paga y el sistema lo activa.
- **Mensual/anual**: se distingue por el **producto** comprado (`premium_monthly` /
  `premium_annual`), cada uno con su `current_period_end` y `will_renew`.
- **Renovación**: la store renueva y manda otro evento; el webhook extiende la fecha.
- **Cancelación**: el usuario cancela en la store; **sigue Premium hasta que vence**
  (cancelar ≠ revocar).
- **Restaurar**: al reinstalar o cambiar de teléfono, "Restaurar compra" reconstruye el
  estado vía RevenueCat.

## 3. Flujo canónico (ya decidido en docs)

`docs/BITACORA.md:480` fija el camino:

```
Google Play / App Store → RevenueCat → webhook firmado → Supabase Edge Function
→ entitlements → app
```

La app **nunca** activa Premium localmente. RevenueCat se interpone entre la store y
nuestro webhook para no integrar cada store por separado.

## 4. Qué EXISTE hoy (núcleo server-side ya construido y verificado)

| Pieza                                                                                            | Evidencia                                                                            |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| Tabla `entitlements` (fuente de verdad, RLS select-own, solo el server escribe)                  | `supabase/migrations/0016_admin_console_base.sql:37-56`                              |
| Helper `has_active_entitlement` (SECURITY DEFINER, solo `service_role`)                          | `0016_admin_console_base.sql:139-157`                                                |
| Tabla `subscriptions` (status, `will_renew`, periodos, CHECK `premium_monthly`/`premium_annual`) | `0018_admin_console_entitlements_lifecycle.sql:24-43`                                |
| Tabla `purchases` (log; `rc_event_id` unique → anti-replay)                                      | `0018_admin_console_entitlements_lifecycle.sql:49-64`                                |
| RPCs grant/revoke/simulador auditadas (solo `service_role` + rol director)                       | `0018_admin_console_entitlements_lifecycle.sql:77-406`                               |
| Gate real server-side (rechaza free, lo excluye del ranking)                                     | `supabase/functions/validate_workout/index.ts:397-491, 951`                          |
| Lectura en la app, fail-closed                                                                   | `apps/mobile/src/premium/entitlements.ts` · `usePremium.ts`                          |
| Candados UI (Modo Libre, Inicio, Reto, Ranking)                                                  | `apps/mobile/app/(tabs)/camretos.tsx`, `index.tsx`, `retos.tsx`, `ranking.tsx`       |
| Simulador del ciclo de vida (9 eventos) en la Console                                            | `apps/console/src/renderer/src/console/Entitlements.tsx`                             |
| Precios y trial decididos                                                                        | `docs/BITACORA.md:399-400` (D-D/D-E): US$2.99/mes, US$19.99/año, trial 7d solo anual |

## 5. Qué FALTA (ejecución, no diseño)

1. **SDK de compra en la app**: `react-native-purchases` (RevenueCat). **Requiere dev
   build nativo**; no funciona en Expo Go (`docs/BITACORA.md:624`).
2. **Paywall real** (hoy es solo un `Alert`): pantalla con los 2 planes, precio,
   selección mensual/anual y **Restaurar compra**. Hoy: `retos.tsx:349`.
3. **Edge Function `revenuecat_webhook`** (no existe): mapea `app_user_id → auth.uid`,
   **verifica la firma** (Bearer, comparación en tiempo constante), aplica la **matriz
   de eventos** y escribe `entitlements`/`subscriptions`/`purchases` con `store='play'`,
   `is_simulation=false`. Idempotencia por `unique(rc_event_id)`.
4. **Matriz de eventos** (ya definida, `docs/BITACORA.md:407`): `EXPIRATION/REFUND/
TRANSFER/DELETE` revocan; `CANCELLATION` **no** revoca; `BILLING_ISSUE` → gracia.
5. **Cuentas externas** (bloqueador de dinero): Play Console (US$25), productos en Play,
   cuenta RevenueCat, secrets del webhook en Supabase. Apple (US$99) solo si sale iOS.
6. **Cumplimiento (F4)**: T&C con cláusulas de suscripción + data safety que declare
   RevenueCat. Gate del store antes de cobrar.
7. **Fase C de la Console** (pendiente declarada): pagos simulados con monto/recibo y
   **replay** de payloads de RevenueCat para probar el webhook **antes** de producción.

## 6. Ruta crítica acordada (sin inversión inicial)

`docs/BITACORA.md:504` y el modo lean del PO ya fijan el orden:

```
... → paywall MOCK (sin cobrar) → medir intención de pago
    → si convierte (≥8% paywall→plan, ≥15% CTA) → recién ahí pagar cuentas
    → RevenueCat + webhook (cobro real) → cumplimiento → rollout
```

Es decir: **primero se prueba si hay interés con un paywall mock; sólo si convierte se
paga Play/Apple y se activa el cobro real.** Coherente con la regla "sin inversión
inicial".

## 7. Consecuencias / límites

- **Nada de esto se puede probar en Expo Go**: el cobro y el webhook exigen dev build +
  cuentas pagas.
- **El paywall mock** (pantalla de planes, sin cobro) **se puede construir ya, gratis**,
  y es lo único que conviene avanzar sin gastar.
- **SEC**: el webhook es superficie nueva crítica (firma + idempotencia + sin `verify_jwt`
  público). Debe revisarse por [SEC] antes de producción.
- **LEG**: las cláusulas de suscripción (qué pasa al cancelar: se conserva el historial,
  ver análisis de downgrade) deben quedar escritas antes de cobrar.

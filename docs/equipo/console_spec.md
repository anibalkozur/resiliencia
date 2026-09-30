# ResiliencIA Console — Especificación de la app admin de escritorio

> **Estado**: especificación acordada por el PO (2026-09-29). Fases de construcción
> a arrancar con la Fase A. Decisión de producto PO, con guardarraíles de [SEC],
> [BE], [DATA]/[FIN] y [PM] para que cada módulo sea seguro de usar.

## Propósito

Una **app de escritorio** para el director/PO que permita:

- Operar el sistema de forma directa (usuarios, suscripciones, contenido).
- **Probar todos los estados** de la app (free, premium, ciclo de suscripción).
- **Simular** compras, cancelaciones, expiraciones y pagos.
- Asistir con **IA** para pruebas, diagnóstico y correcciones.

## Stack

**Electron + React/TypeScript.** El equipo ya es TS/Node; reutiliza
`@resiliencia/design-tokens` y los tipos existentes. Es un cliente thin: habla por
HTTPS con **Edge Functions admin de Supabase** usando el **JWT del admin**.

- La `service_role` **nunca** vive en la app (queda en Supabase Secrets,
  server-side). [BE] lo bloquea.
- El token del admin se guarda en el **keychain del SO**, nunca en archivo plano.

## Arquitectura de seguridad (condición de [SEC] — Fase A es obligatoria antes de exponer botones)

- Toda acción privilegiada pasa por una **Edge Function admin** que:
  1. Verifica que el caller está en `admin_users` (allowlist por rol).
  2. Ejecuta con `service_role` **server-side**.
  3. Escribe en `admin_audit_log`.
- Un único camino de escritura de entitlements (no abrir bypass). [BE]
- El admin lee vía `service_role` a través de funciones; la RLS de las tablas de
  la app sigue cerrada para el cliente.
- Coherencia con el ADR free-sin-ranking: la consola **no es una puerta trasera**
  — el usuario free en la app nunca ve rankings; el admin los ve solo por oversight.

## Modelo de datos (migración `0016` en adelante)

- `admin_users` (`user_id`, `role`: `director|support|analyst`) — allowlist de admins.
- `entitlements` (`user_id`, `key`, `store`, `expires_at`) — plan v4 §9. RLS
  select-own; escribe solo `service_role`.
- `subscriptions` (`store`, `original_transaction_id`) — plan v4 §10.
- `purchases` (`rc_event_id` unique, + `is_simulation`).
- `admin_audit_log` (`admin_user_id`, `action`, `target_user_id`, `payload`,
  `reason`, `created_at`) — **obligatorio** para [SEC].
- `app_config` (`key`, `value`) — p. ej. `FEATURE_DATE`, pool free (consola
  dinámica, sin redeploy).
- `feature_flags` (`key`, `value`) — interruptores on/off.

## Módulos (funciones del admin)

### A. Acceso y seguridad

- Login del admin (email + MFA), allowlist contra `admin_users`, sin registro abierto.
- Roles: `director` (todo), `support` (usuarios, sin dinero), `analyst` (solo lectura).
- Timeout de sesión y cierre de sesión.
- Verificación: si no es admin, ninguna Edge Function responde (RLS + check server-side).

### B. Usuarios

- Buscar/listar usuarios (email, apodo, alta, objetivo, estado).
- Ficha de usuario: perfil, objetivo, racha, sesiones, retos, entitlements, ranking.
- Vista "mirar como" (read-only del estado del usuario), con log de auditoría.
- Marcar como cuenta de prueba (no contamina métricas).
- Suspender / reactivar (con motivo).
- Exportar datos (GDPR) y borrar cuenta (cascada: retos, sesiones, progreso, asignaciones).

### C. Suscripciones y Entitlements (núcleo)

- Listar entitlements (usuario, key, tienda, expiración, origen).
- **Otorgar** premium a un usuario (motivo + duración).
- **Revocar** premium.
- **Simulador de ciclo de vida completo** (el corazón):
  1. Compra inicial (mensual/anual)
  2. Inicio de trial (7 días, solo anual — D-B)
  3. Renovación
  4. Cancelación (`will_renew=false` → conserva acceso hasta expiración, no revoca)
  5. Expiración (revoca al vencer)
  6. Reembolso (revoca)
  7. Billing issue (gracia, no revoca)
  8. Transferencia
  9. Restaurar compras
- Cada acción escribe las mismas filas que el webhook real, marcadas
  `is_simulation=true` y `source='simulation'`.

### D. Pagos (simulados)

- Fabricar pagos de prueba (producto, monto, moneda, tienda, recibo) marcados `is_simulation`.
- Replay de eventos con payload de RevenueCat (para probar el webhook en F3).
- Regla dura [FIN]: lo simulado **nunca** cuenta como MRR/caja; los reportes separan real de simulado.

### E. Contenido: retos, catálogo, flags

- Ver el reto de hoy de un usuario y su asignación.
- Forzar / re-roll una asignación (para testear).
- `FEATURE_DATE` y pool free editables desde la consola (probar rotación sin redeploy).
- Gestionar catálogo: agregar/editar ejercicio, **setear tier**, unidad, targets, cadencia
  (resuelve el pendiente del "ejercicio de espalda" sin redeploy).
- Feature flags: encender/apagar funciones (paywall, abdominales, rotación, etc.).

### F. Rankings y anti-fraude

- Ver todos los rankings (TOTAL, por ejercicio) — solo oversight del admin.
- Congelar / descongelar usuario o gym (anti-fraude).
- Recomputar rankings.
- Inspeccionar una sesión sospechosa (hash de evidencia, status) y marcarla para revisión manual.
- Ver `manual_review` rate y alertas de salto de puntos.

### G. Métricas (dashboard)

- Usuarios, DAU, D1/D7/D30, % sesiones verificadas, racha promedio.
- Conversión a premium (separando simulado vs real), MRR (solo real).
- healthz de Supabase/Edge, uso del free-tier (regla del 30%).

### H. Servidor y salud [SRE]

- Estado de migraciones (cuáles aplicadas).
- Logs/estado de Edge Functions; botón de redeploy de la Edge Function.
- Uso de free-tier: DB, Storage, invocaciones de Edge.

### I. Privacidad y datos

- Exportar/borrar datos de usuario (GDPR/LGPD).

### J. Recompensas RESIS (acta 008)

- Cuando exista: saldos RESIS, canjes, sponsors. (Placeholder.)

### K. Comunicaciones

- Broadcast: aviso a todos los usuarios (mantenimiento, novedades) vía push/email.

### L. Copilot del Director (IA en la Console)

Asistente IA dentro de la app admin, con conocimiento del proyecto (repositorio,
plan, esquema DB, estado real, métricas y logs). Capacidades de menor a mayor riesgo:

**Nivel 1 — Solo lectura / consulta (sin riesgo)**

- Chat con contexto del proyecto (patrón `ContextBuilder` de `IA_ENTRENADOR.md`).
- Resumen de estado: arquitectura, migraciones, fase del plan v4, deuda técnica.
- Explicar código/config.

**Nivel 2 — Análisis y diagnóstico**

- Analizar logs y métricas; detectar anomalías (entitlements vencidos, sesiones
  rechazadas en masa, usuarios sin `goal_history`).
- Sugerir correcciones de datos/config.

**Nivel 3 — Pruebas asistidas**

- Generar casos de prueba; interpretar resultados de tests y CI.

**Nivel 4 — Correcciones y "hardcodear" (con control)**

- Correcciones de config/datos: la IA propone, el PO aprueba, se aplica vía las
  Edge Functions admin auditadas.
- Cambios de código/migraciones/config: la IA genera un **diff/PR**; **nunca se
  auto-aplica a producción** — el PO revisa y mergea.
- Operaciones masivas: preview/diff de a quién le toca qué → confirmación del PO → auditado.

**Guardarraíles L ([SEC])**

- La IA nunca tiene `service_role`; actúa solo a través de las Edge Functions admin
  (rol + auditoría).
- Nada se auto-aplica a producción: la IA _propone_, el PO _decide_.
- Si la IA lee datos controlados por usuarios (apodos, gyms), es vector de prompt
  injection: la salida es no confiable y nunca dispara una escritura por sí sola.
- La IA es herramienta, nunca autoridad.

**Dónde vive la IA**

- **Costo cero** (regla del PO): empezar con modelo local (Qwen3.5-2B / llama.cpp,
  patrón `IA_ENTRENADOR.md`) corriendo en la PC dentro de la Electron. Sin API de pago.

## Fases de construcción

- **Fase A — Base segura (OBLIGATORIA antes de exponer cualquier botón)**: migración
  `0016` (`admin_users`, `entitlements`, `admin_audit_log`, `app_config`, `feature_flags`),
  Edge Functions admin + guard de rol + auditoría. **Test: un no-admin recibe 403;
  toda acción queda auditada.**
- **Fase B — Núcleo premium**: gestión de entitlements + simulador de ciclo de vida.
  **Test: free↔premium↔expirado end-to-end.**
- **Fase C — Pagos simulados + contenido**: `is_simulation`, replay RevenueCat,
  FEATURE_DATE/pool, catálogo, flags.
- **Fase D — Rankings, métricas, salud, GDPR, broadcast**: oversight completo.
- **Fase E — Copilot IA**: Nivel 1 → 2 → 3 → 4.

## Riesgos que el equipo deja anotados

- **[SEC]**: es la superficie de mayor riesgo; si la auth queda floja, regala premium
  a cualquiera. Mitigación: Fase A antes de exponer botones + auditoría.
- **[BE]**: un solo camino de escritura de entitlements.
- **[DATA]/[FIN]**: datos simulados no contaminan métricas ni MRR.
- **[PM]**: esto adelanta trabajo de Fase 7/8; la F1 del plan sigue siendo la base
  (la Console la usa, no la reemplaza). La IA es la parte más ambiciosa: al final.
- Coherencia con el ADR `2026-09-29_free-sin-ranking_premium-todo`: el free en la app
  nunca ve rankings.

## App móvil (integración futura)

La app móvil **no** se conecta directamente a la Console. Lee entitlements vía el
servidor (RLS select-own) para desbloquear la UI premium. La Console escribe el
entitlement; la app lo refleja al refrescar. Regla dura: el premium se decide en el
servidor, nunca en el cliente.

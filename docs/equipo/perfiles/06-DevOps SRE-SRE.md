# [SRE] — DevOps / SRE — "el guardián del free-tier"

## 1. Quién es

Soy quien cuida la infraestructura para que **el costo sea 0 mientras no hay
ingresos y nunca supere el 30% del ingreso bruto después** (escalera T0–T4,
19.6). Si un proyecto free se pausa, si un backup no corre, si un tope se
acerca en silencio, es mi fault. El dinero se gasta en producto, no en que un
scheduled job duerma.

## 2. Lo que defiendo siempre

- **Mitigaciones del plan gratis activas y monitoreadas** (19.3): cron
  `healthz` cada 20–30 min (anti-pausa de Supabase free), `pg_dump` semanal a
  Storage, evidencias con retención de 30 días, backups sin PITR cubiertos.
- **Alertas tempranas al 60/80%** de DB, Edge Functions, Storage y MAU.
- La **regla del 30%**: la infra paga con ingreso ya generado, nunca antes.
- Secretos fuera del repo (env de EAS, `supabase secrets`).

## 3. Stack y fuentes

- Vercel (cron + hosting panel/políticas), Supabase free (DB/Storage/Auth/
  Edge/Realtime), EAS Build/Submit, PostHog/Sentry, GitHub Actions (minutos
  acotados).
- Fuentes: `PLAN_COMPLETO.md` (19.1–19.6, 18.4 rendimiento), perfiles [BE]
  (particiones) y [FIN] (costos).

## 4. Pre-flight de cualquier tarea de infra

1. ¿Cómo impacta esto en el free-tier o en los topes? (¿nueva tabla grande?
   ¿nuevo endpoint público?)
2. ¿Backups cubren el dato nuevo? (¿entra en `pg_dump` semanal?)
3. ¿El cron `healthz` y las alertas siguen funcionando?
4. ¿Metrics nuevas visibles en el dashboard de costos/topes?
5. ¿Secretos en el lugar correcto (no en el bundle, no en el repo)?

## 5. Cómo trabajo por tipo de tarea

- **Anti-pausa**: verifico que `healthz` responde y está agendado; si falla,
  runbook "proyecto pausado" = llamada al cron + aviso a [PM].
- **Backups**: `pg_dump` semanal a bucket separado; pruebo **restauración**
  (un backup que no se restaura no es backup); en Pro, activar PITR como
  adicional.
- **Rendimiento**: bundles por pestaña (lazy), caches, y — con [CV]/[MOB] —
  límites de batería/térmica de la cámara; `ad_impressions` particionada por
  mes (con [BE]).
- **Escalera T0–T4**: cuando un tope pasa el 60%, aviso; al 80%, plan de
  migración a pago financiado con el ingreso actual (nunca al revés).
- **CI/CD**: builds de EAS por fuera de Actions, workflows solo en push/PR a
  main, pnpm cacheado (19.3.4).

## 6. Entregables

- Runbooks (qué hacer si: proyecto pausado, Storage lleno, cron caído, tope
  alcanzado).
- Reporte mensual de costos vs ingreso (regla del 30%).
- Dashboard de topes con alertas (60/80%).

## 7. Interacción con otros roles

- **[BE]**: migraciones con particiones/índices; runbook de redeploy.
- **[FIN]**: le paso el reporte de costos para la demo mensual.
- **[QA]**: entornos de staging replicables para E2E.
- **[PM]**: aviso de riesgo de topes con anticipación para planificar.

## 8. DoD del rol

- Cron `healthz` activo y verificado (el proyecto nunca en pausa).
- Backup semanal probado: al menos una restauración exitosa por mes.
- Alertas de topes operativas y nadie se entera "por la factura".

## 9. Errores típicos que evito

- "Ya funciona en mi máquina" — todo se valida en el entorno real de
  Supabase/Vercel.
- Esconder un tope alcanzado hasta el último minuto.
- Backups "por si las moscas" que nunca se restauran.

## 10. Señales rojas

- Projects free pausándose (cron caído o no programado).
- Storage acercándose a 1 GB sin migrar evidencias a R2/S3 (T3+).
- Edge Functions a >40% sin que nadie avise.

## 11. Qué le pregunto al PO

- Decisión económica ante un tope: migrar a pago (aunque el ingreso aún no lo
  cubra del todo) vs restringir features gratis.

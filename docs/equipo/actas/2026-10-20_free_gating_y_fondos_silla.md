# Acta 024 — Free sin reto diario, ranking visible sin participar, y fondos_silla completado

- **Fecha**: 2026-10-20 · **Tipo**: producto (gating free/premium) + corrección de catálogo (prod) + doc de monetización.
- **Estado**: **aprobado por el PO** (probado en dispositivo: sesión de `fondos_silla` en Modo Libre funciona).
- **Participan**: [PO] (decide), [PM] (alcance), [MOB] (UI), [BE] (catálogo/edge), [UX] (copy), [QA] (verificación), [CV] (fondos_silla), [SEC] (DDL/RLS), [LEG] (monetización).
- **Relacionada**: actas 018/020/021/022/023; ADR `2026-09-29_free-sin-ranking_premium-todo.md`; ADR nuevo `2026-10-20_flujo_pago_premium_store.md`; migración `0021`.

## 1. Pedido del PO

1. Un usuario **free no puede ver el reto diario**: se queda en la pantalla del reto con una notificación.
2. El **free no participa del ranking**, pero **puede verlo** para tentarse a Premium.
3. **Aclarar en Ranking y en Inicio** que participar es Premium.
4. Además: **completar `fondos_silla`** en Supabase (lo detectó otro asesor).

## 2. Decisión (gating)

|             | Modo libre | Reto diario | Racha | Ranking (ver)  | Ranking (participar) |
| ----------- | ---------- | ----------- | ----- | -------------- | -------------------- |
| **Free**    | ✅         | ❌          | ❌    | ✅ (se tienta) | ❌                   |
| **Premium** | ✅         | ✅          | ✅    | ✅             | ✅                   |

- El free ve la **tab Retos** pero dentro encuentra una tarjeta de aviso: no hay botón INICIAR ni acceso a la cámara del reto.
- El free ve la **tab Ranking** con las listas y un aviso de que para participar necesita Premium.
- El **descenso a free no borra datos** (racha, récord, reps, historial): solo congela la participación. Ver análisis en BITACORA.

## 3. Cambios en el cliente (implementados)

- **`app/(tabs)/_layout.tsx`**: la tab **Ranking ya no se oculta** al free (se quitó `href: premium ? undefined : null` y el `usePremium` que quedó sin uso).
- **`app/(tabs)/index.tsx`**: aviso `home.free_retos` bajo la tarjeta del reto; aviso `home.free_ranking`; el botón **VER RANKING ahora es visible para el free** (antes se ocultaba con `null`).
- **`app/(tabs)/retos.tsx`**: para free, en vez de INICIAR se muestra una **caja Premium** (`retos.premium_title/body/cta`) que solo muestra el aviso (no hay pantalla de compra todavía); además el bloque de cámara del reto ahora exige `premium`, así el free nunca la monta.
- **`app/(tabs)/ranking.tsx`**: aviso `progress.ranking_premium` arriba de la card para free.
- **i18n es/en/pt**: claves nuevas `home.free_retos`, `home.free_ranking`, `retos.premium_title/body/cta`, `progress.ranking_premium` (las tres lenguas sincronizadas).

## 4. Catálogo: `fondos_silla` completado en prod

**Hallazgo:** el catálogo móvil listaba **9** ejercicios (incluido `fondos_silla`, premium), pero la tabla `exercises` de prod tenía un **CHECK que hardcodeaba 8 códigos**; la edge rechazaba cualquier sesión de `fondos_silla`. Cámara v53, técnica e i18n ya lo soportaban.

**Acción (autorizada por el PO):** en prod `cgaxpmmbpwaefaigsisu` se recreó `exercises_code_check` con `fondos_silla` y se insertó la fila (premium, reps, nombres es/en/pt). `exercises`: **8 → 9**.

**Replicado:** migración `supabase/migrations/0021_exercise_catalog_fondos_silla.sql` (idempotente).

**Prueba del PO:** sesión real de `fondos_silla` en Modo Libre → **funciona bien**.

## 5. Verificación

- `pnpm typecheck` ✓ · `pnpm lint` ✓ · **221/221 tests (19 suites)** ✓.
- Sin cambios de cámara (v53), sin dependencias nuevas, sin tocar `app.json` (aprendizaje del crash por `expo-notifications`).
- Prod: `select code, tier from public.exercises` → 9 filas, `fondos_silla` premium.

## 6. Documentación de monetización (sin código)

ADR `2026-10-20_flujo_pago_premium_store.md`: cómo se pasa un free a Premium pagando en la store (Play → RevenueCat → webhook firmado → Supabase → entitlements), qué existe y qué falta (SDK de compra, paywall real, edge `revenuecat_webhook`), y la ruta crítica (paywall mock → medir → recién ahí pagar cuentas).

## 7. Límites / pendientes

- **No hay pantalla de compra Premium**: el CTA del reto muestra un aviso, no navega a un paywall (no existe todavía).
- **Pendiente [BE]**: gate premium del reto/racha en la edge `validate_workout` (hoy sigue escribiendo reto/racha para todos en el camino server-side). Requiere deploy con OK del PO.
- **DDL aplicado a mano en prod**: la migración 0021 deja la fuente versionada.
- **Sin usuarios en producción**: la lógica se cambió sin migración de datos.

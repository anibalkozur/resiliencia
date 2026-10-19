# Acta 021 — Pestaña Inicio: rediseño compacto y responsive (Fase 1)

- **Fecha**: 2026-10-19 · **Tipo**: UX/pantalla · **Fase**: 1 (producto).
- **Estado**: **implementado, aprobado por el PO y commiteado** (`f3e6df8`).
- **Participan**: [PO] (pide y aprueba), [UX] (auditoría de vicios + propuesta), [MOB] (implementación), [QA] (verificación).
- **Relacionada**: acta 020 (Retos en dos pantallas). ADR free-sin-ranking (el ranking que enlaza Inicio es sólo premium).

## 1. Motivo

El PO pidió **acomodar la pestaña Inicio**: que el diseñador vea los vicios, un **diseño más compacto**
y que el equipo evalúe **qué más se podría colocar ahí**, con el requisito explícito de **usar bien el ancho**
y que la información se acomode **en cualquier pantalla**.

## 2. Auditoría de vicios (evidencia, `app/(tabs)/index.tsx` antes del cambio)

1. Aire muerto arriba: `container.paddingTop: spacing.xl` y un estilo `title` de 32px que **no se usaba**.
2. Sin scroll ni safe-area inferior: el contenedor era un `View` fijo y el FAB IA iba `position:'absolute'`
   con `bottom: spacing.lg`, sin `insets.bottom` → recorte con fuente grande o textos de varias líneas.
3. Jerarquía invertida: meta 40px vs. nombre 28px, y la racha también 40px (dos "40" compitiendo).
4. Tres estilos casi iguales (cardLabel/chipText/streakLabel) y `letterSpacing: 2` sobreusado.
5. Bloques sin relación visual: tarjeta + caja de racha flotante + "mañana" suelto.
6. Estado vacío inexistente: con `challenge === null` renderizaba `null` (racha huérfana).
7. CTA muerto ("REALIZADO" deshabilitado sin acción) y **VER RANKING** sólo a premium.
8. **Bug latente**: el chip "Día N" usaba `completedCount + 1` → un día de más tras completar.
9. Hardcode `#1d5c3a` en el FAB; accesibilidad declarada sólo en el FAB.

## 3. Propuesta de datos (Fase 1, sólo fuentes existentes)

| Idea                                          | Fuente                            | Estado              |
| --------------------------------------------- | --------------------------------- | ------------------- |
| Aviso de sincronización (pendiente/rechazado) | `getCompletionSyncState`          | integrado en el CTA |
| **Mejor racha**                               | `getBestStreak` (existía sin uso) | texto discreto      |
| **Último entrenamiento**                      | `buildHistory` (offline-first)    | tira de una línea   |
| **Días N/M**                                  | `buildWeek` + `isCompleted`       | tercera métrica     |

Fuera de alcance (acordado): peso/IMC/WHtR (textos de salud, [MED]), notificaciones (dependencia nueva
expo-notifications), accesos rápidos y consejo del día (guía técnica sin localizar).

## 4. Cambios (`app/(tabs)/index.tsx`)

- **Tarjeta a todo el ancho**: "RETO DE HOY" + ejercicio a la izquierda (`numberOfLines={2}`, `flexShrink`)
  y la **meta** grande alineada a la derecha.
- **Franja de 3 métricas** en una fila (Racha · Completados · Días `N/M`) con divisores finos, en vez de los
  2 chips y la caja de racha flotante. `N/M` cuenta sólo los días de entrenamiento de los últimos 7.
- **Tira de una línea** con "Mañana: X" y "Último: ejercicio V"; **mejor racha** y **VER RANKING** como texto
  discreto.
- **Responsive**: `ScrollView` real + `paddingBottom` con `insets.bottom`; FAB IA con `bottom` por safe-area;
  `paddingHorizontal: spacing.sm` (8) para llegar casi al borde; sin anchos fijos.
- **Estados**: **skeleton** cuando falta el reto (antes `null`); el estado de sync se integra al CTA.
- **Limpieza**: se quita `#1d5c3a` (usa `colors.line`), se corrigen imports duplicados y `GOAL_TRANSLATION_KEYS`
  sin uso.
- **Soporte**: `packages/design-tokens` suma `spacing.xxl`; i18n suma `home.days_short`, `home.last`, `home.best`
  (es/en/pt).

## 5. Verificación

- `pnpm typecheck` (root) ✓ · `pnpm lint` (root, 0 warnings) ✓ · `pnpm --filter mobile test` **214/214 (18 suites)** ✓.
- **Aprobado por el PO** en dispositivo: "ok, probado" → "ok, aprobado".
- Sin cambios de cámara (v53), sin migración y sin deploy de edge.

## 6. Límites y notas

- El **saludo** vive en el header (`BrandHeader` + `greetingKey`), no en pantalla.
- "Mejor racha" se muestra siempre (incluso 0) como texto; "primer reto" (`home.first_streak`) sólo con racha 0.
- La tercera métrica (`Días N/M`) es la de mayor riesgo visual en pantallas muy angostas por el rótulo
  "DÍAS"/"DIAS"; se eligió `flex: 1` + font 10 para que quepa, pero conviene mirarlo en 320px.

## 7. Acciones

1. **[UX]**: auditoría de vicios y propuesta de datos. — **Hecho**.
2. **[MOB]**: implementación del layout compacto/responsive. — **Hecho**.
3. **[QA]**: typecheck/lint/tests en root. — **Hecho**.
4. **[PO]**: probar y aprobar. — **Hecho (OK)**.
5. **[PM]**: commit + acta 021 + BITACORA + backup local Punto 26. — **Hecho**: `f3e6df8`.

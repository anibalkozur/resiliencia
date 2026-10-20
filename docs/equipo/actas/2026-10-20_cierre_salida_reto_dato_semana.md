# Acta 023 — Cierre: salida automática del reto + dato de la semana en Inicio

- **Fecha**: 2026-10-20 · **Tipo**: cierre de entregas aprobadas por el PO · **Estado**: **APROBADO**.
- **Participan**: [PO] (prueba y aprueba), [MOB]/[UX]/[QA] (cambios), [PM] (cierre y protocolo).
- **Relacionada**: acta 018 (cadencia/vida/aguante), acta 020 (Retos en dos pantallas), acta 021 (Inicio
  compacto), acta 022 (dato de la semana + Fase 2 documentada).

## 1. Motivo

Cerrar con el protocolo de guardado y registro dos entregas que quedaron en disco ayer y hoy fueron probadas
en dispositivo por el PO:

1. **Auto-salida del reto** al completar (fix del bug "REPETIR queda activo").
2. **Tarjeta "DATO DE LA SEMANA"** en Inicio (Fase 1 del pedido de "flyer semanal").

## 2. Qué se entrega

### 2.1 Auto-salida del reto al completar (`apps/mobile/app/(tabs)/retos.tsx`)

El reto abre la cámara con `strict=1` y **sin** `ranked=1`; por eso la cámara quedaba viva tras completar y
mostraba `REPETIR`, y `retos.tsx` ignoraba `data.type === 'repeat'` → repetición ilimitada.

- Al llegar un `complete` **válido** (`reps >= target`) se llama a `setDone(...)` de forma **sincrónica** y a
  `exitChallenge()`, que vuelve a `fase='inicio'` mostrando la caja **"RETO COMPLETADO"** sin parpadeo.
- Se quitó el `setDone` duplicado del bloque asíncrono.
- **Opción elegida por el PO**: salida automática a Inicio, **sin** tocar la cámara ni deployar.
- Si **no** completa, `REPETIR` sigue funcionando igual (comportamiento de acta 018).

### 2.2 Dato de la semana en Inicio (`apps/mobile/src/retos/weeklyFact.ts` + `index.tsx` + i18n)

Tarjeta **"DATO DE LA SEMANA"** con contenido propio que rota de forma **determinística por semana ISO** —
sin red, sin backend, sin copyright. 7 datos curados, i18n es/en/pt (`weekly.title` + `weekly.<id>.title|body`).
Test nuevo `weeklyFact.test.ts`.

### 2.3 Texto de racha (`apps/mobile/src/i18n/translations.ts`)

`home.streak`: **DÍAS DE RACHA** (es) / **STREAK DAYS** (en) / **DIAS DE SEQUÊNCIA** (pt). Antes "RACHA HOY".

## 3. Verificación

- `pnpm --filter mobile typecheck` ✓ · `lint` ✓ · `test` **221/221 (19 suites)** ✓.
- **Prueba en dispositivo del PO (2026-10-20)**: completado el reto del día, al terminar las repeticiones la
  app **salió sola a la pestaña Retos** con la caja de reto completado. **Aprobado**.
- Sin cambios de cámara (v53), sin migración, sin edge, sin dependencias nuevas.

## 4. Alcance y límites

- Fase 1 es **editorial** (tips curados), no personalizada; rotación global, no por historial.
- **Fase 2** (competencias geolocalizadas) queda **sólo documentada** en el acta 022, con decisión de
  privacidad tomada (**ciudad del perfil, sin GPS**). No se construye en modo lean.

## 5. Estado y siguiente paso

- Entregas **aprobadas y cerradas** con protocolo completo (commit + push + BITACORA + backup local).
- Próximo: retomar lo que priorice el PO; Fase 2 sólo cuando haya usuarios u organizador real.

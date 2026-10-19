# Acta 020 — Retos en dos pantallas: presentación del reto + cámara a pantalla completa

- **Fecha**: 2026-10-19 · **Tipo**: UX/pantalla · **Fase**: 1 (producto).
- **Estado**: **implementado, aprobado por el PO y commiteado** (`87e308b`).
- **Participan**: [PO] (pide y aprueba), [UX]/[MOB] (pantallas), [QA] (verificación).
- **Relacionada**: acta 018 (cadencia/vida del reto), acta 019 (el reto cuenta en Reps),
  pantalla intermedia "ANTES DE EMPEZAR" de Libre (commit `aee932e`).

## 1. Motivo

El PO pidió separar la pestaña Retos en dos pantallas:

1. Una pantalla con **el reto del día y su explicación**, y **abajo el botón de iniciar**.
2. Al iniciar, la pantalla del ejercicio **sin** "TU SEMANA", sin los días de la semana, sin
   "RETO DE HOY" y sin la ayuda del ejercicio: **ese espacio se le da a la cámara**.

## 2. Cambios

Sólo `apps/mobile/app/(tabs)/retos.tsx`.

### 2.1 Una sola variable de fase

`camaraAbierta` + `retoSalido` + `showStartBox`/`showDoneBox` se reemplazan por
`fase: 'inicio' | 'camara'`:

- `exitChallenge()` (SALIR nativo o `exit` de la WebView) → `fase = 'inicio'`.
- Completar **no** cambia de fase: la cámara queda montada para REPETIR/SALIR.
- `REINTENTAR` (rechazado) → `fase = 'camara'` + `retrying`.
- `cameraVisible = challengeBlock && fase === 'camara' && focused` sigue mandando el
  botón nativo de SALIR del header y ahora también el alta/baja de la suscripción a
  `DeviceMotion` (antes corría también en la pantalla de inicio).

### 2.2 Pantalla de inicio

Conserva el encabezado **TU SEMANA** + fila de 7 días (decisión del PO: no se borra) y
suma una tarjeta con **RETO DE HOY**, el nombre del ejercicio, el objetivo
(`{meta} reps|seg` vía `unit.reps`/`unit.seconds`) y la **guía técnica completa**
(`TECNICA[id].guia`), con el botón **INICIAR** abajo del todo
(`startWrap` con `justifyContent: 'space-between'`).

La caja "empezar de nuevo" (`showStartBox`) desaparece: la tarjeta de inicio ya cumple
ese rol. La caja de **completado** se mantiene (con CTA o REINTENTAR).

### 2.3 Pantalla del ejercicio

`fase === 'camara'` renderiza **sólo** la WebView dentro de `cameraContainer`. Se
eliminaron del JSX y de los estilos: `topSection`/`titleRow`/`weekRow`, `challengeBar`,
`challengeTop`, `cameraTitle`, `cameraMeta` y `cameraGuide`.

## 3. Verificación

- `pnpm --filter mobile typecheck` ✓ · `lint` ✓ · `test` **214/214 (18 suites)** ✓.
- Sin cambio de cámara: `camera-verification.html` sigue en **v53** (`gh-pages f1aa0ca`);
  sin bump de versión ni deploy de edge, **sin migración**.
- **Aprobado por el PO** (2026-10-19): "buena decisión… quedó muy bien, aprobado".

## 4. Límites y notas

- El encabezado **TU SEMANA** queda sólo en la pantalla de inicio; si el PO quiere
  sacarlo también de ahí, es un cambio de una línea.
- Al cambiar de pestaña con `fase = 'camara'`, volver re monta la cámara en frío
  (mismo comportamiento que antes del cambio).
- La guía técnica vive en `src/lib/tecnica.ts` y **no se localiza** (sólo español):
  texto preexistente, fuera de alcance.

## 5. Acciones

1. **[UX]/[MOB]**: split de pantallas en `retos.tsx`. — **Hecho**.
2. **[QA]**: typecheck, lint y 214 tests. — **Hecho**.
3. **[PO]**: probar y aprobar. — **Hecho (OK)**.
4. **[PM]**: commit + acta 020 + BITACORA + backup local Punto 25. — **Hecho**: `87e308b`
   (código) y registro en esta sesión.

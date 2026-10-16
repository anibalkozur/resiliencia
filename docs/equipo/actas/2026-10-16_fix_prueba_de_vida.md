# Acta 015 — Fix de la prueba de vida (mano) en ejercicios con anti-trampa de postura

- **Fecha**: 2026-10-16 · **Tipo**: bug (cámara/producción) · **Fase**: 1 (producto, cámara).
- **Estado**: **resuelto, publicado y probado por el PO** (cámara v53).
- **Participan**: [PO] (reporta y valida), [CV]/[DER], [MOB].

## 1. Motivo

Al probar **Fondos en silla** (`fondos_silla`, premium, por repeticiones) el PO
completó la serie y, al pedir la **prueba de vida**, levantó la mano por encima
de la cabeza **varias veces** y la cámara **no la detectaba** ("SEÑAL VIDA"
quedaba fijo). En sentadillas (frontal) la señal sí funcionaba.

## 2. Causa raíz

La detección de vida con mano **no era independiente del ejercicio**: vivía
**dentro** de `processFrontal`/`processLateral`, **después** de los gates
anti-trampa de postura, y además exigía el estado calibrado
(`repStateInitialized`):

- `camera-verification.html` (antes del fix): `processLateral` evaluaba
  `checkHandLiveness` **después** del gate `kneeExtendMin`.
- `fondos_silla` exige **rodilla extendida** (`kneeExtendMin: 150`). Al terminar
  la serie y levantar el brazo (aunque con las piernas no perfectamente
  estiradas), el gate hace `return` temprano y **reinicia la calibración**
  (`repStateInitialized = false`) → el código **nunca** llegaba a leer la mano.

La prueba de vida es una señal **deliberada del usuario** (independiente del
ejercicio) y no debe quedar bloqueada por los anti-trampa, cuya función es
sancionar el conteo, no la vida.

## 3. Fix

`camera-verification.html` (y el banco espejo):

- La vida de mano se evalúa **al inicio de `processPose`**, **antes de cualquier
  gate de postura**: `if (cfg.liveness === 'hand' && checkHandLiveness(lm)) return;`.
- Se elimina el requisito de `repStateInitialized` para la vida.
- Se quitan los call sites duplicados en `processFrontal` y `processLateral`.
- Visibilidad de muñeca **0.5 → 0.3** y `LIVENESS_FRAMES` **5 → 3** (más
  tolerante a oclusión/parpadeo del pose, sin relajar el umbral de posición
  `muñeca.y < hombro.y − 0.05`).

Beneficio colateral: mejora la vida en los demás ejercicios con gates
(abdominales, puente de glúteos, escaladores).

## 4. Cadencia de ejercicios por repeticiones (decisión)

La cadencia es un **máximo de descanso entre repes** (cuenta atrás tras cada
repe), no un tiempo fijo por repe; solo se **sanciona** en modo **rankeado**
(si te pasás, la serie queda "fuera de ranking"). Se completó `REP_CADENCE`
para los ejercicios por repeticiones nuevos y se **unificó el fallback en 6 s**
(el default de la cámara y de `chat.ts`; antes `camretos.tsx` usaba 5):

| ejercicio     | unidad | cadencia |
| ------------- | ------ | -------- |
| sentadillas   | reps   | 5 s      |
| flexiones     | reps   | 5 s      |
| abdominales   | reps   | 3 s      |
| zancadas      | reps   | 4 s      |
| puente_gluteo | reps   | 4 s      |
| fondos_silla  | reps   | 5 s      |
| (fallback)    | reps   | 6 s      |

Los ejercicios por tiempo/cuenta (`plancha`, `mountain_climbers`,
`sentadilla_isometrica`) **no** usan cadencia (la cámara solo la aplica en reps).
`DEFAULT_CADENCE_SEC = 6` en `catalog.ts`; `camretos.tsx` y `chat.ts` lo usan.

## 5. Verificación

- `node --check` del `<script>` de `camera-verification.html` y del banco: OK.
- Banco y espejo **idénticos** (MD5).
- App: `VERIFY_VERSION` **52 → 53**; typecheck ✓, lint ✓, jest **198/198** (16 suites); typecheck OK.
- Publicado en **gh-pages** (`camera-verification.html` + `camera-verification-bench.html`);
  CDN confirmado sirviendo el fix.
- **Probado por el PO en Expo Go: OK** (la señal de vida ya se registra en
  Fondos en silla).

## 6. Acciones

1. **[CV]/[DER]**: fix de la vida independiente de los gates — **Hecho**.

- **[MOB]**: cadencia de premium + unificación del fallback, tests y docs — **Hecho**.
- **[PO]**: validó en Expo Go. — **Hecho**.

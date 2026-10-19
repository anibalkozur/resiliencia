# Acta 018 — Reto diario: corte por cadencia con REPETIR + fix de la vida de aguante + cadencia 6 s

- **Fecha**: 2026-10-18 · **Tipo**: bug (cámara/UX) + decisión de producto · **Fase**: 1 (producto, cámara).
- **Estado**: **implementado, publicado en gh-pages (v53) y probado por el PO en dispositivo (OK)**. Commiteado y
  pusheado (`7aea329`).
- **Participan**: [PO] (reporta y decide), [CV]/[MOB] (fix), [QA] (verificación).
- **Relacionada**: acta 015 (fix de la vida de _mano_ en ejercicios con anti-trampa), acta 012 (política
  "solo se rankea con vida"), acta 016 (ranking de rutina).

## 1. Motivo

Tres pedidos del PO al probar el **reto del día** (flexiones) en el teléfono:

1. Al **fallar una repe** en el reto no podía **reiniciar** (en modo libre sí aparece REPETIR).
2. La **señal de vida** pidió "bajar y aguantar"; el PO bajó y se quedó en el piso, pero la cámara **no la tomó**
   ("creo que la señal de vida está mal configurada").
3. **Todas** las cadencias de ejercicios por repeticiones deben ser **6 s** (12 s en la repe con la vida);
   flexiones tenía **5**, abdominales 3, zancadas 4.

## 2. Causa raíz

### 2.1 Vida de aguante bloqueada por los gates de postura

La vida **'hold'** ("Bajá y aguantá abajo", flexiones y plancha) vivía **dentro** de `processLateral`,
**después** de los gates anti-trampa (`checkComplete`, `grounded`, `line`, `kneeExtendMin`, calibración). Es
**el mismo defecto que el acta 015** ya había corregido para la vida **'hand'** —"cualquier desvío de postura
dejaba la señal ignorada para siempre"—, pero el arreglo **nunca se aplicó a 'hold'**.

Al bajar a aguantar en flexiones, cualquier desvío de postura (muñeca ocluida, cadera hundida, tobillo fuera
de cuadro) hacía que un gate devolviera temprano **antes** de leer la señal → la vida quedaba ignorada.

Evidencia (antes del fix): el único call site de `checkHoldLiveness` estaba en `processLateral`, después de los
gates; la vida 'hand' ya se evaluaba en `processPose`, antes de los gates (`camera-verification.html`).

### 2.2 El reto no cortaba la serie

`MODE_RANKED` (`ranked=1`) era la **única** condición que cortaba la serie por cadencia (`registerRep`,
`cadenceTick`, `extendCadenceForLiveness`, `failSeries`). El reto del día abre la cámara **sin** `ranked`, así
que la cadencia solo se mostraba y **nunca** cortaba → sin `failSeries` no había REPETIR.

## 3. Fix

`camera-verification.html`:

- **`STRICT_CADENCE = MODE_RANKED || qs.get('strict') === '1'`**: la cadencia de corte se aplica en ranking
  **y** cuando el reto pide `strict=1`, sin rankear la sesión (`seriesOk` sigue calificando solo a ranking).
  Se usa en `registerRep`, `cadenceTick` y `extendCadenceForLiveness`.
- **Vida de aguante fuera de los gates** (espejo del fix del acta 015): nueva `checkHoldLivenessPose(lm)` que se
  evalúa **al inicio de `processPose`, antes de cualquier gate**, junto a la vida 'hand'. Se **elimina** el call
  site duplicado dentro de `processLateral`.
- **Umbral de "abajo" congelado**: los gates reinician `dynamicDownThresh`, así que la vida de aguante
  **captura** el umbral (`livenessDownThresh`) al **armarse** el desafío (repe 5 o al terminar la serie) y al
  **arrancar**; así no depende de que los gates sigan recalibrando mientras se aguanta.
- Mensajes: `failSeries` distingue ranking de reto ("…se cortó, reiniciá cuando quieras"); `stopCamera` muestra
  "Serie cortada" / "Serie cortada por pausa larga — tocá REPETIR" cuando la serie se cortó sin rankear.

`apps/mobile`:

- `src/retos/verify.ts`: nueva opción `strict?: boolean` → `strict=1`.
- `app/(tabs)/retos.tsx`: el reto pasa `strict: true` + `cadenceSec: REP_CADENCE[id] ?? DEFAULT_CADENCE_SEC`.
- `src/retos/catalog.ts`: `REP_CADENCE` **todo en 6 s** (sentadillas, flexiones, abdominales, zancadas,
  puente de glúteo, fondos en silla). La repe con vida suma 6 s → **12 s** (`extendCadenceForLiveness`).

Sin bump de `VERIFY_VERSION` ni cambio de servidor: los nuevos params (`strict`, `cadence`) cambian la URL del
WebView, así que la caché del navegador no sirve el cuerpo viejo. `ALLOWED_EVIDENCE_VERSIONS = {12,13,53}` intacto.

## 4. Verificación

- `node --check` del `<script>` de `camera-verification.html`: OK.
- `pnpm --filter mobile typecheck` OK · `lint` OK · `test` **214/214 (18 suites)** OK
  (nuevo `src/retos/__tests__/verify.test.ts`).
- Publicado en **gh-pages**: `6bab0f2` (reto con cadencia estricta + REPETIR) y `f1aa0ca` (vida de aguante +
  cadencia 6). CDN confirmado sirviendo ambos cambios (ETag actualizado, `checkHoldLivenessPose`/`livenessDownThresh`
  presentes).
- **Pendiente**: ~~prueba del PO en dispositivo~~ — **probado y OK (2026-10-18)**: vida de aguante en flexiones y
  REPETIR al fallar una repe.

## 5. Límites y notas

- La vida **sigue siendo reportada por el cliente** (no es prueba criptográfica); el fix no cambia el modelo de
  confianza, solo hace que la señal **deliberada** del usuario no quede bloqueada por los anti-trampa.
- El **banco** (`camera-verification-bench.html`, v48) **no** se tocó: es el sandbox y ya divergió del prod.
- La vida de aguante igual requiere mantener la posición "abajo" **~2 s continuos** (`LIVENESS_HOLD_MS`); no exige
  tocar el piso, solo que el **codo** quede flexionado bajo el umbral sin subir.
- `progress.ranking_note` sigue desactualizado (fuera de alcance).

## 6. Acciones

1. **[CV]/[MOB]**: fix de la vida de aguante fuera de los gates + cadencia estricta del reto + cadencia 6 s. — **Hecho**.
2. **[QA]**: `node --check`, typecheck/lint/tests y verificación CDN. — **Hecho**.
3. **[PO]**: probar en dispositivo (flexiones: vida de aguante; fallar una repe: REPETIR). — **Hecho (OK)**.
4. **[MOB]/[PM]**: commit en `main` (cámara + `verify.ts` + `retos.tsx` + `catalog.ts` + test) cuando el PO lo
   autorice. — **Hecho**: `7aea329` (y `8a6965c` para la Fase 4); pusheado.

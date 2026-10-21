# Acta 027 — Flexiones en horizontal (celular apaisado) en el banco de pruebas

- **Fecha**: 2026-10-21 · **Tipo**: experimento (banco de pruebas) · **Estado**: **implementado y publicado; PENDIENTE de validación del PO en dispositivo** (no aprobado como característica de producción).
- **Participan**: [PO] (pide y decide), [CV] (cámara/encuadre), [MOB] (implementa), [QA] (verificación), [SRE] (deploy gh-pages), [PM] (alcance y decisión de no tocar producción).
- **Relacionada**: acta 026; `apps/banco de pruebas de ejercicios/README.md` y `PORTAR_A_PRODUCCION.md` (sección 20); `camera-verification.html` de producción **NO se tocó** (sigue en v54).

## 1. Motivo

Pedido del PO: probar flexiones con el **celular en horizontal (pantalla girada 90°)**
para que el cuerpo de perfil entre completo en el cuadro, y con los botones cerca
del pulgar.

Por qué tiene sentido: en vertical el video entra en un cuadro angosto (el
`.video-wrap` es 9:19.5) y el cuerpo de perfil —que está acostado, o sea
**horizontal dentro del cuadro**— no entra completo. En horizontal la cámara
entrega el cuadro ancho (16:9) y el cuerpo entra entero.

## 2. Hallazgo previo: el cálculo de orientación no podía ver el horizontal

El puente nativo (producción y banco) usaba `tilt = atan2(|gz|,|gy|)·180/π` y
`vertical = tilt ≤ 35`, más el guard `Math.hypot(g.y, g.z) < 1`:

- El cálculo **ignora el eje `x`**: con el celular apaisado (gravedad sobre `x`,
  `y ≈ 0`, `z ≈ 0`) daba `atan2(0,0) = 0` → **falso "vertical"**.
- El guard `hypot(gy,gz) < 1` **descartaba la muestra** justamente en ese caso
  (en horizontal `gy` y `gz` dan ~0) → el puente **dejaba de informar la
  orientación** y la página se quedaba con el último valor.

O sea: con el criterio viejo no había forma de distinguir "apaisado" de "vertical",
y ni siquiera de notar que el celular estaba girado.

Marco del sensor usado (independiente de la rotación de la pantalla): `x` =
derecha, `y` = eje largo, `z` = fuera de la pantalla. La gravedad cae sobre `y`
con el celular vertical, sobre `x` con el celular apaisado y sobre `z` si está
acostado.

## 3. Qué se implementó (todo en el banco; producción intacta)

1. **Clasificador de 3 ejes** — `apps/banco de pruebas de ejercicios/src/lib/orientation.ts`
   (nuevo) + `src/__tests__/orientation.test.ts` (nuevo, 7 casos): `portrait` /
   `landscape` / `flat` / `tilted`, con la **misma tolerancia de 35°** pero
   exigiendo que el **eje dominante** sea el esperado (`|y| ≥ |x|` vertical,
   `|x| ≥ |y|` apaisado). Conserva la semántica vertical del cálculo viejo
   (incluso el caso "vertical con el celular rolado", que el viejo aceptaba).
2. **Puente nativo** — `src/screens/TestScreen.tsx`: ahora manda
   `{ available, orientation, vertical, landscape, beta }` en vez de
   `{ available, vertical, beta }`. La página **acepta el contrato viejo**, así que
   el fork no rompe la página de producción. Además el chrome nativo (barra y
   resultado) se compacta cuando la pantalla está en horizontal.
3. **Gate por ejercicio** — `camera-verification-bench.html`:
   `deviceIsVertical` pasa a tres cosas (`deviceIsVertical`, `deviceIsLandscape`,
   `deviceOrientation`); `requiredOrientation()` lee `cfg.orientation` del
   ejercicio activo; `orientationOk()` / `orientationHint()` dan el gate y el
   mensaje ("Girá el celular a horizontal (apaisado)" / "Poné el celular parado en
   vertical"); el badge dice "Vertical" o "Horizontal" según lo que pide el
   ejercicio. El gate se relee en cada frame porque `cfg` cambia dentro de una
   secuencia (`loadExercise`).
4. **Layout en horizontal** — `applyLayout()` + CSS `html[data-layout='wide']`:
   el video toma el alto disponible en 16:9 y los botones quedan fijos en la
   esquina inferior derecha (cerca del pulgar).
5. **Ejercicio del banco** — `flexiones_landscape` ("Flexiones apaisado"): mismo
   CFG que `flexiones` (`type: 'lateral'`, mismos umbrales) más
   `orientation: 'landscape'`. Catálogo, técnica del chat y home con la marca
   "celular horizontal".
6. **La app puede girar** — `app.json` del banco: `"orientation": "portrait"` →
   `"default"`. **Solo del banco**: `apps/mobile` sigue en vertical.
7. **Cache-bust** — `VERIFY_VERSION` 48 → 49 (con su test) y publicación de la
   página en gh-pages.

## 4. Verificación

- `apps/banco de pruebas de ejercicios`: `typecheck` ✓ · `lint` ✓ ·
  **39/39 tests (4 suites)** ✓ (incluye los 7 casos nuevos del clasificador).
- Parseo del HTML del banco con `node --check` (módulo ES) ✓.
- Publicación: `camera-verification-bench.html` en la rama `gh-pages`
  (commit `1fcb838`) y verificado **servido** en
  `https://anibalkozur.github.io/resiliencia/camera-verification-bench.html`
  (contiene `classifyOrientation`, `requiredOrientation`, `orientationOk`, el
  layout `data-layout` y el ejercicio `flexiones_landscape`).
- Las tres copias quedan idénticas (hash SHA-256 `7FF8ADEF…F7495`): raíz del repo,
  carpeta del banco y raíz de `gh-pages`.
- `camera-verification.html` (producción) **sin cambios** en `gh-pages`.

## 5. Alcance y límites (honestidad)

- **No hay validación en dispositivo todavía**: que la app gire con el celular,
  que el cuerpo entre completo y que la cuenta de reps sea la misma que en
  vertical **no está verificado**. Es lo que falta probar.
- **Expo Go puede no respetar el `app.json`**: si en el dispositivo la app queda
  trabada en vertical, la cámara sigue entregando el cuadro angosto y el
  experimento no es testeable ahí (haría falta una build propia).
- La **tolerancia de 35°** es la misma que la del cálculo viejo: un celular
  apaisado apoyado con más de 35° de inclinación se clasifica `tilted` y el gate
  bloquea. Hay que probarlo en el dispositivo y ajustar si molesta.
- El gate en horizontal **cambia el comportamiento** respecto de producción: hoy,
  girar el celular no bloquea nada (la muestra se descartaba y el estado quedaba
  viejo); con este cambio, girar el celular a horizontal **bloquea** los
  ejercicios que piden vertical. Es una mejora, pero si se porta hay que
  probarlo en la app real.
- `apps/mobile` **no se tocó**: ni `verify.ts` (v54), ni `validate_workout`, ni
  `camera-verification.html`. La regla 11 de `AGENTS.md` (bump + edge + deploy)
  aplica a producción; el bump del banco (48 → 49) es propio del banco.

## 6. Próximos pasos

1. PO prueba en el dispositivo: que la app rote, el gate marque "Horizontal", el
   cuerpo de perfil entre completo y las reps coincidan con `flexiones` en
   vertical; los **dos sentidos de giro**.
2. Según el resultado: ajustar (tolerancia, layout, mensaje) o descartar el
   experimento; solo con resultado validado se discute portarlo a la app real
   (sección 20 de `PORTAR_A_PRODUCCION.md`).
3. Sigue pendiente de fondo: gate premium del reto/racha en
   `supabase/functions/validate_workout/index.ts` (requiere OK del PO).

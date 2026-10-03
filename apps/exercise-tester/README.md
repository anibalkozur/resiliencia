# Banco de pruebas de ejercicios (QA)

App **aparte** para probar los 8 ejercicios en el celular. No comparte código con
`apps/mobile`, no escribe en Supabase y no toca la app real.

A diferencia de la versión anterior, **no reimplementa el conteo**: carga por URL
en una WebView una copia de la página de producción hecha para el banco
(`camera-verification-bench.html`), con el mismo puente de inclinación y el mismo
mensaje `complete`.

La página de producción (`camera-verification.html`, la que usa la app real) queda
**intacta**. El banco tiene su propio fork para validar arreglos sin riesgo y recién
después portarlos a mano a producción.

## Cómo correrla (Expo Go)

```bash
pnpm install
pnpm --filter @resiliencia/exercise-tester start
```

Escaneá el QR con Expo Go. La cámara la abre la propia página dentro del WebView;
`expo-camera` solo se usa para pedir el permiso runtime `CAMERA` y `expo-sensors`
para inyectarle la inclinación.

En Windows también anda con el acceso directo del escritorio, que levanta el
servidor y deja el QR listo: `launch-tester.cmd`.

## Qué replica (y cómo)

`src/lib/verify.ts` es copia de `apps/mobile/src/retos/verify.ts`, apuntando a la
copia del banco:

- `VERIFY_URL` = `https://anibalkozur.github.io/resiliencia/camera-verification-bench.html`
- `VERIFY_VERSION` = 16
- `buildVerifyUri(exercise, target, unit, { ranked, cadenceSec })`

## Arreglos en validación (fork del banco)

`camera-verification-bench.html` es la página de producción **más** estos cambios,
todavía sin portar a producción:

- Botón de inicio: `postComplete`/`stopCamera` restauran el texto a `"Reiniciar"`
  (en producción queda "Confirmando sensor…").
- Reps durante la cuenta 5-4-3-2-1: `registerRep` las **ignora** en vez de romper
  la serie (`!gestureStarted`), y los tres caminos de reps muestran el hint
  "Levantá la mano…".
- Segundero de cadencia más visible (72 px, rojo y pulsante en los últimos 2 s).
- Sentadillas (normal e isométrica): `downThresh` 100 → 130, para no exigir tanta
  profundidad (la vista frontal achataba el ángulo de rodilla y pedía casi alinear
  rodillas con caderas).
- Zancadas: pasa de `frontal` a `lateral` (de perfil) para que la rodilla de la
  pierna de atrás no tape el pie; se autocalibra con `downDelta`/`upDelta`.
- Mountain Climbers: se aclara en el instructivo y en los mensajes que se hace
  **de perfil** (la detección ya era `lateral`).
- Zancadas: el selector de objetivo avanza **de 2 en 2** (`step: 2`) para que la
  serie sea par y se trabajen las dos piernas igual.
- Inicio de sesión (mano sobre la cabeza): solo arranca si **todas las partes del
  cuerpo requeridas están en verde**; si falta alguna, no inicia y muestra qué falta.
- Flexiones: el instructivo/mensajes piden estar **en cuclillas** listo para pasar a
  plancha, y la **primera rep** tiene 10 s de margen (`firstRepGraceMs`).

Los diffs exactos para portarlos a producción están en
[`PORTAR_A_PRODUCCION.md`](./PORTAR_A_PRODUCCION.md).

`TestScreen` monta esa URL con los mismos props de WebView que producción
(`camretos.tsx:193-209`) y el mismo puente de sensor: lee `DeviceMotion` con
`expo-sensors` (`setUpdateInterval(200)`, `tilt = atan2(|gz|,|gy|)·180/π`,
`vertical = tilt ≤ 35`) e inyecta
`window.__resilienciaSetNativeOrientation({ available, vertical, beta })`
(`camretos.tsx:113-134`). La página hace el resto: pide el sensor, espera, enciende
la cámara, carga MediaPipe y cuenta.

La app nativa **solo** escucha el mensaje `complete`; el conteo y los gates
(calibración, liveness, cadencia, ranked) quedan en la página.

| Ejercicio             | Tier    | Unidad (página) | Objetivo |
| --------------------- | ------- | --------------- | -------- |
| Sentadillas           | free    | reps            | 20       |
| Flexiones             | free    | reps            | 10       |
| Abdominales           | free    | reps            | 15       |
| Plancha               | premium | segundos        | 30       |
| Zancadas              | premium | reps            | 24       |
| Puente de glúteo      | premium | reps            | 15       |
| Mountain Climbers     | premium | reps            | 30       |
| Sentadilla isométrica | premium | segundos        | 25       |

Los objetivos por defecto son los de `apps/mobile/src/retos/catalog.ts`.

## Discrepancia conocida: mountain climbers

`camera-verification.html` declara `unit: 'reps'` y cuenta una rep por rodilla al
pecho. `apps/mobile/src/retos/catalog.ts:20` declara `unit: 'seconds'`.

El banco carga la página tal cual (reps) y el informe lo marca con `[⚠ unidad]`,
para que no pase desapercibido al portar el cambio.

## Qué mirar en cada corrida

1. Si no se ve nada: revisá que la página cargue (necesita internet para el
   script ESM de `@mediapipe/tasks-vision`, el WASM y el modelo `.task`).
2. Si la cámara no enciende: la página **no arranca** hasta recibir el sensor de
   inclinación; el celular tiene que estar en vertical.
3. ¿Cuenta de más o de menos? Compará con el resultado del informe.
4. ¿La prueba de vida salta cuando debe? Tiene que dispararse en los 8.
5. Al final compará dos corridas (JSON del informe) y portá solo lo que mejore.

## Limitaciones conocidas

- **Prueba la página publicada**, la de gh-pages. Si querés probar un HTML local
  modificado hay que servirlo por HTTPS (origen seguro para `getUserMedia`);
  cargarlo con `source={{ html }}` no alcanza.
- La primera carga necesita internet (CDN de MediaPipe + modelo).
- `onPermissionRequest` no hace falta: el WebView concede `getUserMedia` si el
  permiso runtime `CAMERA` ya está otorgado.

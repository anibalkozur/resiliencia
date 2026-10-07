# Relevamiento completo — ResiliencIA (cámara + sensor + modelo) y su copia al Banco de pruebas

Documento de contexto. Su fin es que cualquiera (yo, en una sesión futura) pueda leerlo
y sepa **exactamente** cómo funciona la verificación por cámara de ResiliencIA y qué hay
que hacer para que el **Banco de pruebas (Ejercicios)** replique esa función **tal cual**.

Decisión tomada: el banco se alinea a producción. Producción carga la página por URL y
cuenta dentro de la página; el banco debe copiar esa función, no reimplementarla.

Fuente de verdad: `C:\Users\Anibal\Dev\resiliencia`.

---

## 0. Cómo usar este archivo

1. Secciones 1–4: qué hace producción y por qué (con `archivo:línea`).
2. Sección 5: en qué se desvía el banco actual.
3. Sección 6: por qué el banco muestra la cámara en negro.
4. Sección 7: el plan para copiar la función tal cual.
5. Sección 8: cómo verificar en dispositivo.

---

## 1. Arquitectura: quién hace qué

- **Toda la verificación visual vive en una página web**: `camera-verification.html`
  (2012 líneas). Pide la cámara, carga MediaPipe, dibuja el esqueleto, corre los gates y
  el conteo, y avisa el resultado por `postMessage`.
- **La app nativa no procesa pose**. Solo: (a) monta la `WebView` apuntando a la URL,
  (b) lee el sensor de inclinación con `expo-sensors` y lo inyecta en la página por
  `window.__resilienciaSetNativeOrientation`, (c) escucha el mensaje `complete`.
- **La página se carga desde GitHub Pages**, no embebida:
  `https://anibalkozur.github.io/resiliencia/camera-verification.html` (`verify.ts:1`).
- **Dos pantallas usan la misma página**: `camretos.tsx` (modo libre) y `retos.tsx`
  (reto diario). Misma mecánica, distinto tratamiento del resultado.

Diagrama de flujo:

```
Usuario elige ejercicio        App (RN)                       WebView (página)
  libreExerciseId       ->  buildVerifyUri()  ->  GET camera-verification.html
  target/unit/ranked            |                 import MediaPipe (ESM)
  toca Empezar          ->  sessionOpen=true       autostart setTimeout 700ms
                                |                   startCamera():
                         monta <WebView uri>          ensureAudio
                                |                       ensureOrientationSensor  <--- espera
                         DeviceMotion (200ms)  ---->    initModel (WASM -> GPU/CPU)
                         __resilienciaSetNative...       getUserMedia -> video.play
                                |                       loop(): detectForVideo -> draw -> processPose
                                |                       conteo/gates en la página
                         onMessage                     post('complete', payload)
                         'complete'            <----
                                |
                         pushFreeSession / markCompleted
```

---

## 2. Anatomía de `camera-verification.html` (producción)

### 2.1 Head y CSS (`1-407`)

- `viewport` con `maximum-scale=1, user-scalable=no` (`5-8`).
- `html, body { height: 100%; background: #030405 }` (`27-35`).
- `.video-wrap` (`66-74`): `position:relative; width:100%; border-radius:16px;
overflow:hidden; background:#000; aspect-ratio:3/4`. **El contenedor de cámara tiene
  relación 3/4**; no depende del alto del body para verse.
- `video, canvas` (`75-83`): `position:absolute; inset 0; width/height 100%;
object-fit:cover`.
- `video`, `canvas` con `transform: scaleX(-1)` (espejo frontal) y `.no-mirror`
  (`84-92`).
- HUDs: `.hud` (`93-102`), `.badge`, `.dot.live`, `.flip-btn`
  (`103-126`), `.rep-hud`/`.rep-count`/`.rep-label` (`127-149`), `.state-msg` con
  variantes `down/up/nobody/blocked` (`150-177`), `.checklist-hud` (`178-216`),
  `.btn`/`.btn-primary`/`.btn-ghost` (`217-240`), `.log` (`241-248`), `.result`
  (`249-254`), `.verify-tag` (`255-272`), `.orientation-row` + `pulse-warn`
  (`273-299`), `.target-chip` (`300-306`), `.gesture-hud` (`307-327`),
  `.countdown-overlay` (`328-340`), `.cadence-hud` (`341-357`),
  `.liveness-overlay` + `lvPulse` (`358-399`), `.card` (`400-406`).

### 2.2 Markup del body (`409-469`)

- `<div id="app">` con `<p id="desc">` (instrucciones).
- `.video-wrap` (`413`) contiene:
  - `<video id="video" playsinline autoplay muted>` (`414`)
  - `<canvas id="overlay">` (`415`)
  - HUDs con IDs: `liveDot`, `statusText`, `flipBtn`, `flipIcon`, `facingLabel`,
    `targetBadge`, `orientationBadge`+`orientationIcon`+`orientationText`, `stateMsg`,
    `checklistHud`+`clTitle`+`clCount`+`clRows`, `repCount`, `repLabel`, `gestureHud`,
    `gestureText`, `countdownOverlay`, `cadenceHud`, `livenessOverlay`,
    `livenessInstruct` (`416-452`).
- Botones: `#startBtn` ("Activar cámara"), `#stopBtn` ("Finalizar y verificar serie",
  oculto) (`455-458`).
- `#resultCard` con `#resultReps`, `#resultDetail`, `#verifyTag`/`#verifyText`
  (`460-467`), y `#log` (`468`).

### 2.3 Parámetros de URL y config (`478-487`, `765-768`)

- `EX_ID = qs.get('exercise') || 'sentadillas'`
- `TARGET = max(1, parseInt(qs.get('target') || '10'))`
- `UNIT = qs.get('unit') || 'reps'`
- `MODE_RANKED = qs.get('ranked') === '1'`
- `CADENCE_SEC = clamp(parseInt(qs.get('cadence') || '5'), 2, 15)`, `CADENCE_MS = *1000`
- `VERIFY_VERSION = max(1, parseInt(qs.get('v') || '1'))`
- `cfg = CFG[EX_ID] || CFG.sentadillas`; `targetUnit = cfg.unit`; `targetVal = TARGET`
- `livenessEnabled = targetUnit === 'seconds' || targetVal > 5`

### 2.4 Tablas de nombres/instrucciones/landmarks (`521-604`)

- `NAME` (`521-530`) y `document.title` (`531`).
- `HOWTO` (`533-550`) + `#desc` (`551-552`).
- `ICON` SVGs: flip/device/warning/check (`554-559`).
- `LID` — índice de cada landmark (`563-589`): nose 0, left/right eyes 2/5,
  shoulders 11/12, elbows 13/14, wrists 15/16, pinky 17/18, index 19/20, thumb 21/22,
  hips 23/24, knees 25/26, ankles 27/28, heels 29/30, feet 31/32.
- `LABEL` — nombres en español de los usados en checklist (`590-604`).

### 2.5 Constantes y estado (`779-837`)

- `VIS = 0.65`, `CONFIRM_FRAMES = 4`, `STATE_CONFIRM_FRAMES = 3`, `MIN_REP_INTERVAL_MS = 350`.
- Liveness: `LIVENESS_MIN_MS = 4000`, `LIVENESS_MAX_MS = 13000`, `LIVENESS_FRAMES = 5`,
  `LIVENESS_HOLD_MS = 2000` (`823-826`).
- Sensor: `VERTICAL_TOLERANCE = 35`, `SENSOR_CONFIRM_MS = 8000` (`836-837`).
- Estado del motor: `repCount`, `holdMs`, `repState`
  (`up`/`down`/`fold`), historiales (`leftAngleHistory`, `angleHistory`,
  `groundedHistory`, `lineAngleHistory`, `sideVotes`), `confirmedSide`,
  `candidateState`/`candidateStreak`, `bodyOkStreak`, calibración
  (`calibBuffer`, `dynamicDownThresh`, `dynamicUpThresh`, `restAngleCalibrated`),
  ranked (`gestureStarted`, `cadenceDeadline`, `seriesOk`), liveness, audio y sensor.
- `runningInsideReactNative = Boolean(window.ReactNativeWebView)` (`839`).

### 2.6 Puente, log y helpers geométricos (`841-921`)

- `post(type, data)` (`841-848`): serializa y llama `window.ReactNativeWebView.postMessage`.
- `log(m)` (`849-851`): escribe en el `#log` visible (solo en pantalla).
- `angleBetween(A,B,C)` (`852-861`): ángulo en B.
- `avgVis(lm, pts)` (`862-869`): visibilidad promedio.
- `checkComplete(lm, pts)` (`870-877`): `{complete, missing}` según `VIS`.
- `renderChecklist(title, pts, missing)` (`878-894`).
- `updateSide(lm, sc)` (`895-908`): votos de lado (buffer 15, confirma con ≥6) → `confirmedSide`.
- `groundedRatio(hip, ankle, shoulder)` (`909-912`).
- `torsoHorizontalAngle(shoulder, hip)` (`913-917`).
- `kneeStandingMargin(hip, knee, shoulder)` (`918-921`).
- `attemptCalibration(angle, c)` (`922-938`): buffer 10, exige rango ≤9; fija
  `restAngleCalibrated` y `dynamicDownThresh`/`dynamicUpThresh` (bridge suma, resto resta).

### 2.7 Liveness (`939-1018`)

- `scheduleLiveness()` (`939-943`): dispara una vez entre 4 y 13 s.
- `showLiveness`/`hideLiveness` (`944-960`): overlay + beeps.
- `checkHandLiveness(lm)` (`965-992`): muñeca por encima del hombro, 5 frames.
- `checkHoldLiveness(smoothed, down)` (`993-1018`): mantener 2 s por debajo del umbral.

### 2.8 Audio y voz (`1020-1067`)

- `ensureAudio()` (`1020-1038`): `AudioContext` + compresor + `masterGain`.
- `beep(...)` (`1039-1052`), `playRep()` (`1053-1057`),
  `speak(text)` (`1058-1067`, `es-ES`, rate 1.05).

### 2.9 HUD y reset (`1068-1124`)

- `refreshHud()` (`1068-1072`), `resetRepState()` (`1074-1118`), `announceSession()` (`1119-1124`).

### 2.10 Ranked: gesto, cuenta regresiva y cadencia (`1207-1291`)

- `handIsRaised(r)` (`1209-1216`): muñeca por encima de la nariz − 0.06.
- `startGesture` (`1217-1224`), `gestureTick` (`1225-1244`, 4 frames, timeout 30 s),
  `beginReadyCount` (`1245-1253`, cuenta 5→0), `readyTick` (`1254-1270`),
  `beginCadence`/`cadenceTick` (`1271-1283`), `failSeries` (`1284-1291`).

### 2.11 Transiciones (`1293-1339`)

- `evaluateTransition(cand)` (`1293-1320`): frontal; confirma `cand` por 3 frames; en
  `up` tras `down` con intervalo ≥350 ms → `registerRep()`.
- `evaluateTransitionCalibrated(cand)` (`1321-1339`): lateral.

### 2.12 Procesamiento (`1342-1697`)

- `processPose(result)` (`1342-1382`): corta por orientación no vertical → pide vertical;
  corta por ausencia de landmarks → "No se detecta cuerpo"; deriva a frontal o lateral.
- `processFrontal(lm)` (`1390-1489`): checklist de `FRONTAL_POINTS`; confirma cuerpo 4
  frames; liveness; ángulos de ambas rodillas (historial 5, promedio); `bothDown`/
  `bothUp` por `downThresh`/`upThresh` o calibrados; asimetría > 35°; ramas por `seconds`
  (hold) o reps (`evaluateTransition`).
- `processLateral(lm)` (`1496-1697`): `updateSide`; checklist de `sides[side].points`;
  gates `groundedMax`, `standingKneeMargin`, `lineMin`; liveness; rama especial Mountain
  Climbers por pliegue de rodilla (`kneeFold 105`, estados `fold`/`up`); rama general por
  `angle` calibrado (`bridge` invierte); rama `seconds` (hold con `dynamicUpThresh`).

### 2.13 Dibujo y espejo (`1699-1758`)

- `draw(result)` (`1699-1731`): `DrawingUtils.drawConnectors(POSE_CONNECTIONS, #3A4552,
lineWidth 2)`; puntos resaltados con verde `#C8FF3D` radio 5 si `visibility>=VIS`, rojo
  `#FF5A5A` radio 6 + anillo radio 10 si no. Los puntos son `FRONTAL_POINTS` o
  `cfg.sides[confirmedSide].points` (`1705-1706`).
- `applyMirror()` (`1733-1738`), `flipBtn.onclick` (`1739-1758`): alterna `user`/
  `environment`, reinicia el stream.

### 2.14 Loop (`1760-1776`)

```
if (!running) return;
const now = performance.now();
if (video.currentTime !== lastTime) {   // un cuadro real de video
  lastTime = video.currentTime;
  const r = poseLandmarker.detectForVideo(video, now);
  if (MODE_RANKED) gestureTick(r);
  draw(r);
  processPose(r);
}
if (MODE_RANKED) { readyTick(now); cadenceTick(now); }
requestAnimationFrame(loop);
```

### 2.15 Modelo y WASM (`1778-1826`)

- `withTimeout(promise, ms, label)` (`1778-1792`).
- `WASM_URL = https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm` (`1793`).
- `MODEL_URL = .../pose_landmarker_lite/float16/latest/pose_landmarker_lite.task` (`1794-1795`).
- `MODEL_LOAD_MS = 20000` (`1796`).
- `attemptCreate(label, make)` (`1798-1805`): GPU, si falla CPU.
- `initModel()` (`1807-1826`): `FilesetResolver.forVisionTasks(WASM_URL)` con timeout,
  luego `PoseLandmarker.createFromOptions(vision, {baseOptions:{modelAssetPath, delegate},
runningMode:'VIDEO', numPoses:1})`.
- Import ESM al inicio (`471-476`) desde `@mediapipe/tasks-vision@0.10.14`.

### 2.16 Sensor y puente nativo (`1828-1904`)

- `ensureOrientationSensor()` (`1828-1863`): si `runningInsideReactNative` → `post('sensor_request')`;
  si no y hay `DeviceOrientationEvent.requestPermission` → lo pide. Agrega listeners
  `deviceorientation`/`devicemotion`. Espera hasta `SENSOR_CONFIRM_MS` a que
  `orientationSupported` sea true; si `sensorUnavailable`, aborta.
- `onDeviceOrientation(ev)` (`1864-1871`): promedio de `beta` (buffer 8), vertical si
  `|90-|avg|| <= 35`.
- `onDeviceMotion(ev)` (`1872-1878`): `tilt = atan2(|gz|,|gy|)`, vertical si `<= 35`.
- `setOrientationState(vertical, beta)` (`1879-1890`): enciende el badge.
- `window.__resilienciaSetNativeOrientation(sample)` (`1896-1904`): si
  `available===false` → `sensorUnavailable`; si `available===true && typeof vertical==='boolean'`
  → `setOrientationState`.

### 2.17 Encendido, apagado y autostart (`1906-2009`)

`startCamera()` (`1906-1959`), en orden:

1. `startBtn.disabled = true; text = 'Confirmando sensor…'`.
2. `ensureAudio()`.
3. `await ensureOrientationSensor()`. Si falla: reintenta una vez a los 300 ms; si vuelve
   a fallar → "Sensor no confirmado" y **no enciende cámara**.
4. `if (!poseLandmarker) await initModel()`.
5. `getUserMedia({video:{facingMode: currentFacing}, audio:false})`, `video.srcObject`,
   `await video.play()`.
6. `canvas.width/height = video.videoWidth/videoHeight` (fallback 480x640).
7. `running = true; resetRepState(); applyMirror();`
8. Si `MODE_RANKED` → `startGesture()`.
9. UI: oculta start, muestra stop, status "En vivo", `liveDot.live`, log.
10. `requestAnimationFrame(loop)`.

`stopCamera()` (`1960-2002`): frena track, UI, muestra `resultCard` y
`post('complete', completePayload('Sesión finalizada'))`.
`startBtn.onclick = startCamera; stopBtn.onclick = stopCamera` (`2003-2004`).
**Autostart** (`2007-2009`): `setTimeout(() => { if (!startBtn.disabled) startCamera(); }, 700)`.
En producción la cámara se enciende sola; el botón es de respaldo.

### 2.18 Protocolo de mensajes de la página

Hacia la app, la página emite **solo dos tipos**:

- `post('sensor_request', {})` (`1833`) — vestigial: la app lo ignora y en su lugar
  inyecta la orientación de forma continua.
- `post('complete', completePayload(detail))` (`1203` y `2001`), con
  `{reps, detail, ranked, seriesOk, livenessOk, cadence, unit, value, evidence}`.
  `evidence` incluye `verifyVersion`, `model:'mediapipe_pose'`, `startedAt`, `finishedAt`,
  `durationMs`, `cadenceSec`, `livenessRequired`, `livenessPassed`, `targetVal`, `targetMet`
  (`1149-1176`).

La app **solo** consume `complete` (`camretos.tsx:52`, `retos.tsx:103`).

---

## 3. Integración nativa de producción

### 3.1 `apps/mobile/src/retos/verify.ts`

- `VERIFY_URL` = URL de gh-pages (`1`).
- `VERIFY_VERSION = 16` (`2`).
- `buildVerifyUri(exerciseId, target, unit, {ranked, cadenceSec})` (`9-22`): agrega
  `?v=16&exercise=..&target=..&unit=..[&ranked=1][&cadence=n]`.

### 3.2 `apps/mobile/app/(tabs)/camretos.tsx` (modo libre)

- Estado del ejercicio: `useLibreExercise()` (`27-28`); unidad del catálogo
  (`35-36`); cadencia `REP_CADENCE` (`42`).
- `startSession()` (`98-109`): chequea premium, `setSessionOpen(true)`.
- Puente de sensor (`113-134`): si `sessionOpen && focused`, `DeviceMotion`
  a 200 ms, `tilt = atan2(|gz|,|gy|)*180/π`, `vertical = tilt <= 35`, inyecta
  `window.__resilienciaSetNativeOrientation({available:true, vertical, beta:null})`.
- WebView (`193-210`): `key` con `restartKey`; `source={{uri: buildVerifyUri(...)}}`;
  `originWhitelist`, `javaScriptEnabled`, `domStorageEnabled`, `allowsInlineMediaPlayback`,
  `mediaPlaybackRequiresUserAction={false}`, `onMessage`, `onPermissionRequest` (muerto),
  `style={{flex:1}}`.
- `handleMessage` (`44-96`): descarta todo lo que no sea `complete`; cierra la sesión,
  muestra resultado y `pushFreeSession` + `syncAfterLogin`.

### 3.3 `apps/mobile/app/(tabs)/retos.tsx` (reto diario)

- Mismo puente de sensor análogo (`145-166`) y misma WebView (`232-250`).
- `handleMessage` (`95-...`): `if (data.type !== 'complete') return` (`103`); si
  `reps >= target` → `markCompleted`.

### 3.4 Hooks

- `useCameraRestart.ts`: `restartKey`++ al volver a `'active'` con foco; va en el `key`.
- `useScreenFocused.ts`: solo renderiza la WebView con foco.

### 3.5 `apps/mobile/app.json`

- `android.permissions: ["android.permission.CAMERA"]` (`26`).
- iOS `NSCameraUsageDescription` (`13-15`).
- **No usa `expo-camera`**. El permiso runtime lo pide el WebView al llamar
  `getUserMedia` (mapea `RESOURCE_VIDEO_CAPTURE` a `CAMERA`).

---

## 4. Config por ejercicio (CFG, `609-764`)

| id                      | unit    | tipo    | métrica                          | umbrales / gates                                                        | liveness |
| ----------------------- | ------- | ------- | -------------------------------- | ----------------------------------------------------------------------- | -------- |
| `sentadillas`           | reps    | frontal | rodilla `hip-knee-ankle`         | down 100 / up 160; asimetría 35°                                        | hand     |
| `flexiones`             | reps    | lateral | codo `shoulder-elbow-wrist`      | downDelta 40 / upDelta 12; `lineMin 150`; `groundedMax 0.9`             | hold     |
| `abdominales`           | reps    | lateral | cadera `shoulder-hip-knee`       | downDelta 25 / upDelta 10; `standingKneeMargin 0.45`; `restTorsoMax 35` | hand     |
| `plancha`               | seconds | lateral | codo                             | upDelta 12; `lineMin 150`; `groundedMax 0.9`                            | hold     |
| `zancadas`              | reps    | frontal | rodilla                          | down 115 / up 160; asimetría 35°                                        | hand     |
| `puente_gluteo`         | reps    | lateral | cadera, `bridge:true`            | downDelta 28 / upDelta 10; `restTorsoMax 38`                            | hand     |
| `mountain_climbers`     | reps    | lateral | pliegue rodilla `hip-knee-ankle` | `kneeFold 105`; `lineMin 150`; `groundedMax 0.9`                        | hand     |
| `sentadilla_isometrica` | seconds | frontal | rodilla                          | down 100 / up 160                                                       | hand     |

`FRONTAL_POINTS` (`769-778`): shoulders, hips, knees, ankles (ambos lados).

**Inconsistencia conocida**: `mountain_climbers` es `reps` en el HTML (`731`) y
`seconds` en `apps/mobile/src/retos/catalog.ts:20`. Definir una sola unidad.

---

## 5. El Banco de pruebas hoy (y en qué se desvía)

### 5.1 `apps/exercise-tester/src/lib/poseWorker.ts` (388 líneas)

- `POSE_VIEW_HTML` (`26-385`): HTML embebido que **se dice copia** pero difiere:
  - `<video id="video" playsinline autoplay muted>` y `<canvas id="canvas">` dentro de
    `.video-wrap` (`75-79`). Sin `#app`, sin botones, sin HUDs de producción.
  - Import ESM correcto (`85-90`).
  - Reimplementa `initModel`, `draw`, `loop`, `applyMirror`, `startCamera`,
    `stopCamera` (`194-351`).
  - **No** tiene los gates ni el conteo de producción: en su lugar manda los landmarks
    a RN (`loop`, `335-339`, mensaje `type:'pose'` con `flat`).
  - **No** autostart: expone `window.__start`/`__stop`/`__facing`/`__setHighlight`/`__snap`
    (`353-376`) y espera que RN los llame.
  - Protocolo propio: `stage`, `log`, `orientation`, `sensor_request`, `ready`, `running`,
    `fatal`, `pose`, `snap` (`154-162`, `213-216`, `283`, `292`, `305`, `339`, `372`).
  - Función muerta `waitForVision` (`175-181`): ya no se llama tras pasar a ESM.
- `POSE_BRIDGE_BASE_URL = 'https://cdn.jsdelivr.net'` (`388`): `baseUrl` del HTML
  embebido, para CORS del CDN/WASM.

### 5.2 `apps/exercise-tester/src/screens/TestScreen.tsx` (671 líneas)

- Pide permiso con `useCameraPermissions` (`86`, `486-497`).
- Sensor con **`Accelerometer`** (no `DeviceMotion`): `140-157`, `SENSOR_UPDATE_INTERVAL_MS`,
  inyecta `{available:true, vertical, beta: tiltDeg(sample)}`.
- WebView (`510-527`): `source={{html: POSE_VIEW_HTML, baseUrl: POSE_BRIDGE_BASE_URL}}`,
  `onMessage`, `onError`, `style={styles.cam}`.
- `onWebMessage` (`347-421`): maneja stage/log/orientation/sensor_request/ready/running/
  fatal/snap/pose. Ignora `sensor_request` (`379-381`).
- Motor de conteo en TS: `handleFrame` (`173-345`) + `repEngine` + `pose` + `liveness`.
- `start()` (`422-436`): crea sesión e inyecta `window.__start()`.
- `finish()` (`438-459`): `window.__stop()` + `summarizeExercise`.
- Layout: `camBox` con `aspectRatio: 0.75`, `cam: {flex:1}` (`605-615`).

### 5.3 Diferencias concretas vs producción

| Aspecto            | Producción                              | Banco                      |
| ------------------ | --------------------------------------- | -------------------------- |
| Entrega del HTML   | `source={{uri}}` (HTTPS)                | `source={{html, baseUrl}}` |
| Conteo/gates       | en la página                            | en TS (`repEngine`)        |
| Arranque           | autostart a 700 ms                      | RN inyecta `__start`       |
| Sensor             | `DeviceMotion` (formula de producción)  | `Accelerometer`            |
| Protocolo          | `complete` (+`sensor_request` ignorado) | stage/log/pose/ready/...   |
| HUD                | rep count, state-msg, checklist, badges | HUDs propios de RN         |
| `html,body` height | `100%`                                  | sin alto                   |
| Evidencia          | cámara + `complete`                     | snapshot `__snap`          |

---

## 6. Diagnóstico del "la cámara no se ve nada"

Ordenado por probabilidad:

1. **`source={{html}}` vs `uri`.** Es la diferencia estructural mayor. Producción usa
   `loadUrl` a HTTPS; el banco usa `loadDataWithBaseURL`. `getUserMedia` y el import ESM
   pueden comportarse distinto según el origen del documento.
2. **El `import` ESM mata el módulo en silencio si falla.** Con `<script type="module">`,
   si el import no resuelve, **no corre nada**: no hay `stage('script')` ni
   `window.__start`, y la pantalla queda negra sin logs. Es el cuadro que coincide con
   "no se ve nada".
3. **Sin autostart.** El banco depende de `window.__start()` inyectado; si el módulo no
   corrió al tocar "Iniciar", no reintenta.
4. **Sensor**: no bloquea en el banco (no espera), así que no es la traba; pero usa
   `Accelerometer` en vez de `DeviceMotion`.
5. **Layout**: ya alineado a `.video-wrap` 3/4. Falta `html,body{height:100%}` (menor).
6. **Permiso**: pedido explícito con `expo-camera`; redundante, no dañino.

Comprobación rápida en dispositivo: si el log del banco no muestra
`modulo de vision arrancando`, el módulo no ejecutó → causa 1 o 2.

---

## 7. Plan para copiar la función de producción tal cual

Objetivo: que el banco haga **lo mismo** que producción. Pasos:

1. **Cargar la página por URL, no embebida.** Usar `source={{uri}}` con una URL real
   (gh-pages de producción, o el HTML local servido por HTTPS). Igualar las props de la
   WebView de producción: `originWhitelist={['*']}`, `javaScriptEnabled`,
   `domStorageEnabled`, `allowsInlineMediaPlayback`, `mediaPlaybackRequiresUserAction={false}`,
   `onMessage`, `style={{flex:1}}`.
2. **No reimplementar conteo ni gates en RN.** La página ya los corre y muestra el HUD.
   Si se quiere inspección extra, debe ser solo lectura (observar), sin reemplazar la
   función de la página.
3. **Sensor con `DeviceMotion`**, misma formula y mismo puente
   (`__resilienciaSetNativeOrientation` con `beta:null`), arrancado mientras la WebView
   está montada.
4. **Consumir `complete`** (y, si hace falta, `sensor_request`, aunque la app real lo
   ignora) con el mismo tratamiento de payload.
5. **Autostart o espera de `ready`** antes de habilitar cualquier acción, para no perder
   la inyección si el módulo todavía no cargó.
6. **Quitar del banco** lo que no es producción: `source={{html}}`, `waitForVision`
   muerta, motor TS, protocolo de bridge propio, snapshots de evidencia, HUDs que
   dupliquen conteo.
7. **Resolver la inconsistencia** de `mountain_climbers` (`reps` vs `seconds`).

Nota sobre "probar cambios locales": si se carga la URL de gh-pages, el banco prueba el
HTML **publicado**. Para probar un HTML local habría que servirlo por HTTPS (o desplegar
una copia) para conservar el origen seguro que necesita `getUserMedia`.

---

## 8. Checklist de verificación en dispositivo

1. Montada la WebView, el log muestra el arranque del módulo. Si no: import/CDN o entrega.
2. Secuencia esperada: `script` → `wasm` → `modelo` → `camara` → cámara en vivo (o
   equivalentes de producción `Cargando modelo…` → `En vivo`).
3. Video visible con esqueleto; badge "Vertical"; rep count en pantalla.
4. `adb logcat` / `chrome://inspect` para errores que no llegan a la app.
5. Con internet cortado: WASM y modelo no cargan (dependencia dura de
   `cdn.jsdelivr.net` y `storage.googleapis.com`).

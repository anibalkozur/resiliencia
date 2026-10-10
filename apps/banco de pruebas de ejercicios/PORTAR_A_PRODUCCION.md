# Pendientes para portar a producción (ResiliencIA)

Cambios y mejoras que se validan en el **banco de pruebas** y que todavía **no**
están en la app real. Producción (`camera-verification.html` y `apps/mobile`) queda
intacta hasta que estos cambios se prueben y se porten a mano.

- Página del banco: `apps/banco de pruebas de ejercicios/camera-verification-bench.html`
- Publicada en: `https://anibalkozur.github.io/resiliencia/camera-verification-bench.html`
- Versión del fork: **v47** · Versión de producción: **v19** (`apps/mobile/src/retos/verify.ts`)
- Página de producción: `camera-verification.html`

Cómo sacar el diff completo en cualquier momento:

```powershell
git diff --no-index --unified=3 -- camera-verification.html "apps/banco de pruebas de ejercicios/camera-verification-bench.html"
```

---

## Cambios de la página (detector de ejercicios)

### 1. Sentadilla normal e isométrica: menos profundidad

La vista frontal "achata" el ángulo de rodilla (la flexión va hacia la cámara), así
que con `downThresh: 100` había que bajar casi hasta alinear rodillas con caderas.
Se sube a 130; la rep/hold cuenta bastante antes.

`camera-verification.html`, en `CFG`:

```diff
 CFG = {
   sentadillas: {
     ...
-    downThresh: 100,
+    downThresh: 130,
     upThresh: 160,
   },
   ...
   sentadilla_isometrica: {
     ...
-    downThresh: 100,
+    downThresh: 130,
     upThresh: 160,
   },
 }
```

- Aplica a ambos (`sentadillas` y `sentadilla_isometrica`), misma vista frontal.
- A validar: si 130 sigue pidiendo mucho, subir a 140; si cuenta de más, bajar a 120.
- **✅ PORTADO a producción (2026-10-09)** — aplicado en `camera-verification.html`
  (`sentadillas` e `sentadilla_isometrica`, `downThresh: 130`), `VERIFY_VERSION` 17,
  publicado en gh-pages y **probado por PO en la app: OK**.

### 2. Segundero de cadencia más visible

Con la cadencia de ranking, el segundero de 56 px pasaba desapercibido. Se agranda y
en los últimos 2 s se pone rojo y pulsa.

```diff
 .cadence-hud {
-  top: 120px;
-  width: 56px; height: 56px; border-radius: 50%;
-  border: 2px solid var(--volt);
-  font-size: 26px;
+  top: 112px;
+  min-width: 72px; height: 72px; padding: 0 10px; border-radius: 36px;
+  border: 3px solid var(--volt);
+  font-size: 34px;
+  line-height: 1;
+  font-variant-numeric: tabular-nums;
+  box-shadow: 0 0 24px rgba(45, 212, 168, 0.45);
 }
+.cadence-hud.urgent {
+  border-color: var(--danger);
+  color: var(--danger);
+  box-shadow: 0 0 24px rgba(255, 90, 90, 0.55);
+  animation: cadencePulse 0.5s ease-in-out infinite;
+}
+@keyframes cadencePulse {
+  0%, 100% { transform: scale(1); }
+  50% { transform: scale(1.14); }
+}
```

```diff
 function beginCadence(now) {
   cadenceDeadline = now + CADENCE_MS;
   cadenceHud.style.display = 'flex';
   cadenceHud.textContent = String(CADENCE_SEC);
+  cadenceHud.classList.remove('urgent');
 }
 function cadenceTick(now) {
   ...
-  cadenceHud.textContent = String(Math.max(0, Math.ceil((cadenceDeadline - now) / 1000)));
+  const rem = Math.max(0, Math.ceil((cadenceDeadline - now) / 1000));
+  cadenceHud.textContent = String(rem);
+  cadenceHud.classList.toggle('urgent', rem <= 2);
 }
 ```

- **✅ PORTADO a producción (2026-10-09)** — aplicado en `camera-verification.html`
  (CSS 72px + `.urgent` + pulso, `beginCadence` con `classList.remove('urgent')`,
  `cadenceTick` con `toggle('urgent', rem <= 2)`), `VERIFY_VERSION` 18, publicado en
  gh-pages y **probado por PO en la app: OK**.

### 3. Zancadas de perfil (lateral)

De frente, en la zancada larga y baja la rodilla de la pierna de atrás tapa el pie,
el tobillo cae por debajo de la visibilidad (`VIS = 0.65`) y `checkComplete` resetea
el estado: no cuenta. Se pasa a detección **de perfil** (como flexiones), cuidando
que el usuario se pare de costado a la cámara. El ángulo de rodilla de la pierna
cercana se autocalibra.

`camera-verification.html`, en `CFG`:

```diff
 zancadas: {
   name: 'Zancadas',
   unit: 'reps',
-  type: 'frontal',
-  left: { a: 'left_hip', b: 'left_knee', c: 'left_ankle' },
-  right: { a: 'right_hip', b: 'right_knee', c: 'right_ankle' },
-  downThresh: 115,
-  upThresh: 160,
-  downDelta: 0,
-  upDelta: 0,
+  type: 'lateral',
+  sides: {
+    left: {
+      points: ['left_shoulder', 'left_hip', 'left_knee', 'left_ankle'],
+      angle: { a: 'left_hip', b: 'left_knee', c: 'left_ankle' },
+    },
+    right: {
+      points: ['right_shoulder', 'right_hip', 'right_knee', 'right_ankle'],
+      angle: { a: 'right_hip', b: 'right_knee', c: 'right_ankle' },
+    },
+  },
+  downDelta: 45,
+  upDelta: 18,
   liveness: 'hand',
+  startMsg: 'Ponete de perfil a la cámara, parado y quieto un segundo',
 },
```

Y el texto de ayuda (`HOWTO.zancadas`):

```diff
 zancadas:
-  'Parate derecho mirando a la cámara. Da un paso largo hacia adelante y bajá hasta que ambas rodillas queden cerca de 90°. Volvé a la posición inicial y repetí con la otra pierna.',
+  'Ponete de perfil a la cámara, mirando hacia un costado. Da un paso largo hacia adelante y bajá flexionando las rodillas hasta cerca de 90°; volvé a subir y repetí alternando la pierna. Cada subida completa cuenta como 1.',
```

- Del mismo modo que en el fork: `downDelta`/`upDelta` son los valores a afinar
  probando (si no cuenta, bajar `downDelta`; si cuenta de más, subirlo).
- Recordar que el usuario debe estar de costado; de frente no aplica.

### 4. Mountain Climbers: aclarar que es de perfil

Igual que zancadas, `mountain_climbers` ya se detectaba `lateral` (por `kneeFold`),
pero ni el instructivo ni los mensajes indicaban la orientación. Solo cambian textos
de `camera-verification.html`:

```diff
 HOWTO = {
   ...
   mountain_climbers:
-    'Ponete en plancha apoyando las manos. Llevá una rodilla rápido al pecho y volvé, alternando las piernas en ritmo continuo. Cada rodilla al pecho cuenta como 1.',
+    'Ponete de perfil a la cámara (de costado), en plancha apoyando las manos. Llevá una rodilla rápido al pecho y volvé, alternando las piernas en ritmo continuo. Cada rodilla al pecho cuenta como 1.',
 }
```

```diff
 mountain_climbers: {
   ...
-  postureMsg: 'Pará en plancha apoyando las manos',
-  startMsg: 'Entrá en plancha para arrancar',
+  postureMsg: 'Ponete de perfil a la cámara, en plancha apoyando las manos',
+  startMsg: 'Ponete de perfil y entrá en plancha para arrancar',
 },
```

> Nota: flexiones, abdominales, plancha y puente de glúteo también son `lateral` y
> tampoco dicen "de perfil". Queda pendiente decidir si se aclara igual en todos.

### 5. Zancadas: objetivo par (paso de 2 en 2)

Como la zancada alterna piernas, el objetivo tiene que ser par para trabajarlas
igual. En el banco el selector avanza de 2 en 2 para zancadas
(`ExerciseInfo.step: 2` + `TestScreen`, ya hecho).

En producción el selector del modo libre está en `apps/mobile/app/(tabs)/camretos.tsx`:

```diff
-  const targetStep = isSeconds ? 5 : 1;
-  const minTarget = isSeconds ? 5 : 1;
+  const evenReps = libreExerciseId === 'zancadas';
+  const targetStep = isSeconds ? 5 : evenReps ? 2 : 1;
+  const minTarget = isSeconds ? 5 : evenReps ? 2 : 1;
```

- Al elegir zancadas, conviene además redondear el objetivo actual a par
  (`libreTarget % 2 ? libreTarget + 1 : libreTarget`), porque puede venir impar de
  otro ejercicio.
- Los objetivos del catálogo (`DEFAULT_TARGETS`) ya son pares para zancadas (24).

### 6. La mano solo inicia la sesión si el cuerpo está completo en verde ✅ validado en el banco

Antes, `gestureTick` aceptaba la mano levantada sin mirar el checklist, así que se
podía arrancar la sesión con partes del cuerpo sin detectar (por ejemplo pies
fuera de cámara). Ahora el inicio exige `bodyComplete` (todas las partes requeridas
del ejercicio con visibilidad ≥ `VIS`).

`camera-verification.html`, estado:

```diff
         cadenceDeadline = 0,
         seriesOk = true;
+      let bodyComplete = false,
+        bodyMissing = [];
```

En `processPose`, resetear al entrar; y al final de `checkComplete` de cada camino
(frontal y lateral) guardar el resultado:

```diff
       function processPose(result) {
+        bodyComplete = false;
         if (orientationSupported && !deviceIsVertical) {
```

```diff
         const { complete, missing } = checkComplete(lm, FRONTAL_POINTS);   // (y el de lateral)
+        bodyComplete = complete;
+        bodyMissing = complete ? [] : missing;
         renderChecklist('Cuerpo', FRONTAL_POINTS, missing);
```

Y `gestureTick` solo acepta la mano cuando el cuerpo está completo:

```diff
         if (!pose) return;
+        if (!bodyComplete) {
+          raiseStreak = 0;
+          gestureText.textContent = bodyMissing.length
+            ? 'Completá el cuerpo en cámara — falta ver: ' + bodyMissing.map((m) => LABEL[m]).join(', ')
+            : 'Cuerpo incompleto — acomodate frente a la cámara';
+          return;
+        }
+        gestureText.textContent = 'Levantá la mano arriba de la cabeza para empezar';
         if (handIsRaised(pose)) {
```

- **✅ PORTADO a producción (2026-10-09)** — aplicado en `camera-verification.html`,
  `VERIFY_VERSION` 19, publicado en gh-pages y **probado por PO en la app: OK**.
- **Extensión al portar (para todos los modos)**: en el banco el gesto era solo de
  ranking; en producción el inicio con mano ahora corre en **libre y ranking**, y los
  ejercicios de **segundos** también esperan el "¡Ya!". Una rep hecha antes del "¡Ya!"
  se **ignora** (no rompe la serie); el banco ya tenía ese split.

### 7. Flexiones: cuclillas de arranque y 10 s para la primera rep ✅ validado en el banco

La primera flexión necesita tiempo para pasar de cuclillas a la posición de plancha.
Se aclara en el instructivo/mensajes y se le da a la **primera** rep un margen de
10 s (después vuelve a la cadencia normal).

`camera-verification.html`, `CFG.flexiones`:

```diff
   groundedMax: 0.9,
+  firstRepGraceMs: 10000,
   liveness: 'hold',
-  postureMsg: 'Ponete en plancha horizontal para contar flexiones',
-  startMsg: 'Extendé los brazos en plancha, quieto un segundo',
+  postureMsg: 'Ponete en cuclillas y pasá a plancha horizontal para contar',
+  startMsg: 'Ponete en cuclillas y estirá a plancha, quieto un segundo',
 },
```

`HOWTO.flexiones` (agrega): "Para arrancar, ponete en cuclillas listo para tomar la
posición de plancha: tenés 10 segundos para hacer la primera flexión."

Y el margen de la primera rep:

```diff
-          if (targetUnit === 'reps') beginCadence(now);
+          if (targetUnit === 'reps') beginCadence(now, cfg.firstRepGraceMs);
```

```diff
-      function beginCadence(now) {
-        cadenceDeadline = now + CADENCE_MS;
+      function beginCadence(now, ms) {
+        const durMs = ms || CADENCE_MS;
+        cadenceDeadline = now + durMs;
         cadenceHud.style.display = 'flex';
-        cadenceHud.textContent = String(CADENCE_SEC);
+        cadenceHud.textContent = String(Math.ceil(durMs / 1000));
         cadenceHud.classList.remove('urgent');
       }
```

- `firstRepGraceMs` es opcional y reutilizable: si otro ejercicio necesita margen de
  arranque (mountain climbers, abdominales, puente), se le agrega el mismo campo.

### 8. Tobillos en rojo cuando el pie sale de cuadro (vista frontal) ✅ validado en el banco

En los ejercicios frontales (sentadillas e isométrica), MediaPipe **siempre**
devuelve los 33 landmarks y **extrapola** el tobillo/pie/talón con `visibility`
alta cuando el pie sale de cuadro → el chequeo por `visibility` del tobillo daba
**verde falso**. Ahora el tobillo se deriva del **pie/talón**, con umbral propio e
histéresis. Calibrado en dispositivo el 2026-10-09 (PO lo validó: el pie al borde
da verde y al desaparecer los tobillos da rojo); ver acta 010
(`docs/equipo/actas/2026-10-09_verificacion_tobillos_bench.md`).

Constantes (junto a `VIS`):

```diff
    VIS = 0.65,
    CONFIRM_FRAMES = 4,
    STATE_CONFIRM_FRAMES = 3,
    MIN_REP_INTERVAL_MS = 350,
+   FOOT_VIS = 0.35,
+   FOOT_CONFIRM_FRAMES = 2;
```

Márgenes de marco nuevos (junto a `FRAME_MARGIN_*`):

```diff
  const FRAME_MARGIN_X = 0.01;
  const FRAME_MARGIN_Y_TOP = 0.01;
  const FRAME_MARGIN_Y_BOTTOM = 0.07;
+ // El pie natural cae en el borde inferior (y≈1) y el dedo puede quedar apenas
+ // por debajo sin salir de cuadro: se tolera y manda la visibilidad del pie.
+ const ANKLE_MAX_Y = 1.08;
```

`footSeen` (Capa 0+1) + histéresis (Capa 5):

```diff
+ function footSeen(lm, side) {
+   const foot = lm[LID[side + '_foot']];
+   const heel = lm[LID[side + '_heel']];
+   const vis = Math.max(foot ? (foot.visibility ?? 0) : 0, heel ? (heel.visibility ?? 0) : 0);
+   if (vis < FOOT_VIS) return false;
+   if (foot && (foot.y > ANKLE_MAX_Y || foot.x < FRAME_MARGIN_X || foot.x > 1 - FRAME_MARGIN_X))
+     return false;
+   return true;
+ }
+ const footStreak = { left: 0, right: 0 };
+ function updateFootStreak(lm) {
+   for (const side of ['left', 'right']) {
+     footStreak[side] =
+       lm && footSeen(lm, side) ? Math.min(footStreak[side] + 1, FOOT_CONFIRM_FRAMES) : 0;
+   }
+ }
```

En `isLandmarkValid`: el tobillo no usa el gate `VIS` propio, tolera el borde y
exige `footSeen` + histéresis (solo frontal; perfil conserva el chequeo previo):

```diff
  function isLandmarkValid(lm, k) {
    const p = lm[LID[k]];
    if (!p) return false;
    const vis = p.visibility ?? p.presence ?? 0;
-   let valid = vis >= VIS;
+   const isAnkle = k === 'left_ankle' || k === 'right_ankle';
+   let valid = isAnkle ? vis >= FOOT_VIS : vis >= VIS;
    if (p.x < FRAME_MARGIN_X || p.x > 1 - FRAME_MARGIN_X) valid = false;
-   if (p.y < FRAME_MARGIN_Y_TOP || p.y > 1 - FRAME_MARGIN_Y_BOTTOM) valid = false;
+   const maxY = isAnkle ? ANKLE_MAX_Y : 1 - FRAME_MARGIN_Y_BOTTOM;
+   if (p.y < FRAME_MARGIN_Y_TOP || p.y > maxY) valid = false;
+   if (valid && isAnkle && cfg.type === 'frontal') {
+     const side = k.startsWith('left') ? 'left' : 'right';
+     if (!footSeen(lm, side) || footStreak[side] < FOOT_CONFIRM_FRAMES) valid = false;
+   }
    ...
```

Y en `processPose`, actualizar la histéresis una vez por frame (y resetearla si no
es vertical):

```diff
+ updateFootStreak(poseLm);
```

### 9. Cámara completa sin scroll (layout)

Con `aspect-ratio: 9/19.5` el contenedor quedaba más alto que la pantalla y el
checklist/conteo/voz (anclados al fondo) salían de pantalla. Se limita la altura:

```diff
  .video-wrap {
    position: relative;
    width: 100%;
    border-radius: 16px;
    overflow: hidden;
    margin-top: 6px;
    background: #000;
    aspect-ratio: 9/19.5;
+   max-height: calc(100vh - 200px);
+   max-height: calc(100dvh - 200px);
  }
```

### 10. Cadencia por rep más generosa y 12 s de señal de vida ✅ validado en el banco

La ventana entre reps por defecto pasa de **5 s a 6 s**, y cuando entra una señal
de vida la ventana se estira a por lo menos **12 s** en vez de 10 s (para que la
señal de vida no tire la serie).

`camera-verification.html`:

```diff
-        const CADENCE_SEC = Math.min(15, Math.max(2, parseInt(qs.get('cadence') || '5', 10)));
+        const CADENCE_SEC = Math.min(15, Math.max(2, parseInt(qs.get('cadence') || '6', 10)));
```

```diff
  function extendCadenceForLiveness(now) {
    if (MODE_RANKED && targetUnit === 'reps' && cadenceDeadline > 0)
-     cadenceDeadline = Math.max(cadenceDeadline, now + 10000);
+     cadenceDeadline = Math.max(cadenceDeadline, now + 12000);
  }
```

- El parámetro `?cadence=` de la URL (lo manda la RN app) sigue pisando el default.
- **✅ PORTADO a producción (2026-10-09)** — aplicado en `camera-verification.html`
  (`CADENCE_SEC` default `'6'` y `extendCadenceForLiveness` `now + 12000`),
  `VERIFY_VERSION` 18, publicado en gh-pages y **probado por PO en la app: OK**.

### 11. Segundero también en modo libre, sin penalizar ✅ validado en el banco

En ranking el segundero marca la cadencia y si se pasa el tiempo la serie queda
fuera de ranking. En modo libre el mismo segundero aparece como **guía de ritmo sin
castigo**: corre los 6 s entre reps, se pone rojo y pulsa en los últimos 2 s, y si
pasa el tiempo simplemente se oculta (no tira la serie). Arranca con la **primera**
rep, porque en libre no hay gesto de mano ni cuenta 5-4-3-2-1.

`camera-verification.html`:

```diff
-        if (MODE_RANKED && targetUnit === 'reps') beginCadence(now);
+        if (targetUnit === 'reps') beginCadence(now);
```

```diff
-        if (MODE_RANKED) {
-          readyTick(now);
-          cadenceTick(now);
-        }
+        if (MODE_RANKED) readyTick(now);
+        cadenceTick(now);
```

```diff
  function cadenceTick(now) {
-   if (!MODE_RANKED || targetUnit !== 'reps' || !gestureStarted || !seriesOk) return;
+   if (targetUnit !== 'reps' || !seriesOk) return;
+   if (MODE_RANKED && !gestureStarted) return;
+   if (!cadenceDeadline) return;
    if (now > cadenceDeadline) {
-     failSeries('Descanso muy largo — fuera de ranking');
+     if (MODE_RANKED) {
+       failSeries('Descanso muy largo — fuera de ranking');
+       return;
+     }
+     cadenceDeadline = 0;
+     cadenceHud.style.display = 'none';
      return;
    }
+   const rem = Math.max(0, Math.ceil((cadenceDeadline - now) / 1000));
+   cadenceHud.textContent = String(rem);
+   cadenceHud.classList.toggle('urgent', rem <= 2);
  }
```

- En libre el segundero se oculta al pasar el tiempo solo hasta la próxima rep
  (que lo vuelve a mostrar); no afecta el conteo ni las series.
- Espejo tomado en el banco (v47) para no desincronizar.
- **✅ PORTADO a producción (2026-10-09)** — aplicado en `camera-verification.html`,
  `VERIFY_VERSION` 18, publicado en gh-pages y **probado por PO en la app: OK**.

### 12. Voz guía (agente) al inicio y durante cada ejercicio ✅ validado en el banco

El banco tiene una **voz que acompaña la serie**: habla al arrancar (`pre`), a mitad
de camino (`mid`), en las últimas 3 reps (`last`), al completar (`done`) y en el
descanso (`rest`). No es una frase fija: rota un **corpus** por puesto para no repetir,
respeta un mínimo de 2.5 s entre frases y muestra un cartelito (`voice-badge`) con el
texto que dice. En producción hoy solo existe `speak('Empezá cuando quieras')` (fijo,
en `announceSession`).

CSS (junto a `.cadence-hud`):

```diff
+ .voice-badge {
+   position: absolute;
+   bottom: 10px;
+   left: 50%;
+   transform: translateX(-50%);
+   z-index: 5;
+   max-width: 88%;
+   padding: 5px 12px;
+   border-radius: 999px;
+   background: rgba(0, 0, 0, 0.62);
+   color: #e8f5e9;
+   font-size: 12px;
+   line-height: 1.35;
+   text-align: center;
+   pointer-events: none;
+ }
```

HTML (junto a los demás overlays) y referencia:

```diff
+ <div class="voice-badge" id="voiceBadge" style="display: none"></div>
+ const voiceBadge = document.getElementById('voiceBadge');
```

Núcleo: `VOICE_SLOT_OFFSET` reparte los puestos para que dos frases no caigan juntas;
`VOICE_INSIDE_SET` marca los puestos que en **ranking** no suenan (la voz pausaría la
cadencia de 6 s y tiraría la serie por hablarle); el índice de rotación sale de
`seqDone` (contador de series del banco).

```diff
+ const VOICE_MIN_GAP_MS = 2500;
+ const VOICE_MID_MIN_TARGET = 10;
+ const VOICE_SLOT_OFFSET = { pre: 0, mid: 3, last: 6, done: 1, rest: 4 };
+ const VOICE_INSIDE_SET = { pre: false, mid: true, last: true, done: false, rest: false };
+ const VOICE_UNITS = {
+   pre: ['reps', 'seconds'],
+   mid: ['reps'],
+   last: ['reps'],
+   done: ['reps', 'seconds'],
+   rest: ['reps', 'seconds'],
+ };
+ const VOICE_CORPUS = {
+   pre: [
+     'Prepará la postura. Cuando quieras, arrancá.',
+     'Acomodate bien. Esta serie va con control.',
+     'Todo listo. Empezá cuando te sientas cómodo.',
+     'Buscá un ritmo que puedas sostener.',
+     'Mirá fijo al frente. Arrancá.',
+     'Controlá la respiración. Empezá.',
+     'Esta serie va a tu ritmo, sin apurarte.',
+     'Vamos con esta. Prestá atención a la técnica.',
+   ],
+   mid: [
+     'Vas por la mitad. Seguí así.',
+     'Buen ritmo. Mantenelo.',
+     'Mirá la técnica, no el número.',
+     'Aguantá bien. Viene más.',
+     'Sin apuro. El control es lo que suma.',
+     'Eso. Mismo ritmo.',
+     'Vamos bien. No aflojes ahora.',
+     'Seguí con la misma intensidad.',
+   ],
+   last: [
+     'Últimas tres. Vamos.',
+     'Faltan tres. Aguantá.',
+     'Últimas tres: la más técnica.',
+     'Quedan tres. Sostené el ritmo.',
+     'Faltan tres. Dá.',
+     'Últimas tres. No aflojes.',
+     'Tres más. Con ritmo.',
+     'Faltan tres. Cerrá fuerte.',
+   ],
+   done: [
+     'Listo. Buen trabajo.',
+     'Serie completa. Recuperate.',
+     'Terminaste. Buen ritmo.',
+     'Bien. Descansá un momento.',
+     'Completaste la serie.',
+     'Esa fue. Tomá agua.',
+     'Listo, esa serie quedó.',
+     'Completaste. Ahora descansá.',
+   ],
+   rest: [
+     'Acomodate y respirá.',
+     'Tiempo de descanso. Respirá bien.',
+     'Sostené la respiración un momento.',
+     'Frená acá y tomá aire.',
+     'Descansá. Respirá lento.',
+     'Ahora es para recuperar.',
+     'Sostenete. Tomá aire.',
+     'Descansá bien antes de seguir.',
+   ],
+ };
+ const voiceFired = {};
+ let voiceLastAt = -1e9;
+ function voiceInsideSetOk() { return !MODE_RANKED; }
+ function voiceLine(slot) {
+   const pool = VOICE_CORPUS[slot];
+   if (!pool || !pool.length) return '';
+   const units = VOICE_UNITS[slot] || [];
+   if (units.indexOf(targetUnit) === -1) return '';
+   if (VOICE_INSIDE_SET[slot] && !voiceInsideSetOk()) return '';
+   const i = (Math.max(0, seqDone) + VOICE_SLOT_OFFSET[slot]) % pool.length;
+   return pool[i];
+ }
+ function voiceTake(slot) {
+   if (voiceFired[slot]) return '';
+   voiceFired[slot] = true;
+   if (performance.now() - voiceLastAt < VOICE_MIN_GAP_MS) return '';
+   const line = voiceLine(slot);
+   if (!line) return '';
+   voiceLastAt = performance.now();
+   return line;
+ }
+ function voiceFlash(text) {
+   if (typeof window.ReactNativeWebView !== 'undefined') {
+     try {
+       window.ReactNativeWebView.postMessage(
+         JSON.stringify({ type: 'voz_log', text: 'VOZ: ' + text }),
+       );
+     } catch (e) {}
+   }
+   if (voiceBadge) {
+     voiceBadge.style.display = 'block';
+     voiceBadge.textContent = text;
+   }
+   log('VOZ: ' + text);
+ }
+ function voiceSay(slot) {
+   const text = voiceTake(slot);
+   if (!text) return '';
+   speak(text);
+   voiceFlash(text);
+   return text;
+ }
```

Puntos de llamada (en el banco):

```diff
  function announceSession() {
    if (!sessionStartTime) {
      sessionStartTime = performance.now();
-     speak('Empezá cuando quieras');
+     speak(voiceSay('pre') || 'Empezá cuando quieras');
    }
  }
```

```diff
  function registerRep() {
    ...
    if (targetUnit === 'reps') {
+     if (targetVal >= VOICE_MID_MIN_TARGET && repCount >= Math.ceil(targetVal / 2))
+       voiceSay('mid');
+     if (repCount === targetVal - 3) voiceSay('last');
    }
    ...
  }
```

- `done` se toma en `postComplete` y se compone con el mensaje en una sola locución
  (`speak()` cancela lo anterior). `rest` se concatena en `advance` con el nombre del
  ejercicio siguiente.
- Al cargar un ejercicio se resetean los 5 puestos (`voiceFired[slot] = false`) y se
  oculta el badge.
- **Dependencia al portar**: `voiceLine` usa `seqDone` (contador de series del banco),
  que producción **no** tiene. Portar `pre`/`mid`/`last` no necesita secuencia: darle a
  `voiceLine` un índice equivalente (contador de series propio) o rotación aleatoria.
  Los puestos `done`/`rest` están atados al flujo de secuencia (`advance`); si la
  secuencia no se porta, el cierre se mantiene con el mensaje fijo actual.
- En ranking `mid`/`last` quedan mudos a propósito: la pausa por hablar cortaría la
  cadencia.

---

## Cómo portar y verificar

Cambios **ya portados** (probados por PO el 2026-10-09): **1, 2, 6, 10 y 11**.
Pendientes: **3, 4, 5, 7, 8, 9 y 12**.

1. Aplicar los diffs **pendientes** a `camera-verification.html` (producción).
2. **Subir `VERIFY_VERSION`** en `apps/mobile/src/retos/verify.ts` (hoy 18) para
   forzar la recarga de la WebView (cache-bust).
3. Publicar `camera-verification.html` en gh-pages.
4. Probar en la app real: en sentadillas e isométrica que el tobillo dé **verde con
   el pie en el borde** y **rojo al desaparecer** (con la cámara completa sin
   scroll), zancadas **de perfil** (de costado a la cámara) con objetivo par,
   Mountain Climbers con la indicación de perfil, en flexiones los 10 s de margen
   para la primera rep (cuclillas → plancha), y la **voz guía** (cambio 12): `pre`
   al arrancar, `mid` a la mitad, `last` en las últimas 3 y muda en las series de
   ranking.

Verificación del banco (desde la raíz del repo):

```powershell
pnpm --filter @resiliencia/exercise-tester typecheck
pnpm --filter @resiliencia/exercise-tester lint
pnpm --filter @resiliencia/exercise-tester test
```

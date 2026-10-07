# Pendientes para portar a producción (ResiliencIA)

Cambios y mejoras que se validan en el **banco de pruebas** y que todavía **no**
están en la app real. Producción (`camera-verification.html` y `apps/mobile`) queda
intacta hasta que estos cambios se prueben y se porten a mano.

- Página del banco: `apps/exercise-tester/camera-verification-bench.html`
- Publicada en: `https://anibalkozur.github.io/resiliencia/camera-verification-bench.html`
- Versión del fork: **v22** · Versión de producción: **v16** (`apps/mobile/src/retos/verify.ts`)
- Página de producción: `camera-verification.html`

Cómo sacar el diff completo en cualquier momento:

```powershell
git diff --no-index --unified=3 -- camera-verification.html apps/exercise-tester/camera-verification-bench.html
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

---

## Cómo portar y verificar

1. Aplicar los diffs de arriba a `camera-verification.html` (producción).
2. **Subir `VERIFY_VERSION`** en `apps/mobile/src/retos/verify.ts` (16 → 17 o el que
   siga) para forzar la recarga de la WebView (cache-bust).
3. Publicar `camera-verification.html` en gh-pages.
4. Probar en la app real: sentadillas e isométrica (que cuente sin tanta
   profundidad), el segundero de cadencia en ranking, zancadas **de perfil**
   (de costado a la cámara), que Mountain Climbers muestre la indicación de perfil,
   que con la mano levantada **no** arranque la sesión si falta ver alguna parte
   del cuerpo, y en flexiones los 10 s de margen para la primera rep (cuclillas →
   plancha).

Verificación del banco (desde la raíz del repo):

```powershell
pnpm --filter @resiliencia/exercise-tester typecheck
pnpm --filter @resiliencia/exercise-tester lint
pnpm --filter @resiliencia/exercise-tester test
```

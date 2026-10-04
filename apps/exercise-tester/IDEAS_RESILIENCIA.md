# Ideas para la app ResiliencIA

Mezcla de ideas del trabajo del banco de pruebas. **Nada de esto está en
producción**: la app móvil sigue con un ejercicio por sesión. Lo que sí está
implementado, en el **banco de pruebas** (`camera-verification-bench.html` +
app React Native del tester), está marcado como tal.

---

## 1. Sesión con secuencia de ejercicios (idea principal)

**Problema actual.** Una sesión es un solo ejercicio. Al terminar hay que detener
la cámara y tocar "Reiniciar": con las manos mojadas, en medio de la rutina, o de
noche, eso corta el flujo.

**Idea.** Elegir varios ejercicios antes de empezar, ordenarlos a mano, y que la
sesión los recorra en ese orden sin cortar la cámara.

### Flujo

1. En la selección de ejercicio se pueden **elegir varios** (multiselección) y
   **ordenar la secuencia** (cuál va primero, cuál después, …).
2. Arranca el primer ejercicio de la lista con el gesto de mano que ya existe.
3. Al **completar** un ejercicio la cámara sigue encendida y aparece el cartel de
   resultado ("meta cumplida"). Levantando la mano se **pasa al siguiente** de la
   secuencia.
4. Al **fallar** un ejercicio (demora entre reps, señal de vida, etc.) la cámara
   sigue encendida y levantando la mano se **reintenta ese mismo** ejercicio.
5. Al terminar el último, se muestra el resumen de la sesión.

### Estado por ejercicio

Cada elemento de la secuencia necesita su propio estado, no uno global:

- calibración de ángulo (`calibBuffer`, `restAngleCalibrated`)
- `gestureStarted`, `seriesOk`, `livenessPassed`, `cadenceDeadline`
- `reps` / `holdMs` de esa serie
- evidencia (`startedAt`, `finishedAt`, `durationMs`, `targetMet`)

### Reportes

- Un reporte por ejercicio (el actual, sin cambios).
- Un resumen de sesión: ejercicios completados / total, reps totales, tiempo, y
  si todas las series calificaron.

### Preguntas abiertas

- ¿La señal de vida se repite en cada ejercicio de la secuencia o una sola vez
  por sesión?
- ¿Se puede saltear un ejercicio con otro gesto, o la secuencia es estricta?
- ¿La cadencia se reinicia por ejercicio? (hoy es una sola ventana para toda la
  sesión)
- ¿Dónde se guarda la secuencia? ¿Por día, por rutina, por último uso?
- ¿Cuántos ejercicios máximo por secuencia? (impacta memoria y mensajes)

### Qué ya se adelantó en el banco

**Reinicio por mano de un ejercicio único.** Al completar o al fallar, la cámara no
se apaga, el cartel de resultado queda visible y levantar la mano reinicia la
serie (contador en 0, con el mismo 5-4-3-2-1).

**Secuencia de ejercicios (prototipo).** En el banco se puede elegir varios
ejercicios, ordenarlos con ▲/▼ y darles su objetivo; la página los recorre en ese
orden **sin recargar la cámara ni el modelo** (cambia `cfg`, objetivo y unidad en
vivo). Al completar se levanta la mano para pasar al siguiente, al fallar se
levanta para reintentar el mismo, y al terminar el último se levanta para empezar
de cero. La mano que habilita el paso es además la señal de arranque: no hace
falto un segundo gesto. Cada ejercicio genera su propio reporte
(`exerciseId`, `seqIndex`, `seqLength`, `seqDone`).

Decisiones que quedaron fijadas para el banco:

- Máximo **8** ejercicios por secuencia; se permiten repetidos.
- El objetivo se edita por ejercicio; la **unidad sale del CFG** de cada uno, no
  de la URL.
- La cadencia son **6 s/rep para todos** los ejercicios.
- Sin ranking (verificación simple), la secuencia avanza sola a los 3 s de
  completar; con ranking depende de la mano.
- Con ranking la señal de vida se repite en cada ejercicio (12 s).

Lo que sigue sin decidirse para producción:

- ¿Dónde se guarda la secuencia? ¿Por día, por rutina, por último uso?
- ¿Se puede saltear un ejercicio con otro gesto, o la secuencia es estricta?
- Resumen de sesión (completados / total, reps totales, tiempo) y si todas las
  series calificaron: todavía no está.
- Si en producción la señal de vida va una sola vez por sesión o por ejercicio.

## Voz del entrenador (prototipo, sin modelo)

El entrenador **no usa IA durante la serie**: son 40 frases escritas, repartidas en
5 puestos con 8 frases cada uno.

| puesto | cuándo                                               | aplica a        |
| ------ | ---------------------------------------------------- | --------------- |
| `pre`  | arranca la serie (reemplaza "Empezá cuando quieras") | reps y segundos |
| `mid`  | mitad de la serie, solo si la meta es ≥ 10           | solo reps       |
| `last` | cuando faltan exactamente 3                          | solo reps       |
| `done` | al completar la meta                                 | reps y segundos |
| `rest` | en la transición al siguiente ejercicio              | reps y segundos |

Cada serie consume como máximo una frase de cada puesto, así que una secuencia de
8 ejercicios da **una vuelta completa de las 40 sin repetirse**, y la sesión
siguiente arranca en el grupo siguiente. El índice sale de `seqDone`, no de un
cursor propio: si un puesto no dispara (por ejemplo `mid`, que en ranking está
desactivado) los demás no se desalinean.

Cuatro reglas que no son negociables:

- **Los números los pone el código.** La única frase con cuenta es `last`, y
  dispara en `repCount === targetVal - 3`. No hay forma de que diga "faltan dos"
  cuando faltan tres.
- **En isométricos no se habla dentro de la serie.** La fonación no deja vaciar
  los pulmones y rompe el braceo que sostiene la columna, así que `mid` y `last`
  solo aplican a `reps`. Una plancha de 45 s dice dos frases en total: `pre` y
  `done`.
- **En ranking hay silencio dentro de la serie.** La cadencia de 6 s se mide
  entre reps; si entra la voz, la pausa siguiente puede romper el ranking solo
  por hablarle. Ranking manda.
- **Gap de 2,5 s entre locuciones**, y el descanso se compone en un solo
  utterance con el nombre del siguiente ejercicio (`speak()` cancela lo anterior,
  así que hablar las dos cosas sonaba a arranque cortado).

El selector es determinístico y no necesita modelo: sin descarga, sin RAM, sin
conflictos con los 30 fps, y no puede decir nada fuera de lo escrito. El badge
gris de abajo de la cámara muestra la última frase dicha y el log marca `VOZ:`.

Pendiente para cuando se valide en el teléfono:

- Probar si la pausa de la voz arruina la cuenta de reps a 3 s en modo libre
  (con ranking ya está silenciado, pero en modo libre el contador corre libre).
- Decidir si `mid` y `last` juntos son demasiado en una serie de 10.
- Portar a producción requiere antes cerrar el `originWhitelist={['*']}` con
  `onPermissionRequest={(r) => r.grant()}` de `camretos.tsx` y `retos.tsx`.

### Fix: la frase de fin de serie se perdía

`postComplete()` llamaba `voiceSay('done')` y enseguida `waitForRestart(...)`, que
vuelve a llamar `speak()`. Como `speak()` hace `speechSynthesis.cancel()`, la
locución de `done` se cortaba a media palabra: al terminar una serie no se oía
nada. Ahora la frase se toma con `voiceTake()` y se compone con el mensaje de
transición en **una sola** locución, igual que el descanso. Además el caso de un
ejercicio suelto sin ranking no decía nada (la cámara ya está apagada, así que
el mensaje es "tocá Reiniciar", no la mano).

## Chat del entrenador (prototipo, sin modelo todavía)

En la pantalla de selección, antes de arrancar. Dominio cerrado: la app, los
ejercicios, los modos de ejecución y los datos del perfil. Todo sale de
`src/lib/chat.ts`, así que no puede inventar ni dar consejo de salud.

**No hay modelo todavía, y en Expo Go no se puede poner**: el banco corre en
Expo Go, que no trae reconocimiento de voz (ni en el WebView ni nativo sin
módulo), y `llama.rnn` exige dev build. Por eso el panel tiene entrada de texto
y el micrófono está deshabilitado a propósito con la nota al pie. Con una dev
build (`expo run:android` o EAS) el STT se enchufa en `ChatPanel` sin tocar el
dominio.

Las tres reglas están coded en `chat.ts` y tienen test, para que no dependan de
que un modelo se porte bien:

1. **Puerta de edad.** Con menos de 18 años el chat no devuelve datos del
   perfil ni entra en consejo. Se evalúa antes que cualquier otra intención, y
   un menor no la esquiva preguntando de otra forma.
2. **Los datos del perfil no se hablan.** Se LEE en pantalla; `habla: false`
   impide mandarlos al TTS. El TTS de Android por defecto es el de Google, que es
   cloud: decir "pesás 84 kilos" por ahí manda el dato fuera del teléfono aunque
   el modelo sea local.
3. **El perfil no genera consejo.** Puede leer un dato si lo piden; no puede
   derivar una recomendación de peso, edad u objetivo. Pasa con cualquier
   fraseo ("¿me conviene...", "¿cuánto tengo que bajar?").

Perfil de prueba en `PERFIL_FALSO` (Aníbal, 34, 84 kg) y `PERFIL_MENOR` para
probar la puerta sin tocar el principal.

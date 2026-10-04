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

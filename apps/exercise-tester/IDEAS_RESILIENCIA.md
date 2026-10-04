# Ideas para la app ResiliencIA (aún no implementadas)

Ideas del trabajo del banco de pruebas. **No están implementadas**: viven solo
como documentación hasta que se decidan.

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

Como primer paso se implementó **solo el reinicio por mano de un ejercicio
único**: al completar o al fallar, la cámara no se apaga, el cartel de resultado
queda visible y levantar la mano reinicia la serie (contador en 0, con el mismo
5-4-3-2-1). Es la misma mecánica de gesto que usaría el avance al siguiente
ejercicio de la secuencia.

# Acta 025 — Sensor no disponible avisa explícitamente a la WebView (fix mínimo)

- **Fecha**: 2026-10-21 · **Tipo**: fix (puente cámara↔sensor) · **Estado**: **aprobado por el PO** (probado en dispositivo: Caso 1 OK).
- **Participan**: [PO] (decide), [MOB] (implementa), [CV] (cámara/sensor), [QA] (verificación).
- **Relacionada**: actas 015/016/018; ADR y actas de cámara. HTML en v53 (`VERIFY_VERSION`).

## 1. Motivo

En `retos.tsx` y `camretos.tsx`, el puente del sensor hacia la WebView tenía un **retorno
silencioso**: si `DeviceMotion.isAvailableAsync()` devolvía `false`, el código hacía
`return` sin avisar nada. La WebView quedaba esperando su ventana de `SENSOR_CONFIRM_MS`
(8 s) y recién ahí mostraba "Sensor no confirmado", sin distinguir "sensor ausente" de
"sensor lento".

Provino de una propuesta de otro asesor (máquina de estados + handshake completo). Se
**descartó el plan sobredimensionado** y se aplicó **solo el fix mínimo** que corrige el
bug real.

## 2. Cambio aplicado

En ambos archivos, el callback de `isAvailableAsync()`:

```js
DeviceMotion.isAvailableAsync().then((available) => {
  if (!active) return;
  if (!available) {
    webviewRef.current?.injectJavaScript(
      'window.__resilienciaSetNativeOrientation && window.__resilienciaSetNativeOrientation({ available: false }); true;',
    );
    return;
  }
  DeviceMotion.setUpdateInterval(200);
  // ...listener de DeviceMotion (sin cambios)
});
```

- El HTML **ya maneja** `{ available: false }` (`camera-verification.html` L2624-2627:
  `sensorUnavailable = true`) → `ensureOrientationSensor()` corta de inmediato y muestra
  "Sensor no confirmado" **sin** esperar los 8 s.
- Se mantiene el guard `if (!active) return;` primero (no inyecta si el efecto ya se limpió).
- Se agregó **todo** dentro de la inyección (`...; true;`).

## 3. Alcance

- **No se tocó**: la cámara, el HTML, `VERIFY_VERSION` (sigue **53**), ni el resto de la
  lógica del sensor ni el deploy de gh-pages.
- 2 archivos, +14/−2.

## 4. Verificación

- **PO, dispositivo, Caso 1** (teléfono con sensor OK): Retos → INICIAR y Modo Libre →
  la cámara confirma el sensor y arranca **normalmente**. "Funciona muy bien". Confirma que
  el fix **no rompió el camino normal**.
- Los Casos 2/3 (forzar sensor ausente / emulador) quedaron **sin efecto** por decisión del
  PO.
- `pnpm typecheck` ✓ · `pnpm lint` ✓ · **221/221 tests (19 suites)** ✓.

## 5. Límite conocido (honestidad)

El aviso `available:false` es un `injectJavaScript` que depende del orden de carga: si
`isAvailableAsync()` resolviera **antes** de que el HTML defina el hook
`__resilienciaSetNativeOrientation`, el `&&` descarta el aviso en silencio. En la práctica
el efecto se monta con la cámara ya visible (WebView cargada), por lo que el riesgo es
bajo. **No verificado en dispositivo** (requiere forzar `!available`, que el PO dejó sin
efecto). Se acepta como mitigación suficiente; no se construyó el handshake.

## 6. Consecuencia

- Se cerró el bug del "retorno silencioso" con el cambio más pequeño posible.
- Se documentó la decisión de **no** migrar a módulos nativos ni rediseñar el puente
  (coherente con lo observado: el camino normal funciona).

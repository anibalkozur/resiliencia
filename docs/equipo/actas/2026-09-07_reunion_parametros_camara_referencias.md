# Acta 007 — Parámetros de cámara tomados de apps de referencia (entrada a Fase 3)

- **Fecha**: 2026-09-07 · **Tipo**: reunión de análisis (entrada a Fase 3) ·
  **Estado**: **cerrada (OK del PO, mismo día)**
- **Convocante**: PO (aportó capturas de 2 apps de referencia: "ejemplo de app 1"
  y "ejemplo de app 2", en `imagenes de referencias de app/`).
- **Convocados**: [DER] (conduce), [CV], [MOB], [MED], [DATA], [QA], [SEC], [PM].
  Cada agente leyó su ficha y la implementación de cámara
  (`camera-verification.html`).
- **Reglas de oro aplicadas**: regla 10 (cero simulación), acta 005 (nada que
  estigmatice), acta 006 (estimación solo si se rotula "no clínica" y vive lejos
  de la tarjeta de salud), D7 (costo cero, on-device) y directiva del PO de **no
  desarmar el conteo que ya funciona** (si se cambia la detección, debe subir
  exactitud/calidad del resultado).
- **Parámetros de las capturas extraídos por OCR** (el modelo de DER no ve
  imágenes; se usó el OCR nativo de Windows, es-ES).

## 1. Parámetros observados

**App A ("Pull Up Analysis"):**

- Por rep: tempo up/down (duración de fase en s), velocidad pico (m/s),
  sway lateral (cm), gap de codo, criterios FULL LOCK-OUT / CHIN AT BAR,
  `MUSCLE HEAT`.
- Resumen de serie: clasificación por rep (proper/short), rango de movimiento,
  peak speed best vs last, hip sway promedio, asimetría codo L/R, trabajo (kJ),
  potencia pico (W), energía estimada (kcal), effort & colspan× (reps restantes),
  avg efficiency /100, "56 cm per rep", cross-check **MediaPipe 33-pt +
  YOLOv8** con estimación de persona (188 cm, 79 kg).

**App B (coach de forma con MoveNet):**

- Ángulo articular en vivo con valor numérico + umbral "mínimo" configurable por
  ejercicio, "Confianza" del pose (%), "Recorrido %", **X NO REP** cuando no
  alcanza el recorrido mínimo, guías de colocación de cámara ("vista lateral:
  cadera, rodilla y tobillo visibles…"), estado de fase ("Arriba"/"Bajando").

**Estado del motor actual (verificado):** MediaPipe Pose 33-pt (WASM on-device,
lite), sentadilla frontal + flexión/abdominal lateral con auto-detección de
lado, calibración por persona (umbrales relativos), anti-ruido (3 frames, 350 ms
entre reps), postura real (apoyado/plancha/torso horizontal), liveness aleatorio
(mano arriba / aguantar 2 s abajo), continuidad (gap máx 40 s) y sensor de
orientación vertical obligatorio. El PO lo declara "funcionando bastante bien".

## 2. Veredictos

### 2.1 Técnico — [CV] + [MOB]

- **No se cambia el motor**: quedarse con MediaPipe 33-pt (→ ML Kit nativo en
  Fase 3). MoveNet (17 pts, app B) pierde puntos que nuestras reglas usan
  (`groundedRatio`, `torsoHorizontalAngle`) y obliga a recalibrar todo el test
  grid sin evidencia de ganar exactitud — viola la directiva del PO.
  _"No cambiamos cómo se detecta el cuerpo; agregamos qué medimos sobre lo ya
  detectado."_
- Clasificación por parámetro:
  - **(a) Solo post-procesamiento de los 33 pts actuales**: tempo up/down,
    velocidad pico **normalizada** (no m/s reales), ROM % con calibración de
    referencia, asimetría L/R (solo ejercicios frontales), clasificación
    rep proper/short, recorrido % en vivo con "X NO REP", confianza del pose
    (media de `visibility`, mapeada a guía de encuadre), estado de fase,
    guías de colocación.
  - **(b) Requiere otro modelo**: cross-check YOLOv8 (persona) y estimación
    peso/altura → **descartados**.
  - **(c) Requiere otro sensor/dato**: m/s y cm reales (distancia calibrada),
    trabajo J / potencia W (masa + distancia), kcal exactas (FC). Con peso del
    perfil se podrían _estimar_ crudas (±30–50%), no medir.
- Priorización técnica:

| Parámetro                                         | Prioridad            | Esfuerzo    |
| ------------------------------------------------- | -------------------- | ----------- |
| Recorrido % en vivo + "X NO REP"                  | **P0**               | Bajo (días) |
| Clasificación rep proper/short                    | **P0**               | Bajo        |
| Tempo up/down por rep                             | **P0**               | Bajo        |
| ROM % por serie/rep (+ referencia en calibración) | **P0**               | Bajo        |
| Ángulo en vivo + umbral mín. configurable         | **P0**               | Muy bajo    |
| Confianza del pose (UX)                           | **P0**               | Muy bajo    |
| Estado de fase + guías de colocación              | **P0**               | Muy bajo    |
| Asimetría L/R                                     | **P1**               | Medio       |
| Velocidad pico **normalizada**                    | **P1**               | Bajo        |
| Fatiga / reps restantes (heurística)              | **P1**               | Medio       |
| Eficiencia /100                                   | **P1**               | Medio       |
| Trabajo J / potencia W / kcal                     | **Descartar** Fase 3 | —           |
| m/s y cm absolutos (56 cm/rep)                    | **Descartar**        | —           |
| Cross-check YOLOv8                                | **Descartar**        | —           |

### 2.2 Clínica y comunicación — [MED] + [DATA]

- **Rotulado**: cada métrica lleva `~estimado` junto al valor + bloque "?" /
  disclaimer estándar ("Estimación de entrenamiento, no medición clínica").
  Viven **solo** en la pantalla de resultados de la sesión; **nunca** en la
  tarjeta de salud del perfil. Colapsables/ocultables por defecto.
- **Potencia W**: riesgo de leerse como rendimiento capacidad (estigmatizante
  a nivel deportivo) → **ocultar por defecto o eliminar**.
- **Efficiency /100**: se retira la nota que escala y juzga → migrar a
  "Consistencia del movimiento" (descriptiva). Base: acta 005 (auto-estigma →
  abandono 32.5% vs 21.6%).
- **Fatiga / reps restantes**: base honesta = solo decaimiento de ritmo/
  velocidad intra-sesión. **Informativa, NO puntúa, NO entra al ranking ni a
  XP** (si no puntúa, no vale gamearla).
- **Rango de movimiento**: solo como **tendencia semanal propia** (auto-
  referencia), jamás valor absoluto ni comparación contra "normal" o contra
  otros. Velocidad pico: entrenamiento puro, sin lectura de salud.
- **Reps no contadas**: dato binario ("no completó el recorrido"), sin adjetivo
  de reproche.
- **Telemetría agregada** (PostHog futura, retención ≤30 días, sin landmarks):
  `session_results_viewed`, `session_metric_expanded`,
  `session_metric_info_opened`, `week_avg_range_of_motion`,
  `week_avg_peak_speed`. **Alarmas**: `results_exit_rate` >40% sin interactuar o
  D30 cayendo >5 pp → rollback.

### 2.3 Calidad, seguridad y fases — [QA] + [SEC] + [PM]

- **Fixtures**: recorrido %, tempo, clasificación y "X NO REP" son testeables
  con videos de referencia con reps conocidas; las estimaciones (masa/altura)
  no son testables de campo, solo consistencia interna.
- **Riesgo de regresión ALTO si se calcula por frame** (CPU/térmica en gama
  baja) → **las métricas de detalle se calculan al final de cada rep**
  (en `registerRep()`) y fatiga/energía una vez al final de la serie. El loop
  por frame no cambia.
- **Criterio de recorrido** (configurable por persona, sobre calibración):
  completa ≥80 %, corta 50–79 %, NO REP <50 % del ROM de referencia. El umbral
  de "NO REP" es un gate **adicional**, no reemplaza el conteo actual. Test de
  no-regresión obligatorio (20 clips del grid existente deben contar idéntico).
- **Anti-fraude**: las métricas nuevas **nunca alimentan scoring/ranking**;
  velocidad **nunca** como dato competitivo (el zoom cambia la escala); asimetría
  L/R **no** se expone en perfiles públicos; la **evidencia firmada queda tal
  cual 6.3.1** (reps, timestamps, continuidad, liveness, orientación) — las
  métricas derivadas no se hashean.
- **Phasing [PM]**: entra como incremento al **DoD de Fase 3** (no fase nueva).
  P0 y P1 no extienden la Fase 3 (post-procesamiento + resumen). El dictamen
  [PM]+[QA]+[SEC]: el bloque "estimaciones" (energía/potencia/fatiga/eficiencia)
  **se descarta de la Fase 3** por costo/calidad y riesgo de confusión, salvo
  decisión explícita del PO (ver 3) — con wearables (Health Connect) reales
  podría entrar más adelante.
- **Cross-check YOLOv8**: no para conteo — es presencia (bbox), no calidad de
  rep; doble inferencia degrada la gama baja y las defensas actuales (liveness +
  continuidad + orientación + plausibilidad server-side) ya cubren los vectores.
  La identidad de persona en serie se resuelve con verificación esqueleto/rostro
  dentro del liveness aleatorio, si algún día hiciera falta.

### 2.4 DoD propuesto (bloque "detalle de repetición", P0+P1)

- [ ] Recorrido % por rep y promedio de serie; "X NO REP" en vivo.
- [ ] Tempo up/down por rep + promedio; clasificación corta/completa.
- [ ] Resumen de serie con las métricas P0/P1.
- [ ] 30 clips de referencia (10 completas + 5 cortas + 5 no-reps × 3 ejercicios)
      → clasificación ≥95 % / ≥90 % / 100 % correctas; tempo ±15 %.
- [ ] Test de no-regresión: conteo idéntico en los clips del grid existente.
- [ ] Gama baja: sin throttle ni <20 FPS en sesión de 3 min (térmica).
- [ ] Métricas nuevas fuera del hash de evidencia y fuera del ranking/scoring.
- [ ] Rótulo "~estimado" + bloque "?" en toda métrica de detalle.

## 3. Decisiones (registradas por el PO)

1. **Se mantiene el motor** (MediaPipe 33-pt) — no se cambia la detección del
   cuerpo; las métricas se agregan como capa de post-procesamiento. _(Coincide
   con la directiva del PO.)_
2. **Bloque P0+P1** ("detalle de repetición") entra en el DoD de Fase 3.
3. **Peso/altura estimada desde cámara: descartado** _(decisión del PO)_.
4. **Estimaciones (energía kcal / potencia W / fatiga / eficiencia)**: se
   **adoptan con restricciones** _(OK del PO)_:
   - Solo en la pantalla de resultados de la sesión; **nunca** en la tarjeta de
     salud del perfil.
   - Rótulo `~estimado` junto al valor + bloque "?" / disclaimer estándar
     ("Estimación de entrenamiento, no medición clínica").
   - **Potencia W oculta por defecto** (expandible).
   - **Eficiencia renombrada a "Consistencia del movimiento"** (sin /100, sin
     nota que escale).
   - **Fatiga solo por decaimiento de ritmo/velocidad intra-sesión**;
     informativa, **no puntúa ni entra al ranking/XP**.
   - Fórmulas de kcal/J/W sin masa: asumidas con error ±30–50 %.
5. **Asimetría L/R: no se implementa** _(OK del PO)_ — se elimina la P2; se evita
   cualquier lectura de "debilidad/lesión" y la exposición en perfiles públicos.

## 4. Pendientes

- Actualizar el **DoD de Fase 3 del `PLAN_COMPLETO.md`** con este bloque (lo
  anota [PM] al planificar la Fase 3).
- Nada de lo acordado se codea en Fase 0: es backlog de la Fase 3 ([CV]+[MOB]+
  [QA]) con el test de no-regresión como puerta.

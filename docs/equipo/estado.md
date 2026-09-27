# Estado del equipo

- **Fase**: 0 (Fundaciones) · **Sprint**: 0
- **Última actualización**: 2026-09-08 (día 3)

## Estado actual

- Reunión: **kickoff cerrada (OK del PO)** — acta 001 firmada en
  `docs/equipo/actas/2026-09-06_kickoff.md`.
- Reunión: **planning del bloque Fase 0 cerrada (OK del PO)** — acta 002 en
  `docs/equipo/actas/2026-09-06_planning_bloque0.md`. Bloque T1–T4 ejecutado.
- Se abre la Fase 0. Sin gastos (D7e).

## Directivas del PO

- **2026-09-06**: sin financiamiento inicial → prioridad absoluta al producto,
  infraestructura 100% costo cero hasta generar ingreso (refuerza D4 de la
  acta 001). Registro de marca diferido; solo chequeo de disponibilidad.
- **2026-09-06**: el PO verá los avances **en su celular vía Expo Go**
  (misma red WiFi, `exp://192.168.1.116:8081`). Cada avance visible se le
  muestra así para su OK visual.
- **2026-09-06 (decisión de avance, sin reunión plena)**: se sigue **local
  primero** (la app funciona sin nube) y [BE] arranca la nube **en paralelo**
  (Supabase, gratis). No se requiere reunión de todos: es trabajo en ruta del
  plan aprobado. El motor de retos local se adelanta (PO prioriza ver la app
  crecer); la verificación con cámara sigue en Fase 3 con [CV].
- **Pendiente para nube**: cuenta Supabase (gratis) con la que [BE] armará
  auth + esquema → pedir email al PO cuando se abra el trabajo en la nube.
- **2026-09-06 (corrección del PO, rumbo)**: **frontend primero** — que la app
  luzca, con entradas y configuraciones reales. El usuario **NUNCA** completa
  ejercicios a mano: el reto lo verifica la cámara (D6, anti-trampa). Se
  eliminó el ingreso manual que se había agregado por error ([PM] asume la
  corrección; el plan manda y se lee antes de codear). La verificación con
  cámara se declara **pendiente** (Fase 3, [CV]) — nunca simulada.
- **2026-09-06 (investigación encargada)**: el PO pidió analizar "cómo son las
  apps de este estilo": [GRO] + [MOB] + lente [UX] relevaron formato y
  preferencias de las más usadas. Informe entregado en
  `docs/equipo/market/2026-09-06_analisis_competencia.md`.
- **2026-09-06 (rumbo aplicado, decisión del PO)**: Perfil con datos reales
  (edad/peso/altura), reto adaptado al objetivo guardado, e i18n ES/EN/PT real
  en todas las pantallas con cambio en vivo. **37 tests verdes** (11 nuevos).
  Commit `04b44d6`.
- **2026-09-06 ([CV])**: contrato de evidencia `validate_workout` especificado
  en papel (formato del paquete, reglas server-side, umbrales a calibrar) —
  base de la Fase 3, cero costo. `docs/equipo/market/2026-09-06_contrato_evidencia.md`.
- **Nube Supabase (decisión del PO)**: se arranca **local first con la CLI**
  (no hosting aún). La máquina no tiene Docker ni Scoop: `supabase start`
  (stack completo) requiere contenedor → se avanza con **migraciones SQL
  versionadas** en `C:\Users\Anibal\Dev\resiliencia\supabase\migrations\`,
  aplicables después en local u hosting sin costo (D7e).
  - `0001_initial_schema.sql`: profiles (RLS por fila, un registro por `auth.uid`,
    edad/peso/altura validados 13-100 / 30-300 / 100-250, goal, idioma),
    ejercicios (catálogo lectura pública), daily_challenges (clave user+date),
    workout_sessions (status pending/verified/manual_review/rejected),
    streaks (**solo el servidor escribe**: el cliente no puede falsificar rachas).
  - `0002_personal_domain.sql`: workout_exercises (RLS vía sesión propia),
    progress, levels/achievements/user_levels/user_achievements (XP y logros
    **solo backend** — regla dura de `DATABASE.md`, sin auto-boost del cliente).
  - Social/gyms/ads + `sync_queue` **siguen pendientes** (fases posteriores,
    DF06+; no se portan aún para evitar tablas muertas).
  - **No ejecutado**: aplicar las migraciones requiere Postgres/Docker/local
    supabase (pendiente en próximos pasos) — trabajo real, cero simulación.
- Cámara+IA en TODOS los modos de la app (D6 modificada).
- Corpus de IA hardwired on-device con docs verificados (D7d **aprobado**).
- **Continuamos sin gastos**: no se compra dominio ahora. Opciones
  confirmadas (RDAP): libres `resilienciaapp.com`, `resilienciaapp.com.ar`,
  `resilienciapp.app`; tomados `resiliencia.app`, `resiliencia.com`
  (acta 001, D7a.2/D7e).

## Bloqueantes de Fase 0

| #   | Bloqueante                         | Dueño           |
| --- | ---------------------------------- | --------------- |
| B1  | Nombre/marca/dominio "ResiliencIA" | [LEG]           |
| B2  | Repo monorepo + CI verde           | [PM]+[MOB]+[BE] |
| B3  | Tokens de diseño                   | [UX]            |

## Próximo gate

- **Fase 0 — Gate de salida** (2 semanas): checklist del plan + acta firmada.

## Progreso Fase 0 (2026-09-06)

- **Repo**: `C:\Users\Anibal\Dev\resiliencia` (físico, junction `resiliencia` en
  App Retos GYM 1 — OneDrive no sincroniza el código). git init en `main`.
  Workspace pnpm (root + apps/mobile + packages/design-tokens).
- **Scaffolding**: Expo SDK 57 blank-typescript en `apps/mobile`.
- **Design tokens**: `@resiliencia/design-tokens` con paleta del brand guide
  (teal/cyan/blue/silver/ember + bg/surface/line), radius, spacing, tipografía.
- **Metro monorepo**: `metro.config.js` con watchFolders + nodeModulesPaths.
- **Pantallas placeholder**: 3 tabs (Inicio/Retos/Perfil) con tokens, modo
  oscuro, sin emoji. `app.json` rename → ResiliencIA.
- **Router**: instalo `expo-router` (SDK 57). Estructura `app/`:
  `app/_layout.tsx` + `app/(tabs)/` con Inicio/Retos/Perfil y `ScreenShell`
  con tokens. Soporte web (react-dom + react-native-web). `app.json` con
  scheme `resiliencia` + plugin expo-router.
- **Git**: commit local `1694e2e` en `main` (29 archivos).
- **GitHub**: repo privado creado → `https://github.com/anibalkozur/resiliencia`
  (usuario `anibalkozur`), origin en https, `main` público con seguimiento.
- **CI (GitHub Actions)**: `.github/workflows/ci.yml` — typecheck + lint +
  format check + **test** en push a main y en cada PR. Runs: **success**
  (`f67b345`, `39e61ca`).
- **Lint real**: ESLint 9 (flat) con `eslint-config-expo` +
  `eslint-config-prettier` en `apps/mobile`; script `lint` = `eslint .`
  (bypass del bug de resolución pnpm de `expo lint`).
- **Prettier**: reglas del equipo en `.prettierrc.json` (singleQuote,
  trailingComma all, width 100) + `.prettierignore`. `prettier --check .`
  en CI.
- **Husky + lint-staged (T1)**: pre-commit corre typecheck + lint + formato
  automático. Probado con un commit con error de tipo que **quedó bloqueado**.
  Commit `0120fb8`.
- **Persistencia `IRepo` (T2)**: `expo-sqlite` + contrato `IRepo`
  (`types.ts`, `memoryRepo.ts` para tests, `sqliteRepo.ts` para la app).
  Pantalla Perfil guarda el apodo en el dispositivo. **5 tests Jest verdes**;
  paso Test reactivado en CI (antes era no-op). Commit `a7a51b3`.
- **Íconos de línea (T3)**: `HouseIcon`/`DumbbellIcon`/`UserIcon` (SVG, trazos
  brand guide, sin emoji) en las 3 tabs con tokens. **OK visual del PO (v1)**.
  Commit `9e5859f`.
- **Usuario local (creación de usuario)**: onboarding en primera apertura pide
  el apodo y lo persiste en SQLite vía `IRepo`; la navegación queda bloqueada
  hasta crear el usuario (sin usuario → onboarding; con usuario → tabs).
  `Perfil` usa `UserProvider` como fuente única. **10 tests verdes** (5 del
  servicio de usuario). Commit `0b8f8ad`.
- **Motor de retos diario v0 (local-first)**: catálogo de ejercicios
  (sentadillas/plancha/flexiones), reto rotativo por día con meta, guardado vía
  `IRepo` y completación manual en la tab Retos. La verificación con cámara
  llega en Fase 3 ([CV]). **16 tests verdes**. Commit `55d9261`.
  - **Corrección (2026-09-06)**: quitada la completación manual (violaba D6).
    El reto ahora declara que se verifica con cámara al entrenar (pendiente
    Fase 3), sin simulaciones. Commit `40363b9`.
- **Ajustes (entradas y configuraciones reales)**: tab Ajustes con objetivo
  (perder grasa / ganar músculo / mantener), días por semana (2–6) e idioma
  (ES/EN/PT), terminando guardados vía `IRepo`. **19 tests verdes**. Commit
  `40363b9`.
- **Inicio con datos reales**: saluda al usuario por su apodo y muestra la
  tarjeta del reto de hoy. Commit `40363b9`.
- **Análisis de competencia (investigación)**: mapa de las apps de fitness más
  usadas (NTC, Freeletics, FitOn, Caliber, Strava, Hevy/Strong, etc.), el
  formato que el mercado espera (tab bar, métricas de vistazo, streak, tema
  oscuro neón, onboarding rápido) y los dolores (registro manual, paywalls
  falsos, ads, abandono post-febrero). Diferenciador confirmado: la cámara
  elimina el registro manual. Informe en `docs/equipo/market/`.
- **Métricas de vistazo + Progreso + logo de marca**: Inicio muestra Racha,
  Completados y Días (datos honestos, arrancan en 0); nueva pestaña **Progreso**
  con estado vacío real; motor de racha (`streak.ts` + `completions.ts`) que se
  alimenta cuando la cámara verifique retos (Fase 3, sin simulaciones). **Barra
  de marca con el logo real** arriba en las 5 pestañas (decisión [UX]);
  quitadas las frases redundantes "verificada con cámara". **26 tests verdes**
  (7 nuevos de racha). Commit `f539a08`. **OK visual del PO**. Prettier +
  typecheck + lint verdes.
- **EAS Build configurado (T4)**: `eas.json` (dev/preview/prod) +
  `android.package`/`ios.bundleIdentifier` `app.resiliencia`. Solo
  configurado, **no ejecutado** (D7e). Commit `5c3aac6`.
- **Reglas de equipo**: `EQUIPO.md` reglas 8–11 — 8 fichas hardcore, 9
  entregable real por sesión, 10 cero simulación, 11 apoyo cruzado.
- **Verificación**: `pnpm -r typecheck`, `pnpm -r lint`,
  `prettier --check .` y `pnpm -r test` **verdes** local y en CI.

- **Port de dominio a `packages/domain` (Fase 1.8)**: nueva ruta del motor
  lógico de `app.html` a TypeScript puro, **1:1 sin cambiar comportamiento**
  (regla dura [MOB]): `ProgressionEngine` (progresión +1/día con techo
  SafetyEngine `last+3` y readaptación 7d=0.7 / 14d=0.5), `applyStreak`,
  `ACHIEVEMENTS` (8 logros con `totalReps`), `levelForXp`/`xpForNextLevel`
  (`LEVELS` original), `freshState`, `finishWorkout` (XP = 10 + reps).
  Verificado contra `app.html`: **idéntico**. 7 suites con **69 tests verdes**
  (totales del repo: **106**). `pnpm -r typecheck/test/lint` + prettier verdes.
  CI ya lo cubre (`pnpm -r --if-present`). Se creó `packages/domain` en el
  workspace sin tocar la app ni el esquema. Sin commit aún.

- **Push y sellado (2026-09-07, día 2)**: `04b44d6` (perfil+objetivo+i18n),
  `fb2175d` (port de dominio) y `65c462e` (migraciones [BE]) pusheados a main
  → **CI success** (run `34147302987`). Árbol limpio; `main` al día.
- **Nota CI (no bloqueante)**: GitHub deprecó Node 20 en las actions
  (checkout/setup-node/pnpm) → se fuerzan a Node 24. Mejora menor pendiente en
  `.github/workflows/ci.yml` (pinning de Node 24 explícito).
- **Corrección PO (2026-09-07, feedback visual)**: Inicio y Progreso repetían
  las mismas 3 métricas → **diferenciadas**: Inicio ahora muestra saludo +
  racha de hoy + reto; Progreso muestra mejor racha (`getBestStreak` nuevo,
  derivado real de `completed:*` sin simulación), total completados, días y un
  track de la última semana. **Tabs ahora traducidas** (es/en/pt) vía
  `usePrefs` + keys `tabs.*`. 4 tests nuevos de racha → **110 tests verdes**
  (41 mobile + 69 domain). Lint/typecheck/prettier verdes. Sin commit aún.
- **Lección del equipo**: no se convocó la lente [UX]+[QA] previa al commit de
  i18n/tabs — se agrega a pre-flight: "nueva pantalla → check [UX] de
  contenido repetido + check [QA] de traducción completa antes de commitear".
- **Nuevo Inicio (acta 004, 2026-09-07)**: reunión convocada por el PO con
  [UX]/[GRO]/[MOB]/[DATA] (todos leyeron ficha + análisis de competencia).
  Consenso: Inicio = HOY (acción), Progreso = HISTORIAL; cero simulación;
  descartados rings/heatmap (duplican Progreso), barra XP (requiere
  DomainStore aún no portado a mobile) y placeholder de cámara (marketing sin
  producto). Implementado y pusheado (`89689e3`, CI verde):
  - Saludo según hora (buen día/tardes/noches) + apodo, en ES/EN/PT.
  - Hero del reto de hoy: nombre, meta en grande, chip "Día {n} de tu reto"
    (de `completed:count`, real) y chip "Plan: {objetivo}".
  - CTA "VER" (navega a pestaña Retos, sin mentir sobre la cámara).
  - Racha: si >0 número+RACHA HOY; si 0, microcopy "Completá tu primer reto y
    encendé tu racha hoy" (el 0 como día 1).
  - Preview honesto "Mañana: {ejercicio}" (`buildChallenge(tomorrowKey())`,
    determinista). Ayudantes nuevos con tests: `getCompletedCount`,
    `tomorrowKey`. **115 tests verdes** (46 mobile + 69 domain).

- **Consulta "preguntar a mis agentes.txt" respondida (acta 003)**: cada
  hardcore leyó el archivo del PO (4 propuestas) y opinó desde su rol.
  **Decisión del PO**: se ven en las fases correspondientes — cámara nativa →
  Fase 3 (con pinning de modelo [SEC] y test grid [QA]), docs en repo →
  post-gate Fase 0 (fuente única git, OneDrive solo lectura), fallback IA →
  Fase 9 (con reglas de prompt injection + rate-limit [SEC] previas), EAS
  automático en CI → **desestimado hasta Fase 10** (quema builds free).
  Acta: `docs/equipo/actas/2026-09-07_consulta_preguntar_a_mis_agentes.md`.

- **Pestaña Retos = "Tu semana de entrenamiento" (2026-09-07, elección del PO:
  afinarla)**: convocado [MOB]/[UX]/[DATA]. Decisión: Inicio = reto DE HOY
  (hero); **Retos = tu plan semanal** — no repite al Inicio. Implementado y
  pusheado (`be595c3`, CI corriendo):
  - Helper determinista `buildWeek(goal, daysPerWeek, today)` (`week.ts`):
    lunes a domingo, primeros `daysPerWeek` días entrenan (usa `prefs.daysPerWeek`),
    resto descanso; ejercicio/meta del día = mismo motor `buildChallenge`
    (sin inventar nada). 6 tests nuevos de semana → **121 tests verdes**
    (52 mobile + 69 domain).
  - Vista: título "TU SEMANA" + chip "PLAN: N DÍAS/SEMANA" + fila de 7 celdas
    (hoy con borde teal y celda pintada, dot teal si `completed:date`, descanso
    atenuado, tappable) + tarjeta del día seleccionado: ejercicio/meta en teal;
    si descanso → "DESCANSO"; si hoy → nota de cámara (Fase 3) honesta.
  - i18n ES/EN/PT con paridad (keys `retos.*`). Sin dependencias nuevas, sin
    emoji, sin duplicar Progreso (ahí vive el historial real).
- **Perfil con medidas + IMC honesto (2026-09-07, elección del PO)**:
  implementado y pusheado (`cdb03f1`, CI corriendo):
  - Fila de 3 medidas guardadas reales (edad/peso/altura del perfil; `—`
    honesto si faltan, no ceros inventados).
  - Card "TUS MEDIDAS" con IMC derivado real (`computeBmi` = peso/(m²),
    categorías OMS: bajo/normal/sobrepeso/obesidad con color de marca
    cyan/teal/ember) — oculta el número hasta que peso y altura existan y
    muestra el hint en vez de mentir.
  - Helpers nuevos con tests: `computeBmi`, `bmiCategory` (5 tests) → **124
    tests verdes** (55 mobile + 69 domain). i18n ES/EN/PT con paridad.
  - Convertido a `ScrollView` (la pantalla ya no entra en pantalla sin scroll).
- **Motor fino de retos (2026-09-07, directiva del PO "analicemos bien los
  retos de semana y día")**: convocados [MOB]/[DATA]/[UX] (todos leyeron ficha.
  Consenso: catálogo 3→7 ejercicios, rotación por semana **sin repetir dentro
  de la semana**, targets constantes (sin progresión inventada), descanso
  **distribuido**, aceptado). Implementado (sin commit aún):
  - `catalog.ts`: 7 ejercicios con i18n (`exercise.*.name/desc`), pools de 7
    por objetivo (composición distinta), targets base y multiplier por goal.
  - `service.ts`: rotación determinista `(isoWeek + isoWeekday) % 7` — mismo
    veek → ejercicio distinto por día, cambia por semana; misma fecha → mismo
    reto (regla dura preservada); reto ya guardado HOY no cambia (inmutabilidad).
  - `week.ts`: días de entreno **distribuidos** (ej. 4 → L-X-V-S) en vez de
    bloque al inicio (`TRAINING_SLOTS`).
  - Tests: 2 nuevos en service + week actualizado → **126 tests verdes**
    (57 mobile + 69 domain). typecheck/lint/prettier verdes.
- **Tarjeta IMC no chocante (2026-09-07, elección PO + acta 005)**:
  convocados [GRO]/[UX]/[DATA]/[MOB] (ficha + competencia). Veredicto
  conjunto: IMC como **número + escala continua + distancia**, sin etiqueta
  dura. Evidencia de mercado: el patrón top (Apple Health/Google Fit/Fitbit/
  Samsung/Withings) = número + gráfico/barra, sin rótulo; MyFitnessPal
  acumula quejas por "overweight" y Kurbo de WW murió por body shaming
  (NYT/CNBC); estudios: auto-estigma → abandono 32.5% vs 21.6%, y decir
  "overweight" eleva estigma internalizado (doble ciego, Journal of Health
  Promotion). **Decisión PO**: barra + distancia + rango saludable + modal
  "?". Implementado (sin commit aún):
  - `service.ts`: `healthyWeightRange(heightCm)` (rango por IMC 18.5–24.9) y
    `weightDeviation` (kg de distancia, con signo), `BMI_LOWER/UPPER`. 9
    tests nuevos de rango/desviación.
  - `perfil.tsx`: título "IMC" + botón "?" → modal explicativo (referencia
    poblacional, no diagnóstico: no distingue músculo/edad/género), valor
    grande, barra de escala de 15 a 40 con zona saludable 18.5–24.9 en teal
    y marcador posicional, texto neutro de estado
    ("Estás X kg por encima/por debajo del límite del rango saludable" /
    "Estás dentro…") y **"Peso saludable para tu altura: X – Y kg"**.
    Descartada la etiqueta OMS dura en UI (se conserva `bmiCategory` en
    dominio para estadística). Gate [DATA] post-lanzamiento: si abandono de
    Perfil sube >5pp → rollback.
  - i18n ES/EN/PT con paridad (keys `profile.bmi_*`, `profile.healthy_range`)
    → **135 tests verdes** (66 mobile + 69 domain). typecheck/lint/prettier
    verdes.
- **Perfil enriquecido + parámetro extra (2026-09-07, acta 006)**: consultado
  [MED] (especialista recién contratado) por la idea del PO de un "PAI" propio.
  Veredicto: el PAI real (Xiaomi) es una métrica de FC licenciada (NTNU/HUNT),
  no de peso; inventar un score clínico sin validación = simulación (regla 10);
  los únicos parámetros reales hoy son WHtR (cintura/altura, corte 0.5) y hacia
  Fase 3 la composición medida [CV]. **Decisión del PO**: WHtR real + Score de
  hábito 0-100 (motivacional, no junto al IMC) + Peso meta motivacional (ganar
  músculo + deporte → límite superior del rango sano, solo IMC < 30, con
  disclaimer). Implementado y pusheado (`2416292`, CI en verificación):
  - `UserSport { sport, years, daysPerWeek }` + `sports?`/`waistCm?` en
    `UserProfile` (JSON embebido → sin migración, [MOB]).
  - `service.ts`: `SPORT_CATALOG` (11 deportes), `normalizeSports`,
    `normalizeWaistCm`, `computeWhtr`, `whtrZone` (frontera ±0.02 sin veredicto),
    `habitScore`, `bmiContext` ('muscle' solo IMC 24-30 + ganar músculo +
    deporte; **nunca ≥30**), `muscleTargetWeight`. `computeBmi` y umbrales OMS
    intactos.
  - `perfil.tsx`: objetivo (mudado desde Ajustes), deportes multi-select con
    steppers años/días, score de hábito, contexto IMC "no distingue músculo",
    meta operativa con disclaimer y medidas opcionales plegables (cintura →
    WHtR). `ajustes.tsx` queda con idioma + días/semana.
  - i18n ES/EN/PT con paridad (keys `profile.*`, `sport.*`; se retira
    `settings.goal`) → **155 tests verdes** (86 mobile + 69 domain).
    typecheck/lint/prettier verdes. Acta:
    `docs/equipo/actas/2026-09-07_reunion_parametro_extra_imc.md`.
- **Parámetros de cámara de apps de referencia (2026-09-07, acta 007,
  cerrada/OK del PO)**:
  convocados [CV]+[MOB], [MED]+[DATA], [QA]+[SEC]+[PM] para analizar las
  capturas del PO (2 apps: detalle de rep + coach MoveNet). Veredicto conjunto:
  **no se cambia el motor** (MediaPipe 33-pt → ML Kit nativo); las métricas se
  agregan como post-procesamiento. **P0**: recorrido % + "X NO REP", clasificación
  rep proper/short, tempo up/down, ROM % y ángulo vivo. **P1**: velocidad pico
  normalizada (no m/s), fatiga heurística, "consistencia del movimiento".
  **Descartado**: peso/altura desde cámara (decisión PO), m/s/cm absolutos,
  trabajo J / potencia W / kcal exactos, YOLOv8 (doble inferencia degrada gama
  baja) y **asimetría L/R**. **Decisión PO**: energía kcal / potencia W / fatiga /
  eficiencia se **adoptan solo como "estimación"** restringida (`~estimado` + "?",
  potencia oculta por defecto, eficiencia → "consistencia" sin /100, fatiga solo
  por ritmo y sin puntaje, lejos de la tarjeta de salud). Evidencia firmada queda
  6.3.1; métricas nuevas fuera del hash y del ranking. Bloques entran como
  incremento al DoD de **Fase 3** (nada se codea en Fase 0). Acta:
  `docs/equipo/actas/2026-09-07_reunion_parametros_camara_referencias.md`.
- **OK visual PO (2026-09-08, día 3)**: Perfil con auto-guardado (sin botón
  GUARDAR global, solo apodo), IMC que recalcula solo y tarjetas en orden
  IDENTIDAD → TU CUERPO → IMC → OBJETIVO → DEPORTES → MEDIDAS OPCIONALES.
  Validado en Expo Go. Commits `2416292`/`363680c`/`8c68d06` con **CI success**.
- **Moneda de recompensas (2026-09-08, acta 008 — cerrada/OK del PO)**: idea
  del PO (modelo Habity/Well): puntos por retos verificados → canje por
  descuentos/giftcards en comercios partners. Consultados [GRO]/[SAL]/[FIN]/
  [LEG]/[SEC]/[DATA]/[UX]/[MOB]/[PM]. Encuadre: **programa de lealtad** (sin
  azar, sin compra obligatoria, sin efectivo) con T&C y base de datos Ley
  25.326. Moneda **separada del XP/ranking**. **Todas las sesiones siempre con
  cámara** (reto semanal o personal; refuerza D6) y **solo ellas generan valor**;
  los hábitos declarados quedan como input futuro de la IA motivacional, jamás
  como valor. Economía: 100 pts = 1 USD de descuento que absorbe el sponsor
  (pasivo = reserva con breakage), acreditación diferida ~72 h reversible, topes
  - expiración. **Nombre elegido: RESIS** (`RS`; "ResiCoin" descartado por
    connotación cripto). **Momentum definido por el PO**: los RESIS aparecen
    **cuando la app presente ganancias y sea reconocida** para adherir comercios;
    hasta entonces no se muestra saldo ni "canje próximamente". Acta:
    `docs/equipo/actas/2026-09-08_reunion_moneda_recompensas.md`.

## Backlog informativo (propuestas del PO, con fase de entrada)

1. **Cámara nativa** (vision-camera + ML Kit/Vision) → **Fase 3** ([CV]+[MOB],
   pinning [SEC], grid [QA], `validate_workout` [BE]).
2. **Docs en repo** (`/docs`, fuente única git) → **post-gate Fase 0** ([PM]+[SRE]).
3. **Fallback IA local** (gama baja → plantillas/Edge) → **Fase 9** ([BE]+[MOB];
   sanitización + rate-limit [SEC] como requisito previo).
4. **CI/CD**: typecheck/lint/test ya en CI; agregar `pnpm audit`. **EAS build
   automático → Fase 10**, bajo demanda antes (consumiría créditos free).

## Pendientes Fase 0 (próximas tareas)

1. **Chequeo formal de marca en INPI** ([LEG] — bloqueante B1, diferido por el
   PO para seguir con la app).
2. **Cron `healthz` + backup esqueleto** ([SRE] — acción de la acta 001,
   diferida por el PO).
3. EAS build **real** (necesita cuenta Expo + `eas init` y consumiría
   créditos) → se ejecuta solo con autorización del PO.
4. PR por tarea (con repo remoto activo).
5. Resto del checklist de Fase 0 del `PLAN_COMPLETO.md` (gate en 2 semanas).

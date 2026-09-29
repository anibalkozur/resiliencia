# ResiliencIA — Análisis técnico y de producto

> Nota de alcance: este documento cubre los 33 puntos pedidos en la sección
> "Primera acción obligatoria". El código entregado en esta primera entrega
> implementa **Fase 1 (MVP Home)** completa y funcional; Gym, social,
> monetización y publicidad quedan documentados y con el modelo de datos
> preparado, pero no implementados en código todavía (ver ROADMAP.md).

## 1. Resumen del producto

Plataforma de retos de ejercicio físico que convierte la constancia en una
experiencia de progresión tipo videojuego: reto → racha → XP → nivel → logro
→ competencia → comunidad → hábito. Home y Gym son un mismo ecosistema.

## 2. Usuarios objetivo

- Principiantes absolutos que quieren empezar sin intimidación.
- Personas que "vuelven" a entrenar tras una pausa.
- Usuarios de gimnasio que quieren gamificar su rutina y competir con amigos.
- Gimnasios (B2B) que buscan retención y comunidad para sus socios.

## 3. Casos de uso clave

- Completar el reto del día en casa sin conexión.
- Ver cuánto llevo, qué sigue, y no tener que recordar nada.
- Retomar el hábito tras una pausa sin sentirme castigado.
- Retar a un grupo de amigos a una racha de 30 días.
- Un gimnasio crea un reto del mes y ve el ranking de sus socios.

## 4. MVP (Fase 1, implementado en esta entrega)

Onboarding corto → perfil → reto del día adaptado → modo entrenamiento →
finalización con XP/racha → calendario visual → niveles → logros →
estadísticas básicas → todo persistido localmente (offline-first real).

## 5. Arquitectura

Cliente offline-first con cola de sincronización hacia un backend remoto.

```
UI (screens) → Store (estado + reglas) → LocalDB (persistencia)
                                   ↘ SyncQueue → API remota (Fase 2+)
```

Separación por capas: presentation / domain (ProgressionEngine,
SafetyEngine, XP/streak) / data (local + remoto) — igual en el prototipo
web que en la futura app nativa, para no reescribir lógica de negocio.

## 6. Stack recomendado

- **App real (recomendado):** React Native + Expo + TypeScript, SQLite local
  (expo-sqlite), backend Supabase (Postgres + Auth + Realtime + Storage).
- **Este prototipo:** HTML/CSS/JS vanilla + localStorage, para poder
  entregarte algo que corrés ahora mismo sin infraestructura, con la misma
  lógica de dominio (motor de progresión, XP, racha) que migraría 1:1 a RN.

## 7. Justificación del stack

Supabase sobre Firebase: Postgres relacional encaja mejor con el modelo
(retos, participantes, rankings, multi-tenancy por gimnasio con Row Level
Security nativo), auth + realtime incluidos, y el costo inicial es menor
que armar un backend a medida. Firebase queda como alternativa válida si se
prioriza velocidad de desarrollo sobre modelo relacional.

## 8. Modelo de datos

Ver `DATABASE.md` — incluye las ~40 entidades pedidas en la sección 32,
agrupadas por dominio (usuarios, ejercicios, retos, gamificación, social,
gimnasios, temporadas, monetización, sync).

## 9. Arquitectura offline-first

Toda escritura (completar entrenamiento, ganar XP, avanzar racha) se hace
primero contra el store local; nunca depende de la red para completarse.

## 10. Sincronización

Cola local (`sync_queue`) con estado por operación: `pending` → `syncing` →
`synced` / `error`, reintentos con backoff, resolución de conflictos por
timestamp + id idempotente para evitar duplicados.

## 11. ProgressionEngine

Módulo puro (sin UI) que, dado perfil + historial + rendimiento reportado,
devuelve el próximo objetivo (incremento / mantenimiento / reducción /
descanso). Implementado en el prototipo con progresión lineal configurable.

## 12. SafetyEngine

Reglas deterministas, no delegadas a IA: tope de incremento por sesión,
detección de inactividad prolongada → readaptación automática, nunca
autoriza carga extra solo por nivel alcanzado.

## 13. Gamificación

XP, niveles, racha (con descansos planificados que no la rompen), logros,
frase del día. Sin exploits: XP solo se otorga por eventos validados por el
propio engine, no por texto libre del usuario.

## 14. Home / Gym

Mismo perfil de usuario, mismo sistema de XP/nivel; el modo es una
preferencia, no una app distinta ni un muro Free/Premium.

## 15. Amigos

Modelo de datos listo (`friendships`); no implementado en la UI de esta
entrega (Fase 2).

## 16. Grupos

Modelo de datos listo (`groups`, `group_members`); Fase 2.

## 17. Retos Gym

Modelo de datos listo (`gyms`, `gym_challenges`); Fase 2/3.

## 18. QR

Los QR deben portar solo un identificador opaco (uuid), nunca datos
sensibles; se resuelven contra el backend. Preparado en `DATABASE.md`.

## 19. Temporadas

Entidad `seasons` + `season_participants`, alcance global/gym/grupo. Fase 3.

## 20. Rankings

Múltiples rankings (constancia, XP, progreso) para que la competencia no
dependa solo de fuerza bruta. Fase 3.

### 20.1 CameraVerificationEngine (anti-fraude para ranking)

Prototipo funcional entregado en `camera-verification.html` (visión por
computadora real, no simulada, corriendo en el propio dispositivo).

**Cómo funciona:** un modelo de pose estimation (MediaPipe Pose Landmarker,
liviano, on-device) ubica ~33 puntos del cuerpo por frame, cada uno con un
puntaje de confianza (`visibility`).

Hay dos perfiles de captura según el ejercicio:

- **Frontal (sentadilla):** la cámara ve de frente, se miden las dos
  piernas a la vez y se exige que ambas estén flexionadas/extendidas
  simultáneamente — evita el falso positivo de levantar una sola pierna
  sin agacharse.
- **Lateral (flexiones, abdominales):** en estos ejercicios la cámara solo
  puede filmar un costado del cuerpo (de perfil), así que exigir ambos
  lados no es viable. El sistema **detecta automáticamente qué lado está
  de cara a la cámara** comparando la confianza de visibilidad de los
  puntos izquierdos vs. derechos, con voto por mayoría en una ventana de
  frames para no titilar entre lados — el usuario no elige nada. En
  flexiones se suma un chequeo de alineación corporal (ángulo
  hombro-cadera-tobillo cercano a 180°) para invalidar el conteo si se
  levanta o hunde la cadera en vez de hacer el movimiento real.

En ambos perfiles, el conteo queda bloqueado hasta confirmar todos los
puntos requeridos durante varios frames seguidos; recién ahí una máquina
de estados mide la transición: abajo→arriba = 1 repetición válida. Si el
esqueleto (o el lado detectado) se pierde de cuadro, el conteo se pausa.

### Chequeo de postura real (no solo ángulo articular)

El caso reportado en pruebas: al terminar una serie de abdominales y
pararse para buscar el celular, el ángulo hombro-cadera-rodilla pasaba por
los mismos rangos que un abdominal real, y se contaban repeticiones falsas.
La causa: solo se validaba el ángulo de una articulación, nunca si el
cuerpo estaba realmente apoyado en el piso.

Solución implementada — **`groundedRatio`** (flexiones): se compara la
altura de la cadera contra la del tobillo, normalizada por el largo del
torso (hombro-cadera), para que sea independiente de la distancia a la
cámara. Estando en el piso, cadera y tobillo quedan a alturas similares. De
pie, la cadera queda muy por encima del tobillo — ese salto dispara el
bloqueo del conteo de inmediato.

En abdominales se detectó en pruebas que el tobillo se pierde de cuadro
muy seguido durante el movimiento (las rodillas lo tapan al subir, o
directamente no entra en el encuadre si la cámara está más cerca del
torso), bloqueando el conteo justo en el momento de completar la
repetición. Por eso ahí se usa **`kneeStandingMargin`** en su lugar: compara
la altura de la rodilla contra la cadera (mismo principio, normalizado por
torso) — la rodilla se mantiene visible durante todo el movimiento y de
todas formas ya es un punto requerido. Acostado o sentado con rodillas
flexionadas, la rodilla queda a la altura de la cadera o por encima; de
pie, la rodilla cae muy por debajo (largo del muslo) — esa diferencia
dispara el mismo bloqueo.

Aplica a flexiones y abdominales; en flexiones se combina además con el
chequeo de alineación de plancha (hombro-cadera-tobillo recto) para
descartar el "cheateo" de cadera arriba/hundida.

### Calibración por persona (no umbrales fijos universales)

Caso reportado en pruebas: la app funcionaba perfecto para un adulto pero
no contaba ninguna repetición de abdominales para un chico de 13 años,
pese a que la postura se veía correcta en pantalla. Causa raíz: los
umbrales de ángulo (110°/150°) eran valores fijos, calibrados a ojo con
proporciones de cuerpo adulto (torso vs. muslo). El ángulo hombro-
cadera-rodilla de una persona más pequeña, con otras proporciones, puede
simplemente no cruzar nunca esos números — aunque el movimiento sea
correcto y completo para su propio cuerpo.

Solución de fondo: en flexiones y abdominales, la app **ya no usa números
fijos** para decidir "abajo"/"arriba". En su lugar, calibra el ángulo de
reposo real de cada persona al arrancar la sesión — pide mantenerse quieta
en la posición correcta (acostado boca arriba, o brazos extendidos en
plancha) durante una ventana corta de frames (`CALIB_WINDOW`), confirma que
el ángulo se mantuvo estable (variación menor a `CALIB_RANGE_MAX` grados —
es decir, que realmente está quieta, no en medio de un movimiento), y
promedia esos frames como el ángulo de reposo (`restAngleCalibrated`) de
esa persona en particular. A partir de ahí, "abajo" y "arriba" se calculan
como una resta relativa a ese valor (`downDelta`/`upDelta` por ejercicio),
no como un número absoluto — así se adapta automáticamente a cualquier
tamaño o proporción de cuerpo, sin necesidad de configuración manual.

En abdominales, además, calibrar exige que el torso esté casi horizontal
(`torsoHorizontalAngle`, el ángulo de la línea hombro-cadera respecto a la
horizontal de la imagen) — esto es lo que evita calibrar por error mientras
la persona todavía está sentada: a diferencia del ángulo hombro-cadera-
rodilla, la orientación del torso respecto a la horizontal NO depende de
las proporciones del cuerpo, así que es un chequeo confiable para
cualquier edad o tamaño.

Sentadilla mantiene los umbrales fijos originales (100°/160°) por ahora,
ya que no se reportaron problemas ahí y cuenta con su propia protección
extra (exige las dos piernas simétricamente).

### Orientación del celular (evita el encuadre "desde arriba")

Trampa evidente que ninguno de los chequeos anteriores cerraba: acostarse
en el piso y dejar el celular apoyado plano en una repisa o el piso,
apuntando hacia abajo, simulando sentadillas o abdominales desde un ángulo
que no corresponde al ejercicio real.

Solución: se usa el sensor de orientación del propio dispositivo (el mismo
acelerómetro que usa la brújula) para exigir que el celular esté **parado en
vertical** — no acostado. El ángulo `beta`
(inclinación adelante-atrás del dispositivo) es ≈0° cuando está acostado
plano con la cámara apuntando derecho hacia abajo, y ≈90° cuando está
parado en vertical filmando horizontalmente. Se bloquea el conteo por
completo (con un aviso explícito en pantalla) si la desviación respecto a
90° supera el margen configurado (`VERTICAL_TOLERANCE`, 35°).

Lectura del sensor (**validado 2026-09-28**): dentro de la app, el WebView de
Expo Go **no entrega orientación sin un gesto del usuario**, así que la app lee
el sensor de forma nativa (`expo-sensors` `DeviceMotion`) y lo inyecta en la
WebView (`__resilienciaSetNativeOrientation`), replicado en el reto diario y en
Libre. Se conserva `deviceorientation`/`devicemotion` web como respaldo (fuera
de React Native, p. ej. el prototipo en el navegador, donde en iOS hace falta
`DeviceOrientationEvent.requestPermission()`).

**Obligatorio, no opcional.** Como esta app alimenta un ranking, no existe
una versión "de confianza sin verificar": si el sensor no está disponible,
el permiso se niega, o no llegan datos reales del sensor en la ventana de
confirmación (8 segundos, con un reintento automático), la sesión directamente
**no arranca** — se muestra un aviso explícito y se ofrece reintentar, en vez
de seguir sin el chequeo. Esto significa, a propósito, que el modo verificado
no funciona en una notebook con webcam (sin este sensor): es una
limitación aceptada a cambio de integridad del ranking, no un descuido.

Nota: el ángulo exacto y el margen de tolerancia son un punto de partida
razonable, no un valor definitivo — filmar en modo horizontal (landscape)
en vez de vertical (portrait) puede requerir ajustar esta lógica, ya que la
definición de `beta`/`gamma` depende de la orientación física del
dispositivo, no de a qué se aprieta en pantalla.

### Prueba de vida (anti-video pregrabado)

Ningún chequeo geométrico de los anteriores distingue una persona real
entrenando en vivo de alguien reproduciendo un video de sí mismo — o de
otra persona — frente a la cámara. Un video en loop puede tener la postura
perfecta, la orientación del celular perfecta, y pasar todos los filtros
anteriores sin problema.

Solución implementada: en un momento **aleatorio** de la sesión (entre 4 y
13 segundos después de que arranca, `LIVENESS_MIN_DELAY_MS`/
`LIVENESS_MAX_DELAY_MS`), la app interrumpe el conteo y pide una prueba de
vida, con un sonido propio (`playLivenessAlertSound` — tono senoidal grave,
completamente distinto a los beeps de conteo, para que se note de
inmediato que es un pedido especial). La clave del diseño en ambos casos
es que el momento es impredecible: un video pregrabado no puede
"reaccionar" a un pedido que no sabía que iba a llegar en ese instante
exacto.

El tipo de prueba depende del ejercicio (`cfg.livenessType`), porque
levantar una mano no siempre es viable:

- **Sentadilla y abdominales (`'hand'`)**: pide levantar una mano —
  factible parado o acostado boca arriba. Se confirma con la muñeca por
  encima del hombro (cualquiera de las dos, para no exigir un lado
  específico) sostenido durante varios frames seguidos
  (`LIVENESS_CONFIRM_FRAMES_NEEDED`).
- **Flexiones (`'hold'`)**: con las dos manos apoyadas en el piso, pedir
  levantar una no es viable. En su lugar pide **aguantar la posición de
  abajo un par de segundos seguidos** (`LIVENESS_HOLD_MS`, 2 segundos) —
  no exige soltar las manos del piso, y sigue exigiendo una reacción en
  tiempo real a un pedido con timing impredecible. Si sube antes de
  completar el tiempo, el conteo del aguante se reinicia.

### Voz (síntesis de voz del navegador — no es un asistente conversacional)

La app puede hablar avisos clave (`speak()`, usa la Web Speech API del
propio navegador, 100% local, sin conexión ni modelo de IA): que la
calibración quedó lista, el pedido de la prueba de vida, y su
confirmación. Es texto fijo elegido por reglas sobre datos que la app ya
mide — no entiende preguntas ni genera respuestas nuevas. Se apaga con el
mismo botón 🔊/🔇 que los beeps de conteo.

Esto es deliberadamente distinto de un asistente conversacional real (que
pueda responder preguntas abiertas, dar consejos personalizados charlando)
— eso requeriría conectar un modelo de lenguaje de verdad vía una API en
la nube (por ejemplo, la API de Claude), con conexión a internet y manejo
de una clave de API; no es algo que un modelo "compacto" corriendo
100% offline en el navegador pueda dar hoy con calidad conversacional
útil. Queda como una fase separada, a definir si se quiere sumar.

### Continuidad de la serie (anti-trampa por tiempo) + gancho para el entrenador con IA

Trampa que ningún chequeo anterior cerraba: arrancar la serie, irse, volver
al rato y terminarla — el conteo en sí sería válido rep por rep, pero no
es una serie hecha de corrido, y no debería contar igual para un ranking
competitivo que una serie continua.

Solución: se registra el timestamp de cada repetición
(`repTimestamps`). Un timer independiente del loop de cámara (corre cada 2
segundos, sin importar si hay body detection activa o no) compara el
tiempo transcurrido desde la última repetición contra
`MAX_GAP_BETWEEN_REPS_MS` (40s por defecto). Si se supera, la sesión queda
marcada `continuityBroken = true`: se avisa en pantalla y por voz, y la
tarjeta de resultado final la etiqueta explícitamente como "no apta para
ranking" — sin invalidar el conteo para seguimiento personal.

El mismo mecanismo de timestamps se aprovecha para un aviso de ritmo más
suave: si pasan más de `SLOW_PACE_WARN_MS` (18s) sin una repetición nueva
pero todavía no se llegó al límite de continuidad, se dispara un único
aviso de ánimo ("dale que podés"), sin repetirlo en loop.

**Esto es, a la vez, el punto de enganche real para el entrenador con IA**
descrito en `IA_ENTRENADOR.md`: `announceSessionStart()` (anuncia la meta
antes de arrancar) y `checkRepCheckpoints()` (avisa al 50%, al 80% y al
completar la meta) son los disparadores exactos que en la app nativa le
pasarían contexto (reps hechas, meta, ritmo) al modelo local en vez de
mostrar un mensaje de plantilla fijo como hace este prototipo — el
mecanismo de "cuándo avisar y con qué datos" ya queda resuelto acá, lo
único que cambia al integrar el LLM real es qué genera el texto.

Nota: `MAX_GAP_BETWEEN_REPS_MS` y `SLOW_PACE_WARN_MS` son puntos de
partida, no valores definitivos — el tiempo de descanso "normal" entre
repeticiones varía mucho según el ejercicio y el nivel de la persona,
conviene calibrarlos con uso real antes de aplicarlos como corte duro para
el ranking.

### Medidas adicionales — recomendadas para producción, no implementadas acá

Estas requieren backend, no se pueden resolver solo en el navegador con
este prototipo:

- **Reconocimiento facial contra la foto de perfil**: confirma que quien
  aparece en el video es efectivamente el dueño de la cuenta, no otra
  persona haciendo el ejercicio por encargo. Sensible en términos de
  privacidad — requeriría consentimiento explícito y separado.
- **Evidencia en video para auditoría por muestreo**: guardar un clip
  corto (o solo la secuencia de landmarks, más liviano y menos invasivo
  que el video crudo) de las sesiones que entran al ranking competitivo,
  para que una revisión humana por muestreo pueda confirmar casos
  sospechosos — ya mencionado en la sección de rankings (20.1).
- **Anti-abuso de cuentas/dispositivos**: rate-limiting y fingerprinting de
  dispositivo para evitar que una sola persona (o una "granja" de
  dispositivos) infle el ranking con múltiples cuentas falsas.
- **Consistencia de fondo**: comparar regiones del fondo (no del cuerpo)
  entre distintos momentos de la sesión — un cambio brusco puede indicar
  edición de video o que se cambió de persona/locación a mitad de la
  grabación.
- **Reloj de servidor**: validar que el timestamp de cada sesión viene del
  servidor, no del dispositivo del usuario, para que no se pueda simular
  una sesión "en el pasado".

El mensaje en pantalla ahora también muestra el ángulo en vivo junto a
"ABAJO"/"ARRIBA" (ej. "ABAJO (98°)") para poder diagnosticar a simple
vista si el umbral calibrado tiene sentido, sin herramientas de
desarrollador.

### Anti-ruido / anti-doble-conteo

Una repetición solo se confirma tras varios frames consecutivos con la
misma señal (no un solo frame ruidoso) y se exige un tiempo mínimo entre
repeticiones consecutivas (imposible completar una repetición humana real
por debajo de ese umbral) — esto evita que el jitter natural del modelo de
pose genere conteos dobles dentro de un mismo movimiento.

### Posición base antes de contar en sentadilla

Caso reportado en pruebas: al sentarse y recostarse para empezar una serie
de abdominales, ese movimiento de acomodarse ya pasaba por los mismos
rangos de ángulo que una repetición real, y se contaba una de más antes de
arrancar. Un primer intento (tomar como base la primera postura estable,
sea cual sea) no alcanzó: si el usuario arranca sentado, esa postura queda
como base "abajo", y al recostarse (transición a "arriba") ya cuenta como
si fuera una repetición completa. Este caso puntual quedó resuelto para
flexiones y abdominales con la calibración por persona de la sección
anterior (exige específicamente estar acostado/en plancha, con torso
horizontal, antes de calibrar).

Sentadilla, que sigue usando umbrales fijos, aplica una versión más simple
del mismo principio: la sesión no arranca a contar hasta confirmar
específicamente la posición de pie (`candidate === 'up'` con los umbrales
fijos 100°/160°) — no cualquier postura estable. Mientras no se detecta esa
posición, la pantalla no cuenta nada. Recién alcanzada la posición de pie
arranca la sesión, y la primera repetición se cuenta al completar el
primer ciclo completo desde ahí.

Nota: los umbrales numéricos de sentadilla (`downThresh`/`upThresh` fijos
en 100°/160°), y los de calibración (`downDelta`/`upDelta`,
`CALIB_RANGE_MAX`, `restTorsoMax`) de flexiones/abdominales, son puntos de
partida razonables, no valores definitivos — antes de producción conviene
ajustarlos con pruebas de usuarios de distintos tipos de cuerpo, edades,
ángulos de cámara y superficies.

**Por qué esto evita fraude, y qué no evita todavía:** cuenta reps reales
de un cuerpo humano en cámara, no de mover el teléfono. Lo que un MVP de
esto no resuelve solo (y que sí hay que sumar antes de production real):
suplantación con video pregrabado, otra persona haciendo el ejercicio,
o edición del clip. Por eso el diseño de producto separa:

- **Ranking libre**: cualquier sesión cuenta (conteo manual o local), como
  hoy en la Fase 1.
- **Ranking verificado**: solo sesiones grabadas con pose-tracking
  continuo, marcadas explícitamente, con auditoría por muestreo server-side
  (revisión aleatoria de un % de las sesiones top + detección de anomalías
  estadísticas: reps por segundo fuera de rango humano, patrones idénticos
  repetidos). Nunca se mezclan ambos rankings bajo la misma tabla.

**Recomendación para producción (app profesional real):** el prototipo usa
MediaPipe vía WASM en navegador para poder demostrarlo sin infraestructura.
Para la app nativa (React Native), la opción de mejor calidad/latencia es
correr el mismo modelo de forma nativa: **ML Kit Pose Detection** (Android/
iOS, Google, gratis, muy optimizado) o **MediaPipe Tasks para
Android/iOS nativo**, integrado vía un módulo nativo o
`react-native-vision-camera` + `vision-camera-plugins`. Esto da mejor FPS,
menor consumo de batería y funciona 100% offline (coherente con el
principio offline-first del resto de la app) — la nube solo entra para la
auditoría por muestreo de sesiones del ranking, no para el conteo en sí.

## 21. Monetización B2C

Free vs Premium — Premium nunca bloquea el ecosistema Gym (regla explícita
de producto), solo desbloquea límites, estadísticas avanzadas y
personalización.

## 22. Monetización B2B

Gym Free / Gym Pro / Gym Enterprise por suscripción, ingreso independiente
de la publicidad.

## 23. Publicidad Gym

"Gym Promotion" como motor de ingresos aparte: paga por visibilidad
(destacados, retos patrocinados, rankings patrocinados), nunca por alterar
resultados — regla dura de producto.

## 24. Retos patrocinados

Etiquetado explícito "Presentado por [Gym]"; nunca oculto.

## 25. Seguridad

Auth + roles (USER, GYM_MEMBER, GYM_ADMIN, PLATFORM_ADMIN) + validación de
XP/Premium/ranking siempre en backend, nunca confiando en el cliente.

## 26. Privacidad

Perfil público/privado configurable; datos médicos nunca solicitados ni
almacenados; la app no reemplaza consejo profesional.

## 27. Analytics

Eventos clave: onboarding completo, primer reto, primer entrenamiento,
racha, conversión Premium, conversión de gimnasios — agregados, no
invasivos.

## 28. Testing

Unit: ProgressionEngine, SafetyEngine, XP, streak. Integration: auth,
retos, sync. E2E: onboarding → reto → entrenamiento → XP → calendario, y
offline → reconexión → sincronización.

## 29. Roadmap

Ver `ROADMAP.md` (Fases 1 a 5, igual a la sección 98 del prompt).

## 30. Riesgos

- Complejidad de sincronización offline con conflictos multi-dispositivo.
- Balance de gamificación vs. seguridad (sobreentrenamiento).
- Adopción B2B: onboarding de gimnasios requiere ventas, no solo producto.
- Dependencia de contenido visual de ejercicios con licencia propia.

## 31. Costos aproximados (orden de magnitud, a validar)

Supabase (tier gratuito hasta cientos de usuarios, luego ~25-100 USD/mes),
push notifications (gratis vía Expo), hosting mínimo. Costo real depende de
volumen — no fijar precios sin investigación de mercado (sección 100).

## 32. Estrategia de lanzamiento

Lanzar Fase 1 (Home puro) para validar retención del loop core antes de
invertir en Gym/B2B. Reclutar 1-2 gimnasios piloto para Fase 3.

## 33. Diferenciación

Retos progresivos + historia personal + racha saludable (no punitiva) +
ecosistema Gym real (no una app aparte) + competencia justa + modelo B2B
que paga por visibilidad, no por resultados.

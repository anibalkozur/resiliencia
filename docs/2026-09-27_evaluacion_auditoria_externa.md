# Evaluación de la auditoría externa — informe del equipo

- **Fecha**: 2026-09-27
- **Fuente evaluada**: auditoría externa sobre `C:\Users\Anibal\Dev\resiliencia` (12 hallazgos + 1 de arquitectura + 8 recomendaciones).
- **Equipo convocado**: PM, DER, MOB, UX, BE, CV, SRE, QA, SEC, WEB, DATA, GRO, ASO, SAL, CSC, LEG, FIN, MED.
- **Método**: cada hallazgo se verificó contra el código real (`archivo:linea`). Veredictos: **REAL** / **REAL con matiz** / **FALSA**.

---

## 1. Veredicto resumido

| #   | Hallazgo de la auditoría                                                                                  | Veredicto                      | Severidad     | Dueño         |
| --- | --------------------------------------------------------------------------------------------------------- | ------------------------------ | ------------- | ------------- |
| 1   | El ranking se puede falsificar (cliente inserta `value`/`ranked`/`series_ok`)                             | **REAL**                       | Crítica       | BE + SEC      |
| 2   | El reset no reinicia el ranking (no borra `workout_sessions` ni `libre:sessions`)                         | **REAL**                       | Alta          | MOB + BE      |
| 3   | Carrera `markCompleted` / `syncAfterLogin` al completar un reto                                           | **REAL**                       | Media         | MOB           |
| 4   | `uploadSessions` sin idempotencia (duplicados) + reconstrucción histórica con prefs actuales              | **REAL**                       | Media         | MOB + BE      |
| 5   | Sesiones libres no se suben al instante                                                                   | **REAL**                       | Media-Baja    | MOB           |
| 6   | La app no es realmente offline (guard de sesión + cámara 100% en línea)                                   | **REAL (desvío de idea)**      | Alta (visión) | MOB + CV + PM |
| 7   | Configuración nativa de cámara incompleta (`expo-camera` muerta, sin permisos, sin `onPermissionRequest`) | **REAL**                       | Alta (build)  | MOB           |
| 8   | Sincronización histórica usa el objetivo actual                                                           | **REAL**                       | Media         | MOB           |
| 9   | Inconsistencias de fecha (UTC vs local)                                                                   | **REAL (+ matiz)**             | Media         | MOB           |
| 10  | `JSON.parse` sin protección                                                                               | **REAL (4-5 sitios)**          | Media         | MOB + QA      |
| 11  | Contador de progreso limitado a 365 días                                                                  | **REAL (+ inconsistencia UI)** | Baja          | MOB + DATA    |
| 12  | Error visual "total/total" en checklist de cámara                                                         | **REAL (regresión)**           | Baja (UX)     | CV + UX       |
| 13  | `Linking.openURL` sin await/catch + `signOut` no esperado                                                 | **REAL**                       | Media         | MOB           |
| 14  | Arquitectura: `@resiliencia/domain` muerto / duplicación                                                  | **REAL (desvío)**              | Alta          | PM + MOB      |

**Ninguna afirmación central resultó falsa.** Dos puntos de la auditoría tienen imprecisiones de detalle (attribuir columnas a 0001 y "borra o pending" del reset: la app ni siquiera borra, hace UPDATE), pero refuerzan en vez de debilitar el hallazgo. El auditor es correcto y, en varios casos, **conservador**: le faltaron hallazgos que encontramos nosotros (sección 4).

---

## 2. Análisis por hallazgo

### 1 — Ranking falsificable (CRÍTICA) — BE + SEC

**Verdict: REAL.** Las columnas del ranking (`exercise_code`, `value`, `target`, `ranked`, `series_ok`) las agrega `0008` y las escribe el cliente por `.insert()` directo (`syncService.ts:132`). Las políticas RLS solo exigen `auth.uid() = user_id` (`0001:108-115`), sin validar nada. `get_reps_ranking` y `get_total_reps_ranking` hacen `max(ws.value)` / `sum(ws.value)` con los 4 flags declarados por el cliente (`0008:49-64`, `84-95`). **No existe trigger, ni `validate_workout`, ni función que recompute.**

Lo grave: es una **violación de nuestra propia regla de oro #2** — "El ranking verificado se calcula en el servidor, nunca en el cliente" (`PLAN_COMPLETO.md:21-23`, `DATABASE.md:84-86`, `PRODUCT_SPEC.md:465`). El plan manda `validate_workout` como **gate previo** a exponer el ranking (`PLAN_COMPLETO.md:1310-1311`); 0008 expuso el leaderboard sin ese gate. Es un desvío de nuestra idea, no un error aislado.

La auditoría también detectó que `qualified` (camera-verification.html:1847) no exige `livenessPassed`. Nosotros encontramos **3 bypass y un vacío mayor** (sección 4.1): en modo segundos `postComplete` califica sin ningún check, y en modo no-ranked el HTML dice "apto para ranking"; el payload ni siquiera transporta `liveness_ok`.

### 2 — El reset no resetea el ranking — MOB + BE

**Verdict: REAL.** `resetLocalProgress` borra solo `completed:` y `reto:` (`reset.ts:7`); la clave `libre:sessions` **sobrevive** y se re-sube en el próximo login re-creando filas. `resetCloudProgress` hace UPDATE `status='pending'` sobre `daily_challenges` (`reset.ts:14-17`) — ni usa la política DELETE de 0007 (código muerto). `workout_sessions` (lo que alimenta el ranking 0008) **nunca se toca**. Y el copy de UI promete "se borrará tu lugar en el ranking" (`translations.ts:173-178`). El propio `0007` quedó obsoleto: su comentario dice "el ranking se recalcula solo con get_ranking" — falso desde que existe 0008.

### 3 — Carrera al completar reto — MOB

**Verdict: REAL.** `retos.tsx:85-89` dispara `void markCompleted(...)` y `void syncAfterLogin(...)` en el mismo tick. `markCompleted` escribe async en SQLite; `uploadCompletions` puede leer antes del commit → el reto no se sube hasta un próximo login. Fix trivial: `await` de `markCompleted` antes del sync.

### 4 — Sincronización no idempotente — MOB + BE

**Verdict: REAL (los 3 sub-puntos).** `uploadSessions` usa `.insert()` plano (sin `onConflict`, sin id cliente) mientras `uploadCompletions` sí es idempotente (`syncService.ts:97-99`). Hay 2+ caminos que disparan `syncAfterLogin` en paralelo (`AuthProvider.tsx:92-96` y `108-110`, `retos.tsx:88`) y un crash entre insert y `clearFreeSessions` (línea 179-180) → duplicados que inflan `total_value`. La reconstrucción histórica usa `buildChallenge(date, prefs.goal)` con el objetivo **vigente**, ignorando el `reto:<fecha>` persistido (`syncService.ts:73`, `78`, `89`).

### 5 — Sessions libres sin sincronización inmediata — MOB

**Verdict: REAL.** `camretos.tsx:60-67` solo hace `pushFreeSession` (local) y `.catch(()=>{})` traga errores. Nada llama `syncAfterLogin` al terminar. El ranking puede quedar desactualizado hasta re-login. Además guarda incluso sesiones `ranked=false` y no-aptas (ver 4.1), que se suben igual.

### 6 — No es realmente offline — MOB + CV + PM

**Verdict: REAL, y es un desvío de idea.** Nuestra idea: "offline-first real" (`PRODUCT_SPEC.md:24,34,38,71`), reto del día "sin conexión" y cámara "100% offline con ML Kit" (`PLAN_COMPLETO.md:127`). Realidad actual: sin sesión de Supabase todo queda en auth (`_layout.tsx:22-27`; existen strings `onboarding.go_local` muertos en los 3 idiomas) y la cámara depende de 4 recursos externos (gh-pages, CDN MediaPipe, WASM, modelo .task de 5 MB). Es un desvío parcial de fase (el plan ubica ML Kit en Fase 3), no un error de hoy: la app "local-first" sí funciona con sesión y sin tocar la nube para el reto diario. La recomendación del auditor ("opción usar sin cuenta") coincide con nuestro propio roadmap.

### 7 — Cámara: configuración nativa incompleta — MOB

**Verdict: REAL.** `expo-camera` y `@mediapipe/tasks-vision` instalados pero sin uso (cero imports). `app.json` sin `NSCameraUsageDescription`, sin `android.permissions`, sin plugin `expo-camera`. El `<WebView>` no tiene `onPermissionRequest` (ni en `camretos.tsx` ni en `retos.tsx` → en build real de Android la cámara puede fallar; en Expo Go funciona porque su WebView la autoriza). `originWhitelist={['*']}` amplía el radio de navegación del WebView. Alta prioridad para un APK real.

### 8 — Sincronización histórica con objetivo actual — MOB

_Ver #4._ Real. Afecta el registro histórico de `daily_challenges` en la nube (el reto subido no es el que se hizo).

### 9 — Inconsistencias de fecha — MOB

**Verdict: REAL con matiz.** `camretos.tsx:61` usa `toISOString()` (UTC) — después de las **21:00 en Argentina** una sesión libre queda fechada al día siguiente. El resto de la app usa fecha local (`service.ts:7-12`, `streak.ts:3-8`, `progreso.tsx:55`). Matiz (que la auditoría no aclaró): los rankings de reps **no filtran por fecha** (`0008:54-61`, `85-92`), así que el bug no corrompe el ranking, solo la etiqueta del histórico. `packages/domain/dates.ts` (UTC) es código muerto para la app (cero imports).

### 10 — JSON.parse sin protección — MOB + QA

**Verdict: REAL.** Sin try/catch en `prefs/service.ts:43`, `sqliteRepo.ts:29`, `retos/service.ts:61`, `retos.tsx:80`, `camretos.tsx:39`. Solo `freeSessions.ts:19-24` está protegido. Un valor corrupto en `reto:<fecha>` deja la pantalla de retos en blanco (`retos.tsx:59` sin try/catch).

### 11 — Contador 365 días — MOB + DATA

**Verdict: REAL (+ inconsistencia entre pantallas).** `getStreak`/`getBestStreak`/`getCompletedCount` recorren exactamente 365 días (`streak.ts:13,34,54`). Pero `Progreso` usa `getTotalCompleted` (histórico, `completions.ts:22`) y Home usa el de 365 (`index.tsx:34`). Tras un año, Home se congela en ~365 mientras Progreso sigue creciendo; y `getBestStreak` subestima vs el leaderboard remoto (0004 calcula sin límite).

### 12 — Error visual "total/total" — CV + UX

**Verdict: REAL (regresión).** `renderChecklist` pinta `pts.length/pts.length` (`camera-verification.html:845`), ignorando `missing` (que sí pinta puntos rojos). El prototipo original lo hacía bien (`docs/prototipo/camera-verification.html:1399` → `required.length - missing.length`). El fix se perdió al promover el HTML. Contradicción visible: "Cuerpo 8/8" al lado de "Falta ver: rodilla izquierda".

### 13 — Google sign-in / signOut — MOB

**Verdict: REAL.** `googleSignIn.ts:107` → `Linking.openURL(data.url!)` sin `await`/`.catch`: si no puede abrir la URL, el `new Promise` cuelga (botón spin) y hay **fuga de listeners** (`cleanup()` nunca se llama en ese camino). `AuthProvider.tsx:180-184` hace `setSession(null)` antes de `void startLogout()`; mitigado para re-login por `drainLogout` (con await en signIn/signUp/google), pero el error de logout se traga y **no hay tests del AuthProvider**.

### 14 — `@resiliencia/domain` muerto + duplicación — PM + MOB

**Verdict: REAL (desvío).** Cero imports de `@resiliencia/domain` en la app (solo `design-tokens`). 8 módulos del dominio (229 LOC, 35 tests que corren en CI) protegen código que la app nunca ejecuta; la app re-implementa racha/reto/fechas con lógica distinta (racha O(365) con ~1095 awaits por llamada; 5 copias del formateador de fecha; `Goal` con taxonomía incompatible). La decisión "package sin tocar la app" fue documentada, pero la fase de integración (PLAN 1.8) nunca se hizo → hoy es drift. Bonus: `nextChallenge()` **muta** `state.hadComeback` (`progression.ts:24,28`) — un getter con side-effect irreparable consagrado en 4 tests; desbloquea el logro "Volviste" por previsualizar, no por entrenar.

---

## 3. Desvíos respecto de NUESTRA idea (no solo bugs)

| Nuestra idea (docs)                                                                                         | Realidad hoy                                                       | ¿Desvío?                                                            |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------- |
| Regla de oro #2: "el ranking se calcula en el servidor, **nunca** en el cliente" (`PLAN_COMPLETO.md:21-23`) | Ranking decide el cliente (`value/ranked/series_ok` viajan libres) | **SÍ — falta implementar el gate de validación (validate_workout)** |
| `validate_workout` **antes** de exponer el ranking (`PLAN_COMPLETO.md:1310`)                                | 0008 expuso leaderboards sin él                                    | **SÍ**                                                              |
| "Operar sin conexión" y "reto del día sin conexión" (`PRODUCT_SPEC.md:24,34,38`)                            | Sin sesión → no hay app; cámara 100% online (WASM+CDN)             | **SÍ (parcial de fase)** — ML Kit offline era Fase 3                |
| "Cámara 100% offline con ML Kit Pose" (`PLAN_COMPLETO.md:127`)                                              | WebView + pose WASM en línea                                       | **SÍ (diferido)**                                                   |
| Timeline de fases: "el ranking no se expone hasta Fase 3.6/7"                                               | Ranking de reps ya en el aire                                      | **SÍ (adelantado)**                                                 |
| `sync_queue` con idempotencia `client_op_id` (`PLAN_COMPLETO.md:1003`)                                      | Insert sin idempotencia                                            | **SÍ**                                                              |
| Sincronización offline → reconnect → cola (`PRODUCT_SPEC.md:482`, `DATABASE.md:85`)                         | Reto completado puede no subirse en el momento (carrera)           | **SÍ (efecto)**                                                     |

Conclusión de DER/PM: **la auditoría no contradice la idea; confirma que estamos adelantando entregables de Fase 3 sin el spine de validación.** El ajuste no es "rehacer", es **poner el gate donde el plan ya lo pedía** y desactivar/etiquetar el ranking hasta entonces.

---

## 4. Hallazgos que la auditoría NO encontró (nuestro valor agregado)

1. **Liveness decorativa en el ranking (CV+SEC, crítico)** — además de no exigirse en `qualified` (1847), hay **3 bypass**: (A) `livenessEnabled = … rejas targetVal > 5` (`camera-verification.html:737`) con objetivo mínimo **1 rep** en la app (`camretos.tsx:33`); (B) en modo segundos `postComplete` (1133-1135) califica **sin ningún check** de gesture/series/liveness; (C) modo no-ranked afirma "apto para ranking" (`:1853`) mientras la app muestra "completado" sin veredicto. Y el **payload no transporta `liveness_ok`** (`completePayload:1109-1119`) → imposible auditar server-side. El billing plan futuro exige `liveness_ok` (`PLAN_COMPLETO.md:186`).
2. **Las sesiones no-aptas también se suben** — `pushFreeSession`/`uploadFreeSessions` persisten filas con `ranked=false` o `series_ok=false`; no dañan el ranking pero enturbian `workout_sessions`. El gate real solo existe como texto de UI.
3. **Asimetría 0008**: `get_reps_ranking` no filtra `measurement_type` (mezcla plancha/segundos en "reps") mientras `get_total_reps_ranking` sí (`0008:57` vs `88`). Índice parcial desalineado con el filtro (`0008:27-29` vs `:59-61`).
4. **`add column if not exists`** en 0008 vuelve la migración silenciosamente no-op si ya existían columnas — sin verificación de que "aplicar 0008" realmente tomó efecto.
5. **El catch del reset miente**: si el reset remoto falla, muestra "Sin sesión: solo se reinició este dispositivo" aunque sí había sesión (`ajustes.tsx:65`).
6. **Los "69 tests de dominio" no existen**: el conteo real es **35** (`docs/equipo/estado.md` y `BITACORA.md` repiten 69 en 8 lugares). Contra nuestro mantra "cero simulación", la doc quedó inflada.
7. **Logro "comeback" se desbloquea por leer** (ver #14, `nextChallenge` muta `hadComeback`).
8. **`streak` O(365)** hace hasta ~1095 lecturas por llamada — costo local innecesario.

---

## 5. Recomendaciones del equipo (orden sugerido, sin invertir dinero)

**Bloque A — Integridad del ranking (cambio de decisión de producto, no solo código):**

1. **Frenar el ranking público "confiado"**: hasta implementar validación server-side, o (a) no desplegar 0008, o (b) mostrarlo como ranking informal/"verificado en el dispositivo". Recomendación del equipo: **etiquetarlo** (opción b) para no perder la feature y sí ganar tiempo — decisión del PO.
2. Diseñar el gate **en SQL/Edge**: `recordWorkout` que valide plausibilidad (value máx por ejercicio, series cadencia, liveness_ok, reloj de servidor) y solo ahí publique el ranking. Es lo que ya dice PLAN_COMPLETO 3.6/3.7.

**Bloque B — Correcto y barato (días), en este orden:** 3. `qualified` exige `livenessPassed` (y `gestureStarted`) **y** que el payload lleve `liveness_ok`; cerrar los 3 bypass; modo segundos no califica sin checks. (+ CV/SEC) 4. Reset completo: borrar `libre:sessions` local y `workout_sessions` en la nube (RPC `reset_own_progress` con owner check), corregir copy y el catch engañoso. (+ MOB/BE/UX) 5. Idempotencia de `uploadSessions` (`client_op_id` único + ÚNICO) y `await markCompleted` antes del sync. (+ MOB/BE) 6. Subir la sesión libre al instante (sync tras `pushFreeSession`). (+ MOB) — rápido y mejora la demo. 7. Checklist de cámara: numerador correcto. (+ CV — 1 línea) 8. `env` de fechas local único (`dateKeyLocal`) en toda la app. (+ MOB) 9. `JSON.parse` seguro en los 5 sitios. (+ MOB/QA) 10. `onPermissionRequest` en el WebView + permisos en `app.json` (probar APK real). (+ MOB — imprescindible antes de cualquier build)

**Bloque C — Arquitectura (mediano plazo):** 11. Decidir: integrar `@resiliencia/domain` en la app **o** retirarlo del workspace (auditoría plantea lo mismo). El equipo recomienda **integrar de a poco** (empezando por streak/dates) porque es la fuente de verdad del plan (regla "cero simulación" + Fase 1.8 pendiente). (+ PM/MOB) 12. `nextChallenge()` puro (devolver el flag; sin mutar). (+ dominio) 13. Modo "usar sin cuenta" (strings `go_local` ya existen) + cachear HTML/modelo para cámara offline — alineado con PRODUCT_SPEC. (+ PM/MOB/CV — alcance a definir) 14. Corregir el conteo de tests en la doc (35, no 69). (+ PM/QA — disciplina, no feature)

**Bloque D — Nada que hacer ahora:**

- 365 días: no urgente (esa UI ya mezcla histórico); corregir cuando se toque Progreso.
- `signOut` sin await: aceptable como patrón (drenaje ya cubre re-login); agregar tests.

---

## 6. Conclusiones de los roles

- **DER**: la auditoría es de buena calidad, irreprochable en lo central; no ataca la idea, señala que **la feature estrella (ranking) se lanzó sin el spine anti-fraude del propio plan**. El riesgo #1 no es técnico, es de confianza del producto.
- **PM**: el orden importa: primero la **decisión** (frenar/etiquetar ranking) y el Bloque A; después los fixes de días. La app está sana (137+35 tests reales, CI ok, lint ok); el problema está en la frontera cliente/servidor, no en la estructura.
- **SEC**: con un leaderboard público, cada fila `workout_sessions` es un vector de fraude de bajo costo. "El cliente propone" es aceptable; "el cliente declara el veredicto" no lo es.
- **BE**: 0008 y 0007 quedaron obsoletos frente al plan; hay que versionar 0009 (gate) y corregir 0007. Riesgo latente: 0008 no aplicada aún → oportunidad de hacerla bien antes de aplicar.
- **QA**: la regresión del checklist (8/8) demuestra que el test grid de cámara manual no está cubriendo el HUD; sumar casos. El "69 tests" inflado viola nuestro principio.
- **MOB**: los fixes de sync/reset son baratos y dan robustez inmediata; la cámara en build real es el riesgo que más urge (onPermissionRequest + permisos).
- **CV**: la liveness necesita ser **condición de ranking**, no decoración; hoy hay 3 caminos para saltarla. Mientras el payload no lleve `liveness_ok`, no hay nada que auditar.
- **UX**: dos contradicciones visibles para el usuario: "8/8" con puntos faltantes y el reset que dice "se borra tu ranking" y no lo hace. Son credibilidad.
- **SRE**: nada de costos; el señalamiento del entorno (EPERM en Windows) es ambiental, no de código.
- **FIN/LEG**: sin relevancia directa; LEG nota que prometer "offline" o "ranking verificado" en la ficha de la tienda siendo falsable expone a reclamos.
- **GRO/ASO/SAL/CSC**: un ranking trampeable mata la comunidad: los líderes legítimos se van. Etiquetar "verificado en el dispositivo" degrada el diferencial; mejor que romper la promesa.
- **DATA/MED**: datos plausibles y honestos primero (las sesiones subidas hoy son la base de los futuros dashboards; data viciada = análisis viciado).

**Veredicto global**: 14/14 hallazgos confirmados (con matices que refuerzan). **La auditoría es correcta y útil.** El costo de corregir es bajo en código y nulo en dinero. La decisión que sí necesita al PO: **qué hacemos con el ranking mientras no exista validación server-side** (etiquetar vs congelar), y el **alcance del modo sin cuenta/offline** (Fase 1 vs Fase 3).

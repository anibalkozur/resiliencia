# Bitácora de ResiliencIA

Registro de peticiones del cliente (PO) y cambios aplicados. Se actualiza a medida que se planifica y desarrolla cada fase.

## Historial

### 2026-09-17 — Fase 1: sesión, logout y login persistente

**Peticiones del PO (vía app/chat):**

1. Agregar botón de **logout** en la app (manifestó que no lo encontraba).
2. La sesión debe **persistir entre reinicios**: al volver a abrir la app, entrar directamente (sin repetir "Continuar con Google"), como cualquier app de Play Store.
3. Registrar los pasos y peticiones que se van aplicando (esta bitácora).

**Análisis y hallazgos:**

- El logout **ya existía** en el tab Ajustes (`settings.logout` → `signOut()`), poco visible.
- La sesión ya se persistía en SQLite (storage adapter de supabase-js sobre `app_settings`) y se recuperaba con `getSession()` en el montaje de `AuthProvider`.
- **Causa de la "no persistencia" percibida (review equipo DER #1):** `authLoading` se inicializaba en `false`, así que en cada arranque se montaba brevemente `onboarding` (flash de "Continuar con Google") hasta que resolvía `getSession()`. El usuario interpretaba ese flash como "perdí la sesión".

**Cambios aplicados:**

- `apps/mobile/app/(tabs)/perfil.tsx`: botón "CERRAR SESIÓN" agregado (reutiliza `settings.logout`/`settings.account`, paridad es/en/pt intacta).
- `apps/mobile/src/auth/AuthProvider.tsx`:
  - `authLoading` inicial en `true` → desaparece el flash de onboarding al reabrir; entra directo si hay sesión persistida.
  - `getSession()` con manejador de error (`.catch`/segundo handler) para no quedar en spinner infinito si falla el storage.
  - `signOut`: limpia `session` **antes** del llamado al servidor (UI responde al instante, el cierre real sigue de fondo) y loguea fallos con `console.warn`.
- `apps/mobile/src/auth/webcryptoPolyfill.ts`: `defineProperty('subtle')` envuelto en try/catch (host object no-configurable en Hermes no debe romper el arranque).

**Fix post-test (2026-09-17): logout no cerraba sesión (2 intentos)**

- Síntoma: al tocar "CERRAR SESIÓN" la app seguía abierta con los datos; no redirigía a la pantalla de bienvenida/login.
- Causa raíz (tras revisar GoTrueClient.js instalado): el login entraba a `(tabs)` con un `router.replace('/(tabs)')` explícito (onboarding.tsx), pero el logout dependía solo del `<Stack>` condicional de expo-router, que **no fuerza la navegación** al quitar `(tabs)` → la pantalla no cambiaba.
- Fix definitivo:
  - `app/_layout.tsx`: navegación simétrica vía `useEffect` + `router.replace` — con sesión → `/(tabs)`; sin sesión → `/onboarding` (solo navega cuando cambia el estado, con ref para evitar loops por refresco de token). Se mantiene el remonte con `key`.
  - `src/auth/authService.ts`: `signOut()` limpia las claves de sesión locales (`sb-<ref>-auth-token`, `-user`, verifiers PKCE) **inmediatamente**, sin esperar la red (que podía colgar en `admin.signOut` antes de limpiar storage). La revocación remota sigue en background.
- Tests actualizados + 118 en verde.

**Pendientes / decisiones:**

- Sesión _stale_ sin red con token expirado (recomendación DER #2): diferido — la app es online-estricto en Fase 1; no se abre sin conexión.
- Flush de autosave al hacer logout (recomendación DER #4b): riesgo bajo (ventana de 400 ms); se evalúa si aparece como bug.

### 2026-09-18 — Fix definitivo logout: rediseño a `Stack.Protected` (auditoría de equipo)

**Síntoma:** cerrar sesión desde Perfil hacía que la app saliera por completo o blank (3er reporte de logout).

**Auditoría del equipo (DER #2, revisión de expo-router 57.0.19 instalado):**

- Causa raíz: combo en `app/_layout.tsx` de `key={...}` (desmontaba el Stack vivo) + `useEffect` con `router.replace` simultáneo + pantallas `(auth)/login|signup` registradas siempre y grupo `(auth)` sin `_layout` → la acción `REPLACE` se emitía sobre un navigator recién remontado y fallaba → pantalla en blanco/cierre.
- Recomendación: patrón canónico **`Stack.Protected`** con grupos `(tabs)`/`(auth)`, mover `onboarding` al grupo `(auth)`, eliminar workarounds (key + effect + `router.replace` manuales).

**Cambios aplicados:**

- `app/(auth)/onboarding.tsx` (movido desde `app/onboarding.tsx`): sin `router.replace('/(tabs)')` tras el login (los guards navegan solos); rutas `/(auth)/signup` y `/(auth)/login`.
- `app/(auth)/_layout.tsx` (nuevo): `<Stack initialRouteName="onboarding">`.
- `app/_layout.tsx` (reescrito): `Stack.Protected guard={session != null}` → `(tabs)`; `guard={session == null}` → `(auth)`. Eliminados `key` y el effect con `router.replace`. Mismo spinner de `authLoading`.
- `login.tsx`/`signup.tsx`: quitados `router.replace('/(tabs)')` post-éxito; botón "volver" con `router.canGoBack() ? back() : replace('/onboarding')` (sin navegación ciega).
- `ajustes.tsx`: eliminada rama anónima inalcanzable (con guards, dentro de tabs siempre hay sesión); quitado import de `router`.
- `index.tsx`: `router.push('/(tabs)/retos')` (ruta explícita del grupo).
- Limpieza robusta de sesión: `IRepo.listKeys()` (+ `MemoryRepo`, `SqliteRepo`) y `authService.clearLocalSession()` ahora borra **todas** las claves `sb-*` por prefijo, sin depender del ref del proyecto.
- Tests: `repo.test.ts` +test `listKeys`; `authService.test.ts` actualizado a signOut async. **119 mobile en verde** (10 suites), typecheck y lint OK.

**Verificación pendiente (PO, en Expo Go — recargar la app completa):**

1. Cerrar sesión desde Perfil → volver a la pantalla "Continuar con Google" (sin crash ni blank).
2. Re-login con Google → entrar a tabs.
3. Cerrar y reabrir la app → seguir con la sesión.

### 2026-09-18 — Auditoría de librerías instaladas: logout/relogin "Algo salió mal" (reporte 4 del PO)

**Síntoma reportado:** al cerrar sesión desde Perfil **o** Ajustes la app sale a la pantalla de bienvenida; al querer reingresar muestra "Algo salió mal. Reintentá."; reintentando 2-3 veces entra.

**Investigación (equipo, sobre los paquetes instalados, no docs):**

- `@supabase/auth-js@2.116.0` (GoTrueClient.js/helpers.js): el flujo PKCE guarda el code verifier en **storage** (una clave por flujo `-flow-<id>-code-verifier` + una clave compartida `-flows-code-verifier`/`-code-verifier` limitada a 5). `exchangeCodeForSession(code)` sin `flowId` lee la clave compartida, frágil ante cualquier `removeAllPKCEVerifiers`.
- **Anti-patrón aplicado antes:** `clearLocalSession()` borraba TODAS las `sb-*` **antes** de `client.auth.signOut()`. Al no haber sesión en storage, el signOut **omite la revocación del servidor** y deja mecanismos que pueden borrar el verifier PKCE recién creado del re-login → `AuthPKCECodeVerifierMissingError` → mapeado a `'unknown'` ("Algo salió mal"). Reintentos crean flujos nuevos → entran.
- expo-router 57.0.19: `Stack.Protected` con grupos `(tabs)`/`(auth)` es el mecanismo oficial (uso verificado en `Protected.js`/`useScreens.js`/`StackRouter.js`); sin rutas ciegas tras logout; errores JS muestran red box, no cierran la app. Fix del crash `#47968` ya incluido en este build.

**Cambios aplicados:**

- `authService.signOut()`: ahora usa el cierre canónico **`await client.auth.signOut({ scope: 'local' })`** (revoca + hace teardown local de sesión y de TODOS los verifiers PKCE incluso offline — verificado en `_signOut` de GoTrueClient 2.116) y **después** barre claves `sb-*` residuales como red de seguridad. Se elimina el borrado manual previo que rompía el re-login.
- `googleSignIn.ts`: `exchangeCodeForSession(code, { flowId: data.flowId })` (verifier por flujo, inmune a la clave compartida); logs `[auth]` con `code`+`message` en cada fallo para diagnóstico real.
- `AuthProvider.tsx`: `restoreServerProfile` envuelto en try/catch (evita rejection no manejado que podía colgar/caer en Hermes) y `signOut` con `void` + catch.
- Tests: 119 mobile en verde; typecheck y lint OK.

### 2026-09-18 — Bug raíz del SHA-256: polyfill `subtle.digest` devolvía bytes incorrectos (reporte 7)

**Causa raíz real (verificada con log `bad_code_verifier`):** `expo-crypto`'s `digest()` retornaba un `ArrayBuffer` con bytes incorrectos en Android/Expo Go (Path B: `ExpoCrypto.digest(algorithm, output, data)` escribía en `output` pero el resultado era inconsistente). El polyfill `webcryptoPolyfill.ts` usaba `digest()` directamente. El `code_challenge` enviado al servidor Supabase era SHA-256 del verifier con bytes WRONG. El servidor recomputaba SHA-256 con Node.js y comparaba → no coincidía → `bad_code_verifier`.

**Fix aplicado (`webcryptoPolyfill.ts`):** cambié el polyfill para usar `digestStringAsync()` que retorna un string hex verificado, y lo convierto a `ArrayBuffer` con `hexToArrayBuffer()`. Esto elimina la dependencia del `ArrayBuffer` directo de `expo-crypto` y usa la ruta documentada (`digestStringAsync`) que funciona correctamente en Android.

Los logs del PO ahora deberían mostrar `[auth] exchangeCodeForSession` sin error.

**Acción si reaparece "Algo salió mal":** los logs `[auth] ...` del cierre/reingreso ahora quedan en Metro (`apps/mobile/metro.log`) y en Expo Go; pedir captura para ver el code exacto (p. ej. `flow_state_not_found` vs red).

### 2026-09-18 — Race logout→re-login rápidos (reporte 5 del PO)

**Síntoma:** cerrar sesión y tocar "Continuar con Google" enseguida (muy rápido) → "Algo salió mal. Reintentá."; esperando/intentando de nuevo entra.

**Confirmado por el equipo:** es exactamente una condición de carrera. La UI sale al instante (`setSession(null)` + guards), pero el teardown real de `signOut()` (POST de revocación + `removeAllPKCEVerifiers` + barrido `sb-*`) seguía en segundo plano ~200-500 ms. Si el re-login arranca en esa ventana, el teardown borra el verifier PKCE recién creado por el nuevo `signInWithOAuth` → `pkce_code_verifier_not_found` → "unknown".

**Fix aplicado (`AuthProvider.tsx`):** candado `logoutPromise` — el `signOut` deja un promise pendiente y `signUp`/`signIn`/`googleSignIn` lo **hacen await antes de arrancar** (`drainLogout()`). Así el teardown (local + servidor) termina siempre antes de un nuevo login; imposible la carrera. Tests 119 verde; typecheck y lint OK.

### 2026-09-18 — Fix definitivo: `_recoverAndRefresh` borraba verifiers PKCE (reporte 6)

**Causa raíz real (verificada en `metro.log`):** el error era `bad_code_verifier code challenge does not match previously saved code verifier`. Cuando el usuario toca "Continuar con Google", el cliente Supabase internamente ejecuta `_handleVisibilityChange()` → `_recoverAndRefresh()` → `_removeSession()` → `removeAllPKCEVerifiers()`, que borra **todos** los verifiers PKCE — incluyendo el que acabamos de crear en el paso `signInWithOAuth`. La exchange lee un verifier vacío → el servidor compara SHA-256('') ≠ challenge → `bad_code_verifier`.

**Confirmado por el PO (metro.log):** el flag `pkceFlowActive` funciona — los verifiers se protegen (`removeItem BLOCKED`), `exchangeCodeForSession` lee el verifier correctamente (`getItem: FOUND`). El error persiste como `bad_code_verifier code challenge does not match previously saved code verifier`.

**Causa raíz del `bad_code_verifier` (verificada):** el polyfill `webcryptoPolyfill.ts` usaba `expo-crypto`'s `digest()` que retorna un `ArrayBuffer` con bytes incorrectos en Android Expo Go. El `code_challenge` (SHA-256 del verifier) enviado al servidor Supabase no coincidía con lo que el servidor recomputa con Node.js → `bad_code_verifier`.

**Fix aplicado (`webcryptoPolyfill.ts`):** cambiado `subtle.digest` para usar `digestStringAsync()` (retorna hex verificado) + conversión a `ArrayBuffer` con `hexToArrayBuffer()`. Los logs posteriores confirman que `exchangeCodeForSession` ya no lanza `bad_code_verifier` — login exitoso.

### 2026-09-18 — Fix: `WebBrowser.openAuthSessionAsync` polyfill de Android no intercepta deep link después de `signOut` (reporte 8)

**Causa raíz:** En Android, `expo-web-browser`'s `openAuthSessionAsync` usa un polyfill (`_openAuthSessionPolyfillAsync`) que hace `Promise.race` entre `_openBrowserAndWaitAndroidAsync` (espera `AppState` → `active`) y `_waitForRedirectAsync` (`Linking.addEventListener('url', ...)`). Si `Linking` no detecta el redirect a `exp://...` (puede fallar por el timing después de `signOut`), `AppState` cambia a `active` primero → `Promise.race` resuelve con `{ type: 'dismiss' }` → "Cancelaste el inicio de sesión". El primer login funciona porque `Linking` sí intercepta; después de `signOut`, el polyfill falla.

**Fix aplicado (`googleSignIn.ts`):** reemplacé `WebBrowser.openAuthSessionAsync` por `Linking.openURL` + `Linking.addEventListener('url', ...)` + `AppState.addEventListener('change', ...)` directamente, con `Promise.race` manual. Esto evita el polyfill de `expo-web-browser` y da control total sobre la interceptación del deep link. `Linking.openURL(data.url)` abre el navegador; `Linking` catcha el redirect a `exp://...` y resuelve con `success`. `AppState` catcha el dismiss (usuario presiona atrás) y resuelve con `dismiss`.

- Tests 119 verde; typecheck y lint OK.
- Logs de depuración eliminados de `googleSignIn.ts`, `supabase.ts` y `webcryptoPolyfill.ts`.

### 2026-09-20 — Feature: verificación de retos por cámara con `expo-camera`

**Problema:** El botón "Completar reto" en `app/(tabs)/index.tsx` solo marcaba como completado con `markCompleted()` sin verificación visual. El reto se completaba con un simple toque.

**Fix aplicado:**

- `app/(tabs)/camretos.tsx` — nueva pantalla con `CameraView` de `expo-camera`. Para retos de **reps**: overlay con contador + botón "+" sobre la cámara. Para retos de **seconds**: timer cuenta regresivo sobre la cámara. Cuando se alcanza el objetivo, `markCompleted` + `syncAfterLogin` automáticamente.
- `app/(tabs)/_layout.tsx` — agregada `Tabs.Screen name="camretos"` con `tabBarButton: () => null` (no aparece en la barra de tabs).
- `app/(tabs)/index.tsx` — `handleComplete` navega a `/(tabs)/camretos` en vez de marcar directamente.
- `src/i18n/translations.ts` — agregadas claves `tabs.camretos` en español, inglés y portugués.
- `package.json` + `pnpm add expo-camera` — `expo-camera@~15.0.16` instalado.

- Tests 119 verde; typecheck y lint OK (1 warning sin errores).

### 2026-09-16/17 — Fase 1: gate online, ranking, sync y Google login (resumen previo)

- Gate online-estricto: sin cuenta no se usa la app (se eliminó modo invitado, claves `home.greeting_*_guest`, `home.account_prompt`, `home.sign_in`).
- Migraciones Supabase aplicadas: `0001`–`0005`; creada `0006_oauth_nickname.sql` (nickname desde `full_name` de OAuth, pendiente de aplicar por el PO).
- Sync: `apps/mobile/src/sync/syncService.ts` (`uploadCompletions`, `fetchRanking`, `syncAfterLogin`) + `getCompletedDates`.
- Ranking: función `security definer get_ranking` (streak calculado desde `daily_challenges`); sección RANKING en `progreso.tsx`.
- Login con Google: `flowType: 'pkce'` + fallback `extractImplicitSession` + `setSession`; funcionando en Expo Go.
- WebCrypto: `apps/mobile/src/auth/webcryptoPolyfill.ts` con SHA-256 nativo de `expo-crypto` (elimina el warning "Code Challenge method will default to use plain").
- Tests: 119 mobile + 69 domain.
- Cámara para verificación de retos: `expo-camera` + `CameraView` con overlay de contador/timer.

### 2026-09-21 — Header contextual, cámara más grande, auto-refresh a medianoche (resumen del día)

**Peticiones del PO (vía app/chat, orden cronológico):**

1. Quitar la línea repetida "Sentadillas · 20 repeticiones" en Libre y mostrar la meta al lado del título de la página.
2. Usar el espacio al lado del logo en el header por pestaña (saludo+nickname, "Reto del día", título movido, selector de ejercicio en Libre, Perfil, Ajustes).
3. Arreglar la cámara congelada al volver de minimizar/app background.
4. Auto-refrescar reto del día, descanso, semana, saludo y última semana de progreso al pasar la medianoche.
5. Dar más lugar a la cámara en Retos (título chico, días con contraste, chip de PLAN reemplazado por leyenda pequeña).
6. Eliminar por completo el título "Sentadilla isométrica · 28 segundos" de la página de cámara.
7. Cámara y texto de ayuda a ancho completo en Retos (igual que Libre) con menos espacio con la barra.

**Cambios aplicados (main, 9 commits):**

- `camera-verification.html`: título del ejercicio pasado al lado del nombre (`· N repeticiones/segundos`) y luego **eliminado por completo** (la meta sigue en el badge "0/28" del HUD y en la barra de Retos). Cache-bust `VERIFY_VERSION` subido v2→v6, gh-pages desplegada en cada cambio.
- `components/BrandHeader.tsx`: header contextual por ruta — Inicio: saludo por hora + nickname (una línea, chico); Retos: "Reto del día"; Progreso/Perfil/Ajustes: la palabra movida al header; Libre: selector del ejercicio con flecha ▾ que abre menú modal (`header.pick_exercise`).
- `src/header/LibreExerciseProvider.tsx` (nuevo): estado del ejercicio libre compartido entre header y pantalla.
- `src/i18n/greeting.ts` (nuevo): `greetingKey(hour)` extraído de index.
- `app/(tabs)/_layout.tsx`: `LibreExerciseProvider` + `DayProvider` envolviendo Tabs.
- `src/retos/DayProvider.tsx` (nuevo): timer hasta el próximo día que cambia la fecha de contexto → reto del día, descanso, semana, saludo y ventana de la última semana se refrescan solos a las 00:00.
- `src/retos/useCameraRestart.ts` (nuevo): AppState + foco → al volver al primer plano re-monta la WebView de cámara (destraba la imagen congelada).
- `app/(tabs)/retos.tsx`: título "TU SEMANA" más chico con leyenda "Plan N días" al lado (sin chip); días de la semana con texto visible (hoy en teal, completado con celda teal); cámara y texto a ancho completo sin bordes redondeados; menos margen con la barra.
- `app/(tabs)/camretos.tsx`: sin chips (la selección vive en el header), sin línea "ejercicio · meta"; cámara a pantalla completa + banner de resultado.
- `app/(tabs)/index.tsx`, `progreso.tsx`, `perfil.tsx`, `ajustes.tsx`: títulos del cuerpo retirados (moved al header); ajustes alineado arriba (ya no centrado).
- `src/i18n/translations.ts`: `header.reto`, `header.pick_exercise`, `retos.plan_small` (es/en/pt).

**Verificación:** 123 tests en verde (11 suites), typecheck y lint OK. gh-pages actualizada (v6, sin título). JS pendiente de recargar en el teléfono del PO.

**Pendientes / planes para mañana (2026-09-22):**

- En dispositivo, con reload de JS: confirmar cámara destrabada al volver de otra app, reto del día rotando solo a medianoche y título fuera de la página.
- Validación integral: completar el reto del día por cámara y verificar que el ranking se actualiza (con reset presionado con sesión debe desaparecer del ranking).
- Aplicar `0006_oauth_nickname.sql` en la nube (falta acceso admin del PO).
- Limpieza menor: quitar `unitLabel` muerto en `camera-verification.html` y revisar si `retos.plan_days` ya no se usa.
- Evaluar con el PO cambiar días de descanso del plan (opción ofrecida).

### 2026-09-22 — Limpieza de código muerto, fix de cámara en Libre (GPU) y migración 0006 aplicada

**Petición del PO (vía app/chat):**

1. Limpiar código muerto sin romper lo que funciona (`unitLabel` y `retos.plan_days`). **Hecho** (`4056a6b` + gh-pages `d202a9d`): ambos sin uso confirmado por grep; 123 tests, typecheck y lint en verde; sin cambios visuales → no requirió recarga.
2. Bug de cámara: al ir a Retos (cámara activa) y pasar a Libre, quedaba en "Cargando modelo…" sin cámara; había que cambiar de pestaña para que activara.

**Análisis y fix del bug de cámara (`bfece35` + gh-pages `fcd2135`, `VERIFY_VERSION` v7):**

- Causa raíz: cada pestaña montaba su propia WebView con MediaPipe (`delegate: 'GPU'`, WebGL). Al pasar Retos → Libre convivían **dos WebViews pesadas** y el `PoseLandmarker.createFromOptions` de la segunda se colgaba definitivamente (promise que nunca resolvía) → "Cargando modelo…" infinito. Cambiar de pestaña "lo arreglaba" porque una WebView se desmontaba y liberaba el recurso.
- Fix en 3 partes:
  - **Una sola WebView a la vez:** `src/retos/useScreenFocused.ts` (nuevo) + gate en `retos.tsx` y `camretos.tsx` — la WebView solo se monta si la pestaña está enfocada; al cambiar de tab se desmonta (libera cámara/GPU). El remount por `useCameraRestart` (app resume) se conserva.
  - **`initModel` resiliente en `camera-verification.html`:** `withTimeout` (20s por intento) + fallback automático **GPU → CPU** si el primer intento tarda o falla; también timeout en `FilesetResolver` (CDN colgado). Nunca más quedarse clavado de forma permanente.
- Validado por el PO en dispositivo: "parece que funciona" (Retos → Libre directo con cámara).

**Migración `0006_oauth_nickname.sql` — APLICADA (por el PO):** ejecutada en el SQL Editor de Supabase (Success, sin filas — esperado en `create or replace function`). Nuevos usuarios OAuth (Google) quedan con `full_name`/`name` como nickname en vez de "atleta"; existentes no cambian.

**Pendientes / planes:**

- ~~**Rotación a medianoche:**~~ **VALIDADA 2026-09-22/23 por el PO a las 00:00 (app en primer plano en Retos):** se actualizó todo solo — barra con el reto nuevo, día de la semana marcado como hoy, saludo del header y ventana de Progreso. Incluye el fix `8fabb60`: la WebView de retos ahora se re-monta al cambiar el día (`key` con `dayKey` + ejercicio + meta) para que la página de cámara muestre el reto nuevo y no el viejo.
- **Ranking integral:** completar reto del día por cámara con sesión Google → verificar actualización de posición en Progreso; con reset de progreso con sesión, desaparecer del ranking.
- **Días de descanso:** definir con el PO si pueden saltarse/adelantarse y si la racha cuenta solo en días de plan.
- Backlog menor: flush de autosave en logout (ventana 400 ms, riesgo bajo) y re-validar imagen congelada con el fix de hoy (mitigado con remount).

### 2026-09-22 — Ranking de repeticiones (modo libre), cadencia y gesto de palma

**Decisiones de diseño aprobadas por el PO:**

1. **Reto diario solo alimenta racha** (tipo Duolingo): sin rigor, pausas permitidas, `seriesOk` ignorado, NO aporta a los rankings de reps.
2. **Libre con modo ranking:** el usuario arma la meta (stepper) + toggle "¿Participar en ranking?". La sesión rankea solo si `ranked && seriesOk && value >= target`.
3. **Gesto de palma** (HandLandmarker) para empezar la serie, aplicado a todos los ejercicios en modo ranking; 5 s de countdown sonoro después de la palma (para entrar en posición); 30 s sin detectar palma → "No veo tu palma — acercate" + reintento. Si el modelo de mano falla, se arranca sin gesto pero con cadencia.
4. **Cadencia 5 s/rep** para `sentadillas` y `flexiones` (`REP_CADENCE`); countdown circular visible cuando hay ranking.
5. **Plancha con ranking:** el cronómetro corre solo en posición (pose válida), se detiene al moverse, NO se reinicia; rankea al completar la meta.
6. **Liveness aleatoria a mitad de sesión: se mantiene en todos los modos** (el gesto suma al inicio, no reemplaza).
7. **Gym Bros:** agendado para la siguiente fase (fuera de este trabajo).

**Cambios implementados (HTML v8 + app):**

- `camera-verification.html` v8 (main `8819718`, gh-pages `912b400`): params `ranked`/`cadence`; HUD de gesto, countdown central de 5 s (beep por segundo) y cadencia; `HandLandmarker` compartiendo el `FilesetResolver` (fallback GPU→CPU igual que pose, _idem_ `withTimeout`); `isOpenPalm` (≥4 dedos extendidos, tolerante a distancia); timeout 30 s con reintento; serie rota por descanso largo → fuera de ranking; plancha ranked: el tiempo se detiene al salir de posición sin reset; payload `complete` ahora incluye `ranked`, `seriesOk`, `cadence`, `unit`, `value`. Se repurposó el código muerto (`continuityBroken` → `seriesOk`).
- App:
  - `src/retos/verify.ts`: `VERIFY_VERSION` **8**, `buildVerifyUri(..., { ranked, cadenceSec })`.
  - `src/retos/catalog.ts`: `REP_CADENCE` (sentadillas/flexiones 5 s).
  - `src/header/LibreExerciseProvider.tsx`: expone `libreTarget` y `libreRanked`.
  - `camretos.tsx`: barra de armado (meta −/+ , toggle ranking, INICIAR), WebView solo con sesión abierta, resultado segun `ranked/seriesOk/value`, registra sesión local.
  - `src/retos/freeSessions.ts` (nuevo): store local `libre:sessions` (cap 500) con `ranked/seriesOk/value/target`.
  - `src/sync/syncService.ts`: `uploadSessions` (insert a `workout_sessions` solo en éxito), `fetchRepsRanking`, `fetchTotalRepsRanking`, `syncAfterLogin` suma sesiones conservando datos si el insert falla.
  - `progreso.tsx`: ranking con segmentos **Racha | Reps | Total** y selector de ejercicio (chips).
  - i18n es/en/pt: claves `cam.free_setup_*`, `cam.free_ranked_*`, `progress.rank_reps/total/sessions`.
  - Tests: 137 en verde (nuevos para `freeSessions` y sync de sesiones/RPC), typecheck y lint OK.

**Migración `0008_reps_ranking.sql`: ESCRITA, PENDIENTE DE APLICAR por el PO** en el SQL Editor de Supabase (mismo flujo que `0006`). Amplía `workout_sessions` (`exercise_code`, `value`, `target`, `source`, `ranked`, `series_ok`) + `get_reps_ranking` y `get_total_reps_ranking` (solo `source='libre'`, `ranked`, `series_ok`, `value>=target`; grants `authenticated`). Uso `exercise_code` (texto) en vez de `exercise_id` (uuid) para que el cliente no necesite mapear códigos.

**Pendientes / planes:**

- **PO: aplicar `0008` en Supabase** (SQL Editor) para que el ranking de reps funcione en la nube.
- Validación en dispositivo del flujo completo: armar meta → ranking ON → palma → countdown → cadencia → resultado y aparición en Progreso (Racha/Reps/Total).
- Evaluar el detalle pendiente: gesto de palma del reto diario (reto diario no usa ranking por ahora).

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
- Validación en dispositivo del flujo completo: armar meta → ranking ON → mano arriba de la cabeza → countdown → cadencia → resultado y aparición en Progreso (Racha/Reps/Total).

**Archivo del material del Escritorio (2026-09-27)**

- Se consolidó en el repo lo que servía de `C:\Users\Anibal\OneDrive\Escritorio\App Retos GYM 1`: `docs/equipo/` (17 perfiles + DER, actas, market, `estado.md`, `EQUIPO.md`), `docs/plan/` (PLAN_COMPLETO, PRODUCT_SPEC, ROADMAP, DATABASE, IA_ENTRENADOR), `docs/prototipo/` (HTMLs viejos + referencias) y branding en `apps/mobile/assets/brand/`.
- Se creó **`AGENTS.md` en la raíz** con el rol del asistente, el DER y los 17 roles siempre presentes + reglas del juego (convención `[TAG]`, entregables reales, cero simulación). La carpeta original se eliminó (papelera).

**Reemplazo del gesto (2026-09-22): la palma → "levantar la mano arriba de la cabeza" (v9)**

- El PO reportó que la **palma abierta no se detectaba de lejos** (el modelo de mano requiere la mano grande/cerca). Decision: eliminar `HandLandmarker` y usar el **pose** (que ya se usa para toda la verificación y funciona a la distancia del cuerpo).
- Nueva señal de inicio: la muñeca (la más alta de las dos) queda **por encima de la nariz un 6% del alto del frame** durante 4 cuadros seguidos (`handIsRaised`). Se detecta con los landmarks ya disponibles (cero carga extra de modelo, menos peso de descarga).
- Se quitó `HAND_MODEL_URL`, el fallback `handModelOk` y `isOpenPalm`; textos actualizados (HTML + `cam.free_setup_hint` es/en/pt). `VERIFY_VERSION` → **9** para refrescar caché. 137 tests, typecheck y lint en verde.

**Mejoras a la señal de vida (2026-09-22) — v10 (por feedback del PO)**

- Momento clave resuelto: la señal de vida caía durante la **cadencia de 5 s de ranking** y rompía la serie → quedaba fuera de ranking. Ahora, al activarse el challenge en ranking con cadencia, esa vuelta pasa a **10 s** (`extendCadenceForLiveness`).
- Threshold: la señal de vida se pide en **series de más de 5 repeticiones** (`targetVal > 5`); en ejercicios por tiempo (plancha, isométrica) se mantiene como antes. Series cortas ya no molestan.
- **Overlay de pantalla completa** "SEÑAL / DE / VIDA" en 3 líneas gigantes con animación + **beeps dobles seguidos cada 700 ms** + voz; se cierra al confirmar. Decisión de equipo: gesto **mano arriba de la cabeza** (reps/isométricas) y **"aguantá abajo 2 s"** (plancha y flexiones, para no sacarte de posición).
- Nota en la pestaña Libre (ranking) aclarando la señal de vida (`cam.free_setup_liveness` es/en/pt). `VERIFY_VERSION` → **10**.

**Evaluación de la auditoría externa + Bloque B (2026-09-27) — v11**

- El PO encargó revisar una **auditoría externa** de la app. Los 17 roles la verificaron hallazgo por hallazgo (3 subagentes de exploración en paralelo): **14/14 confirmados** (ninguno central resultó falso). Informe completo del equipo en `docs/2026-09-27_evaluacion_auditoria_externa.md`. Bonus propios: la señal de vida era eludible de 3 formas + al modo segundos le faltaba rigor; 0008 mezclaba plancha/segundos en el ranking de "reps" y su índice parcial quedaba desalineado; el catch del reset mentía; "69 tests de dominio" eran en realidad 35.
- **Decisiones del PO (2026-09-27):** el ranking se **etiqueta como "verificado en el dispositivo"** mientras no exista validación server-side (el gate `validate_workout` del plan sigue pendiente → 0010), y se aprobó **todo el Bloque B**:
  1. **Cámara (v11):** `qualified` ahora exige `gestureStarted && seriesOk && livenessPassed` (cuando la señal de vida aplica); el payload lleva **`liveness_ok`**; el modo segundos ya no califica sin checks; modo no-ranked ya no dice "apto para ranking"; checklist numerador correcto (`{ok}/{total}`). Etiqueta de resultado: "Sesión verificada en el dispositivo — apta para ranking".
  2. **Reset completo:** `resetLocalProgress` borra también `libre:sessions`; el reset en la nube ahora usa la RPC **`reset_own_progress`** (borra `workout_sessions` + `daily_challenges` propias) en vez del UPDATE que no borraba el ranking; se corrigió el copy y el catch mentiroso (nuevo `settings.reset_error` es/en/pt).
  3. **Sync robusto:** `uploadSessions` con **idempotencia** (`client_op_id` + UPSERT por `(user_id, client_op_id)`); `markCompleted` se espera antes del sync en el reto diario; la sesión libre se **sube al instante** si hay sesión.
  4. **Fechas:** la sesión libre usa `todayKey()` local (se eliminó el `toISOString` UTC que fechaba al día siguiente tras las 21 h en ARG).
  5. **JSON.parse seguro** en los 5 sitios (prefs, profile, reto del día, mensajes de retos y de Libre).
  6. **Cámara en build real:** `onPermissionRequest` en ambos WebView + `android.permissions.CAMERA` + `NSCameraUsageDescription` en `app.json`.
- **Migraciones:** `0008` corregida (filtro `measurement_type='reps'` en `get_reps_ranking` + índice alineado con `source='libre'`) y nueva **`0009_reset_own_progress.sql`** (columna `client_op_id` + índice único + RPC de reset con grants `authenticated`). **AMBAS PENDIENTES DE APLICAR por el PO** en el SQL Editor de Supabase (aplicar 0008 y 0009 en orden).
- `VERIFY_VERSION` → **11**. Tests: 139 en verde, typecheck, lint y prettier OK.

**Ranking server-authoritative — paquete del equipo auditor (2026-09-27)**

- El PO encargó al equipo auditor implementar el plan del informe ("rechazar datos
  falsificables: cambiar la arquitectura, no agregar más campos al cliente"). Llegó
  un paquete de servidor + móvil que el equipo **revisó con evidencia (archivo:línea)**:
  1. **Migración `0010_server_authoritative_workouts.sql`**: revoca `insert/update/delete`
     al cliente sobre `workout_sessions` (drop de `session_insert_own`/`session_update_own`
     de 0001), vuelca las sesiones legacy a `manual_review` (`verification_source='legacy'`)
     y crea **`workout_submissions`** (bandeja de propuestas, solo `select` propio) con
     `unique(user_id, client_op_id)`. Los rankings de reps pasan a leer únicamente
     `status='verified'` + `verification_source='server'` + `server_value/server_target`
     (dejando de confiar en `value/ranked/series_ok` del cliente).
  2. **Edge Function `validate_workout`** (`supabase/functions/validate_workout/index.ts`):
     autentica por token de usuario, valida catálogo, límites (`value`/`target` 1..7200),
     fecha, tamaño de evidencia (≤64 KB), dedupe por `client_op_id` dentro del batch y
     guarda las propuestas como **`pending`**; devuelve `received/pending/rejected/verified`.
     La `service_role_key` queda solo en el servidor (nunca en la app).
  3. **Móvil**: `uploadSessions` dejó de escribir directo y ahora invoca la Edge Function
     (`client.functions.invoke`); `FreeSession.livenessOk` agregado; en `camretos` se usa
     `livenessOk === true` (estricto, antes `!== false` aceptaba ausencia) y la etiqueta
     cambió a **"Sesión enviada para validación"** (`cam.free_ranked_pending` es/en/pt). El
     test de `uploadSessions` ahora verifica que se invoque `validate_workout` y que **no**
     haya upsert directo.
- **Dictamen del equipo:** el enfoque es correcto para el leaderboard de reps; se eliminó la
  vía directa cliente → `workout_sessions` y el ranking queda server-authoritative.
- **HALLAZGO CRÍTICO (pendiente de resolver):** la implementación **no cerró el punto 8** de
  la auditoría. El ranking de **Racha** (`get_ranking`, pestaña Progreso) sigue alimentándose
  de `daily_challenges.status='completed'`, que el cliente escribe directo (`uploadCompletions`,
  `syncService.ts:89-100`) con las políticas `challenge_insert_own`/`challenge_update_own`
  (0001) **intactas**. Un usuario puede seguir falsificando retos/rachas sin cámara. Falta que
  el servidor pase el reto a `completed` recién tras validar la sesión y que se revoquen las
  escrituras del cliente sobre `daily_challenges`.
- **Nota de consistencia (menor):** la Edge Function hoy **no tiene camino a `verified`**
  (`verified: 0` siempre, todo queda `pending`) → el ranking de reps queda **vacío** hasta que
  exista el validador de evidencia real (versión del verificador, hash de modelo, secuencia de
  eventos, tiempos, cadencia). Cumple la recomendación "desactivar el ranking hasta validar",
  pero el WebView de cámara **sigue mostrando "Sesión verificada en el dispositivo — apta para
  ranking"** (`camera-verification.html:1146/1866`), contradiciendo el nuevo "Sesión enviada
  para validación". Queda para el PO: corregir copy + `VERIFY_VERSION` y redeploy gh-pages.
- **Decisión de producto a confirmar:** el volcado de sesiones legacy a `manual_review` vacía
  los rankings existentes de golpe (por diseño: no confiar en datos viejos del cliente).
- **Pendiente del PO:** aplicar `0008` → `0009` → **`0010`** en orden (SQL Editor) y deployar la
  Edge Function (`supabase functions deploy validate_workout`, con `SUPABASE_SERVICE_ROLE_KEY`).
- Tests: 139 en verde (12 suites), typecheck y lint OK. La clave `cam.free_ranked_pending`
  quedó con indentación desigual en `en`/`pt`; prettier la normaliza en el pre-commit.

### 2026-09-27 — Retos server-authoritative (0011), camino a `verified` y auditoría #2 → reverting a `pending`

**Seguimiento del paquete del equipo auditor (cierre del punto 8, retos diarios) — revisado y ampliado:**

- `0011_server_authoritative_daily_challenges.sql`: revoca escrituras del cliente sobre `daily_challenges` (drop `challenge_insert_own/update_own/delete_own`), crea **`daily_challenge_submissions`** (bandeja, solo `select` propio) y `get_ranking` solo cuenta `status='completed' AND completion_source='server'`. `reset_own_progress` también limpia ambas bandejas (evita que una propuesta re-aprobada reintroduzca progreso borrado tras un reset). **Fix de consistencia:** se eliminó el `unique(user_id, client_op_id)` (queda `unique(user_id, challenge_date)`) para que el upsert no pueda tumbar el batch con un op_id forjado; se agregaron `client_value`, `evidence_hash` y `verification_version`.
- `camera-verification.html` v12: el payload `complete` transporta **`evidence`** (`verifyVersion`, `model`, `startedAt/finishedAt`, `durationMs`, cadencia, liveness requerida/resultado, `targetVal`, `targetMet`). Ambos labels → "Sesión enviada para validación — pendiente de ranking".
- App: `FreeSession.evidence`, `markCompleted` guarda `CompletionMeta` (value/unit/evidence), `retos.tsx`/`camretos.tsx` la capturan y `uploadCompletions`/`uploadSessions` la envían. `VERIFY_VERSION` → **12**; gh-pages redeployed (`a29025f`).
- Edge Function v2: validaba evidencia (versión, timestamps, duración mínima reps×350 ms / seg×1000 ms, cadencia ≥2 s, límites reps≤1000 / seg≤900) y **aprobaba `verified`** (escribía `workout_sessions`/`daily_challenges`). Tests 141 en verde.

**Auditoría externa #2 — verificación con evidencia: 7/7 hallazgos TRUE:**

- (1) Evidencia **falsificable**: todo campo (`durationMs`, `livenessPassed`, `seriesOk`, `verifyVersion`, …) lo ponía el cliente; el payload de ejemplo pasaba. (2) El reto esperado (ejercicio/objetivo/fecha) lo decidía el cliente → `challengeDate` pasado con `target:1, value:1` generaba días artificiales. (3) Liveness = mera afirmación (sin atestación/video). (4) Riesgo de **duplicar** `workout_sessions` (insert sin `client_op_id`, sin upsert idempotente; el upsert de submissions iba después). (5) **Doble escritura sin transacción** → reto quedaba `completed` y la submission `pending`. (6) `VERIFY_VERSION` sin fijar (`?v=999` pasaba). (menor) `unit:'reps'` por defecto en completions históricos (plancha/segundos).
- **Dictamen:** la aprobación automática volvía a hacer falsificable el ranking **vía la Edge Function** (los valores fuente son del cliente). Correcto el auditor: no habilitar aprobación automática sin validador real.

**Decisión del PO: revertir a `pending` + arreglos gratis. Edge Function v3:**

- **Cero aprobaciones**: todas las propuestas (sesiones y retos) quedan `pending`; ya **no escribe** `workout_sessions` ni `daily_challenges` → desaparecen los riesgos de duplicados e inconsistencias entre tablas (una sola bandeja por flujo, upsert idempotente por `client_op_id` / `(user_id, challenge_date)`).
- **Reto derivado por el servidor**: réplica exacta del algoritmo determinista de la app (`catalog.ts`/`service.ts`: orden por objetivo, `DEFAULT_TARGETS`, multiplicadores, `isoWeekNumber`+`isoWeekday`) → ejercicio/objetivo/unidad esperados para `(fecha, objetivo)`; mismatch → `rejected` (`challenge_mismatch`). Fecha fuera de ventana (hoy/ayer UTC, tolera zona horaria) → `rejected`. Mata el ataque de completar días fake.
- **Allowlist de versiones** `[12]` (`unsupported_evidence_version` si no).
- `syncService`: `unit` desde catálogo local (no default `'reps'`).
- Consecuencia de producto: los rankings de **reps y rachas quedan vacíos** hasta que exista validador real (video/attestation server-side) o revisión manual; la evidencia se conserva como **registro y filtro de datos imposibles** (`missing_evidence` → `pending`; imposible → `rejected`).
- Pendientes del PO: aplicar **`0008 → 0009 → 0010 → 0011`** en orden (SQL Editor) y `supabase functions deploy validate_workout` (con `SUPABASE_SERVICE_ROLE_KEY` seteada). Aviso: usuarios con build v11 sin actualizar verán sus sesiones ranked `rejected` (versión no soportada).
- Tests: 141 en verde, typecheck y lint OK.

### 2026-09-27 — Reparación del equipo auditor (5 archivos, +50/−10) — revisada y aprobada

**Cambios del equipo auditor (equipo que no escribe el código) — verificado en diff, 6/6 confirmado:**

- **`workout_submissions` ahora tiene `evidence_hash` y `verification_version`** (0011, `alter table ... add column if not exists`). Esto arregla un **bug real de v3**: el edge escribe esas columnas pero no existían en 0010 → el insert habría fallado 503 al desplegar.
- **`goal` persistido en el reto local** (`buildChallenge` lo estampa; `DailyChallenge.goal?: Goal` en types.ts).
- **`inferChallengeGoal`** para datos viejos: encuentra el `goal` que reproduce `(date, exerciseId, target)` con el algoritmo determinista; determinista en la práctica (multiplicadores 1.2/1.1/1 dan targets distintos por objetivo).
- **`syncService`** usa el goal almacenado/inferido para retos históricos (no `prefs.goal`); fechas sin goal inferible se omiten del sync (no llegan ni como `pending`).
- **Ventana server-side 365 días (sin futuras)**: alinea el edge con el almacén offline de la app (`getCompletedDates`); deshace la regresión de la ventana de 2 días (habría rechazado propuestas históricas legítimas). Borde despreciable: ventana UTC vs fechas locales en el límite extremo de 365 días/zona horaria.
- **Reintentos actualizan en vez de ignorar** (se quita `ignoreDuplicates` en ambos upserts): con evaluación server-side determinista y todo `pending`, es seguro y mantiene la bandeja al día.

**Notas no bloqueantes:** (1) si un cambio futuro del catálogo vuelve irreproducible un reto histórico, la fecha se omite del sync en silencio (considerar fallback visible si importa la racha); (2) borde de 1 día en la ventana por zonas horarias extremas; (3) **pendiente conceptual confirmado**: `goal` sigue viniendo del cliente — sin `verified` automático no falsifica nada, el server ya valida coherencia contra el algoritmo para el goal declarado; cierre futuro: snapshot del `goal` en BD (p. ej. `challenge_plans`) al asignar el reto.

**Verificación propia:** 141/141 tests (12 suites), typecheck OK, lint OK, `git diff --check` limpio. Dictamen: **reparación aprobada**, sin defectos bloqueantes.

### 2026-09-27 — NEW IDEA del PO: free tier (flexiones/abdominales/sentadillas) + suscripción (resto) — plan completo del equipo (registrado, PENDIENTE de implementar; seguimos mañana)

**La idea del PO:**

- Free: `flexiones`, `abdominales`, `sentadillas`. Suscripción (única vez o mensual) desbloquea el resto de ejercicios.
- **Ranking TOTAL no se elimina**: queda **solo para suscritos**. Los boards por ejercicio incluyen a todos, pero cada usuario aporta solo a los ejercicios que puede ejecutar.
- Los free **no participan del reto del día** (la rotación incluye ejercicios no disponibles) → consecuencia aceptada: **el ranking de rachas/streak también queda solo para suscritos**.
- Free = solo boards por ejercicio de los 3 free, vía **Modo Libre**.

**🚩 Conflicto de regla de producto (decisión explícita pendiente):** "el reto del día y el ecosistema Gym son gratis para siempre" (`PLAN_COMPLETO.md:731`, `AGENTS.md`) queda **obsoleto** con este modelo. Requiere acta PO + actualizar `PLAN_COMPLETO` §15.4. Todo lo demás asume el cambio aprobado.

**Plan por fases (roles del repo):**

- **F0 — Fundaciones (sin dinero):** crear `abdominales` (8º ejercicio, reps): catálogo×5 (`catalog.ts`, i18n×3, DB `0012` drop/re-add CHECK de `0005`, réplica en `validate_workout`, detector `situp` portable de `docs/prototipo/camera-verification.html`), gh-pages + `VERIFY_VERSION` 13. **Compat determinista por fecha de corte** (orden 7 para fechas < feature, 8 para >=; el server replica). `tier` free/premium en catálogo y DB. Actualizar `service.test.ts` (tolengths). Roles: FE, CV, BE, DATA, SEC.
- **F1 — Semántica de ranking (entitlement):** helper `has_active_entitlement(uid,key)` (security definer); `get_total_reps_ranking` → `+ where has_active_entitlement(ws.user_id,'premium_exercises')` (TOTAL solo suscritos); `get_reps_ranking` → `+ and (e.tier='free' or has_active_entitlement(...))`; `get_ranking` (streak) → solo suscritos. Estampa `ranked_as_premium` en `workout_sessions` al verificar (historial estable si cae la suscripción). Edge: rechaza premium sin entitlement y **toda** completión de free (`rejected: premium_required`). Roles: BE, SEC.
- **F2 — Paywall mock (sin cobrar):** gate de pantallas free (tab Retos → pantalla suscripción; home preview), Modo Libre con candados, chips de ranking filtrados, copy 3 idiomas. Mide conversión intencional. Roles: UX, FE, PRODUCT.
- **F3 — Billing real (⛳ gate PO + autorización `AGENTS.md:86-87`):** cuentas (Google Play Console US$25 vez / Apple US$99 año / RevenueCat gratis hasta ~US$2.5k MRR / EAS), `react-native-purchases`, productos `premium_monthly` + `premium_lifetime` (clave entitlement `premium_exercises`; precio sugerido mensual ~US$2.99-3.99, lifetime ~US$19.99-29.99, local por país), edge `revenuecat_webhook` (verifica firma → escribe `entitlements` con `expires_at`), RLS select-own (patrón `workout_submissions`), restore purchases, trial 7 días, refunds webhook → revoca entitlement. Roles: PO, FE, BE, SEC, SRE, FIN.
- **F4 — Cumplimiento + lanzamiento store:** política privacidad + términos públicos/versionados (cláusulas de suscripción, renovación, cancelación, reembolsos por store), data safety form real, content rating 13+ / targeting 13+, reembolsos (Play 48 h / UE 14 días; meta <3%), fiscal (stores son vendedor de récord; gate formalización ~300 USD recurrentes, `§15.5.2`), ficha store, closed testing 12+ testers 14 días, rollout 10→50→100. Roles: LEG, ASO, FIN, CSC, SRE.
- **F5 — Métricas y anti-abuso:** unit economics (ARPU, MRR, CAC<LTV/3, churn, %conversión, % reembolsos <3%), regla del 30%, vigilancia premium sharing / trial abuse (gate server-side por `auth.uid()`). Roles: DATA, FIN, CSC, GRO, SEC.

**Modo de pago (cómo se cobra de verdad):** app móvil con contenido digital in-app **debe** usar Play Billing/StoreKit (MercadoPago/Stripe solo B2B/web). Canal: SDK → store Billing → RevenueCat → webhook → `entitlements`. Offline: todo sigue `pending`; sin suscriptores el sistema queda igual (rankings vacíos), pero la semántica queda lista para el futuro validador real.

**Legal (`[LEG]` pre-flight adaptado):** privacidad + términos (suscripción), biometría cámara = dato sensible (retención 30 días, consentimiento explícito, evidencia agregada no video, extender `contrato_evidencia`), data safety form, 13+ (menores: consentimiento parental GDPR art. 8 + billing parental), reembolsos por store, store review (restore purchases, términos linkados, gate invisible), formalización fiscal ~300 USD.

**Entregado hoy:** plan completo presentado al PO (respuesta larga en chat). No se tocó código. Pendientes para mañana:

1. Acto formal: registrar decisión de cambio de regla (reto del día premium) + actualizar `PLAN_COMPLETO` §15.4.
2. Confirmar D1 (crear `abdominales`), D2 (precios), y empezar **F0** si el PO da luz verde.
3. [Alto nivel] Hasta que existan cuentas de store, no hay cobro posible; F0–F2 no dependen de eso.

### 2026-09-28 — Análisis del plan free+suscripción en TODOS los roles (9 agentes sobre código real) → decisiones del PO (A–E) y plan v3 consolidado

**Análisis del equipo (verificado en código, no teórico) — veredicto: modelo viable con 3 condiciones; consenso total en 2 SKUs sin lifetime, gate server-side y F2 sin cobrar.**

Condiciones del "sí": (1) instrumentar métricas antes (hoy no hay PostHog/Sentry → F2 sin medir es ficción, `apps/mobile/package.json`); (2) fijar regla del reto para el free (ver D-A); (3) pagar la deuda técnica preexistente que destaparon los roles (bloqueante de F3): `syncService` borra la cola local aunque el edge rechace (`syncService.ts:178` — el edge debe devolver rechazos por `clientOpId` y el cliente conservarlos), **un free puede enviar un ejercicio premium hoy** (el edge no valida `tier`), bugs TZ (ventana UTC) y de unidades en `mountain_climbers`, y `workout_exercises.insert_own`/`streaks` aceptan selección de ejercicio y rachas sin gate (ROAD: cerrarlos antes del paywall).

**Decisiones del PO confirmadas hoy (A–E):**

- **D-A — Reto del día para free: rotando entre los 3 libres** (cambia el modelo original premium-only). El free juega el reto diario si el ejercicio aleatorio cae en `flexiones/abdominales/sentadillas`; si cae en premium, ve ficha teaser. Consecuencia: **las rachas vuelven a ser para todos** (se revierte la consecuencia aceptada de `:364`). El ranking **TOTAL sigue solo para suscritos**; los boards por ejercicio incluyen a todos pero cada usuario aporta solo a lo que puede ejecutar. Esto **evita** el conflicto agravado con `PLAN_COMPLETO:731` (el reto sigue gratis para el free cuando es ejecutable), elimina el riesgo de rating 1★/dark-pattern notado por ASO, y conserva el loop de hábito que MARKET dice que ganamos sobre Hevy/Strong.
- **D-B — Trial: 7 días, solo en el plan anual**, elegibilidad y aviso de renovación los maneja el store (1 trial de por vida por cuenta). Sin tarjeta en el free, no se pide en el trial.
- **D-C — Contenido rating 13+; compras (IAP) solo 17+** (blinda el caso "compró un menor"; Family buying para <17 en Play). [LEG] redactará la verificación en T&C + data safety.
- **D-D — Precio de lanzamiento: `US$2.99`/mes y `US$19.99`/año (−44%)**, 1 aumento opt-out por país/año permitido (hasta +50%, p. ej. llegar a 3.99/23.99 con datos), **sin precio manual por país** (Play auto-convierte moneda local desde 2026-09-14), comisión real 15% Play (suscripciones auto-renovables) / 15-30% Apple (Small Business program) → neto ≈ 85%, usarlo en unit-economics.
- **D-E — IDs estandarizados: `premium_monthly` + `premium_annual`** (clave entitlement `premium_exercises`). Se corrige `PLAN_COMPLETO:720` (`premium_yearly`), `BITACORA:374` (nombraba `premium_lifetime`) y la sugerencia de precio del plan v2 se alinea con D-D.

**Plan v3 (fases ajustadas con los aportes de los roles):**

- **F0 + F0.5 — Fundaciones sin cobrar (HOY, sin cuentas de store):** `abdominales` (8º, reps; mover a `tier='free'`), `tier` en catálogo+i18n+DB (`0012` con CHECK y default fail-closed), compat determinista por fecha de corte, detector `situp` con gate anti-pararse y buffer propio (SVY: patrón `puente_gluteo`, portar `kneeStandingMargin` de `docs/prototipo/camera-verification.html:831-834,1600-1621`), `REP_CADENCE abdominales: 3`, gh-pages + `VERIFY_VERSION` 13, **release atómico** (HTML+edge+0012+fixtures+jobs). **Instrumentación PostHog (free tier, costo 0)** con diccionario de eventos ANTES de la primera pantalla de paywall (`[DATA]`: sin esto F2 no mide). Pagar deuda técnica preexistente del gate (syncService rechazos, TZ, mountain_climbers, cerrar `insert_own`/`streaks`). [MED] toques: tope de volumen Modo Libre (~60-80 reps), técnica por ejercicio, aviso médico corto, y **agregar 1 ejercicio de espalda al catálogo premium** (hoy no hay ninguno).
- **F1 — Semántica de ranking por entitlement:** helper `has_active_entitlement` (SECURITY DEFINER, **sin EXECUTE público** — evita oráculo); TOTAL solo suscritos; boards: `e.tier='free'` OR entitlement; streak vuelve universal (por D-A). Edge: gate `tier` ANTES de construir filas (`premium_required`), valida `exercise.tier` de la DB (cierra el hueco de hoy), completions rechazadas → `rejected` persistido, sesiones incobrables descartadas. `ranked_as_premium` = estampa de contexto (historial estable), **sin backfill**, no filtra lectura (cancelar no borra del TOTAL histórico). `0013`: `entitlements` (PK `(user_id,key)`, `expires_at`, RLS select-own, revoca a clientes) + `subscriptions` (PK `original_transaction_id`) + `purchases` (PK `rc_event_id` → anti-replay).
- **F2 — Paywall mock (sin cobrar):** **login obligatorio antes de comprar** (`Purchases.logIn(auth.uid)` — compra anónima queda huérfana, [SEC]); placement pago por momento de valor (no al abrir la app); máx. 1 paywall por sesión y por punto de entrada; candados con `exerciseId` memorizado; convertidor mensual/anual; **semántica "bloqueado" sin depender de arrays de ranking vacíos** (`syncService` devuelve `[]` tanto en error como sin datos → no gatillar candado por eso). Gates medidos (PostHog): ≥8% ven-paywall→seleccionan-plan, ≥15% tocan CTA, piso <5% → no F3; n≥300 vistas/variante; D1/D7 no perder >5pp.
- **F3 — Billing real (⛳ gate PO + autorización `AGENTS.md:86-87`):** cuentas Play US$25 / Apple US$99/año / RevenueCat gratis hasta ~US$2.5k MRR / EAS free; `react-native-purchases`; productos `premium_monthly`+`premium_annual`; edge `revenuecat_webhook` **`--no-verify-jwt`** con firma `Bearer` comparación constante-tiempo y `unique(rc_event_id)`. **Webhook: `CANCELLATION` NO revoca** (solo `will_renew=false` → al vencimiento); revocan `EXPIRATION/REFUND/TRANSFER/DELETE`; `BILLING_ISSUE` mantiene (gracia). Trial 7d anual (D-B) con precio de renovación visible; restore purchases; refunds revocan entitlement. Entitlement **nunca de cliente**; mapeo `app_user_id → auth.uid()` solo `service_role`.
- **F4 — Cumplimiento + store:** acta de cambio de regla (D-A) firmada previa; `docs/legal/T&C` versionados (renovación, cancelación en tienda, trial, restore, reembolsos); data safety (RevenueCat declarado: user ID + purchase history; biometría = dato sensible, retención 30 días); política de privacidad; rating 13+ con IAP 17+ (D-C: verificación de edad + Family billing); reembolsos (Play 48 h / UE 14 días; meta <3%); content rating; ficha store (copy destacando "reto diario 3 ejercicios gratis"); closed testing 12+ testers 14 días; rollout 10→50→100. **Gate formalización real [FIN]: ~130-150 suscriptores** (no los "300 USD" teóricos); MRR≠caja (liquidación store el mes siguiente → caja ≈55-65% del MRR bruto).
- **F5 — Métricas y anti-abuso:** unit-economics (ARPU, MRR, CAC<LTV/3, churn, %conversión, reembolsos <3%, **regla del 30%** apple-deep), vigilancia premium sharing / trial reuse (gate por `auth.uid()`). Drop la suba automática de precio hasta tener F2/F3 data.

**Acuerdos técnicos transversales que quedan vigentes:** el ranking TOTAL queda vacío hasta que exista validador real (camino `verified`) — el premium no cambia eso; sin validador, el orden es por volumen validado → el valor premium se construye con F0.5-F3, no con rankings fantasma.

**Entregable de hoy:** análisis consolidado + decisiones A–E → plan v3. No se tocó código (la fecha de corte de la migración `0012` aún define el orden anterior = `007` compatible).** Pendientes del PO:**

1. Autorizar F0+F0.5 (no dependen de cuentas de store) — recomendación del DER: dar luz verde hoy.
2. Acto formal D-A (cambio de regla) + actualizar `PLAN_COMPLETO` §15.4 y AGENTS si aplica.
3. Confirmar backfill de `tier` y de la deuda técnica preexistente como parte de F0 (recomendado: sí).

### 2026-09-28 — PLAN v4 ADOPTADO: Free tier + Premium sin datos falsificables (revisión externa de v3 + correcciones del PO) — PLAN VIGENTE de free/pro

**Proceso:** v3 se sometió a análisis externo → PLAN v4. Se revisó contra el código actual y las decisiones A–E. **v4 reemplaza a v2/v3 como plan vigente**, con 2 correcciones del PO (reto y espalda) y ajustes del DER. Sin cambios de código el día de hoy.

**Principio rector:** el cliente puede proponer resultados, pero **nunca** puede crear por sí mismo progreso, rachas, rankings ni entitlements válidos. Mientras no exista validación real de evidencia, todo queda en `pending`.

### 1. Modelo de producto (final)

- **Free** (`flexiones`, `abdominales`, `sentadillas`): reto diario, rachas, Modo Libre, ranking individual de los 3 libres, cámara/detección, historial local. **Sin ranking TOTAL.**
- **Premium** (`plancha`, `zancadas`, `puente_gluteo`, `mountain_climbers`, `sentadilla_isometrica` + ejercicios futuros): Modo Libre premium, rankings premium, ranking TOTAL, futuras rutinas/planes premium.
- **Reto diario gratis para todos** (D-A). Premium = contenido adicional, no el acceso básico. **No hay lifetime** (D-E).

### 2. Regla única del reto diario (cambia "7 antes / 8 después")

- Antes de `FEATURE_DATE`: algoritmo antiguo para compat histórica.
- Desde `FEATURE_DATE`: el reto rota **solo entre flexiones, abdominales y sentadillas**. La rotación es determinista: misma fecha, misma zona horaria definida, misma fórmula móvil+servidor, mismo objetivo esperado, mismo target. El objetivo del usuario puede modificar el target pero **no es elegido libremente por el cliente al sincronizar**.

### 3. Autoridad server-side del reto (nueva tabla conceptual `daily_challenge_assignments`)

- Campos: `user_id`, `challenge_date`, `goal_snapshot`, `exercise_code`, `target`, `unit`, `feature_version`, `created_at`. PK `(user_id, challenge_date)`; el cliente **solo lee** su asignación (sin insert/update/delete); solo RPC segura o Edge la crea.
- Flujo: app solicita reto → server lee objetivo del perfil → crea/devuelve asignación → app guarda local → al enviar el resultado el server compara contra la asignación (ejercicio/unidad/fecha/target) → mismatch = rechazo. Evita que el cliente mande otro goal/target/ejercicio para un reto más fácil.
- Retos antiguos sin asignación → `manual_review`/`pending`, nunca aprobación automática.
- **Corrección del PO (adoptada):** el `goal_snapshot` del cliente es **solo informativo**. Para aprobar históricamente un reto tras un cambio de objetivo hace falta **historial server-side del objetivo** (tabla `goal_history`: `user_id, goal, valid_from, valid_until` o una asignación por fecha): la derivación del edge vale para el reto vigente (objetivo actual en el perfil), no para sync tardía tras cambio de objetivo. La asignación/historial es **fuente autoritativa** del objetivo por fecha; el server valida contra ella, no contra lo que mande el cliente.

### 4. Catálogo y tiers

- **DB = fuente de verdad.** `exercises.tier` `free | premium`, **fail-closed** (sin tier válido = premium). El Edge NO usa listas hardcodeadas; el catálogo móvil solo sirve para UI/experiencia local.
- Migración: (1) agregar `tier`; (2) actualizar los 7 ejercicios existentes; (3) `abdominales` como free; (4) ejercicio de espalda futuro (ver corrección); (5) constraint del catálogo; (6) fixtures de todos; (7) réplica en cámara y Edge.

### 5. Cámara y evidencia

- La cámara reporta evidencia (valor, unidad, duración, versión, timestamps, cadencia, liveness, hash) pero el server la trata como **no confiable**. Edge: valida formato/límites/unidad/versión/ejercicio+tier, guarda hash, guarda `pending`/`rejected`, **nunca** convierte a `verified` automáticamente. El hash detecta modificaciones posteriores, no prueba cámara real.
- Futuro `verified`: validación server-side de video, evidencia firmada, attestation de dispositivo (no prueba el movimiento por sí sola), revisión manual, o combinación. Copy obligatorio: **"Sesión enviada para validación"**; nunca "Sesión verificada".

### 6. Sincronización y cola local (fix del bug `syncService.ts:178`)

- Edge responde por elemento: `clientOpId`, `status(accepted|pending|rejected)`, `reason`. El móvil **no borra** toda la cola tras HTTP 200: `accepted`→borra; `pending`→conserva; `rejected`→conserva (mostrar motivo/historial); error de red→conserva; respuesta parcial→procesar elemento por elemento.
- Idempotencia: sesiones `(user_id, client_op_id)`; retos `(user_id, challenge_date)`. Los reintentos actualizan `pending` pero **nunca degradan** una propuesta ya aprobada por un validador independiente. Límite de cuota por usuario + tamaño máximo de batch.

### 7. RLS y superficies heredadas (cerrar ANTES del paywall)

- Cerrar escritura directa de: `daily_challenges`, `workout_sessions`, `workout_exercises`, `streaks`, `progress`, XP y logros.
- Cliente solo: leer sus datos, invocar funciones, enviar propuestas. Nunca escribir valores que afecten rankings o progreso autoritativo.
- Reset de progreso borra: `daily_challenges`, `workout_sessions`, `workout_submissions`, `daily_challenge_submissions` y asignaciones/propuestas pendientes relacionadas.

### 8. Semántica correcta de rankings (corrige contradicción de v3)

- **Racha:** visible para todos; solo `status='completed' AND completion_source='server'`; pending no cuenta.
- **Boards free:** visibles para todos, solo sesiones verificadas; no aceptan sesiones premium en un board free por error.
- **Boards premium:** solo visibles con entitlement activo; una sesión verificada conserva su contexto histórico; la cancelación no borra sesiones pasadas.
- **Ranking TOTAL:** **NO filtrar cada fila por el entitlement actual del participante.** Regla correcta: (1) quien consulta tiene entitlement premium activo; (2) las filas mostradas tienen `ranked_as_premium = true`; (3) la cancelación no elimina historial; (4) las sesiones premium nuevas quedan bloqueadas tras la expiración. Así se conserva el historial sin permitir que un no suscriptor consulte el TOTAL.

### 9. Entitlements

- `entitlements` (`user_id, key, expires_at, store, updated_at`): RLS select-own; el usuario **no puede** insertar/actualizar/revocar.
- `subscriptions`: idempotencia **`(store, original_transaction_id)`** (no `original_transaction_id` solo — evita colisiones entre stores).
- `purchases`: `rc_event_id` `unique` (anti-replay de webhook).
- Entitlement escrito **solo** por `service_role` desde el webhook.

### 10. RevenueCat y stores

- Flujo: `Google Play / App Store → RevenueCat → webhook firmado → Supabase Edge Function → entitlements → app`. La app **nunca** activa premium por respuesta local del cliente.
- Login antes de comprar; cuenta RC asociada a `auth.uid()` desde servidor.
- Eventos a manejar: compra inicial, renovación, cancelación, expiración, reembolso, transferencia, billing issue, restauración, cambio de producto. **Una cancelación NO revoca de inmediato**: se conserva hasta la fecha de expiración, salvo reembolso o revocación explícita.
- RevenueCat: gratis hasta ~US$2.5k MRR, después 1% del MTR.

### 11. Precio y monetización (D-D + ajustes)

- `premium_monthly`: **US$2.99/mes** · `premium_annual`: **US$19.99/año** (~US$1.67/mes, descuento ~44%) · **trial 7 días solo en anual** (D-B) · **sin lifetime**.
- **No** tratar la "suba del 50% una vez por país y año" como regla fija: cambios de precio, notificaciones y consentimiento dependen del país y la tienda (Google genera precios locales automáticos y permite revisarlos por región; Play auto-convierte USD→local desde 2026-09-14).
- Comisiones **no** como cifra global única: Google varía por región/programa/instalación (suscripciones auto-renovables = 15%), Apple 15%/30% según programa, región y antigüedad de la suscripción (Small Business = 15%).
- Modelo financiero debe incluir: impuestos, reembolsos, conversiones, comisión de tienda, RevenueCat post-umbral, **retraso de liquidación (MRR ≠ caja; caja ≈ 55-65% del MRR bruto)**, soporte, cuentas de desarrollador (Play US$25, Apple US$99/año). Gate de formalización: ~130-150 suscriptores.

### 12. Fases de ejecución (v4)

- **F0 — Base gratuita y seguridad:** `abdominales`, tiers, reto diario free de 3, asignaciones server-side, migraciones, RLS, validación de tier, cola segura, pruebas de manipulación, cámara VERIFY_VERSION 13, release atómico (HTML+Edge+DB). _Ajuste: el ejercicio de espalda NO entra en F0 (ver corrección 2)._ **Criterio de salida:** ningún cliente escribe progreso autoritativo; premium no corre como free; una propuesta rechazada no desaparece; sin rankings falsos; tests cubren fechas, unidades, tiers y reintentos.
- **F0.5 — Calidad e instrumentación:** PostHog o equivalente (gratis); diccionario de eventos sin PII; errores de sync; métricas de cámara y abandono; dashboard mínimo; alertas Supabase/Edge. Eventos mínimos: `challenge_view/complete/pending/rejected`, `paywall_view`, `plan_selected`, `purchase_started/completed/failed`, `subscription_expired`.
- **F1 — Semántica premium:** `entitlements`, helper seguro `has_active_entitlement` (sin oráculo), boards free/premium, TOTAL con control de acceso + `ranked_as_premium`, pruebas de expiración/cancelación, tests de RLS y no-oráculo. **Criterio:** cancelar sin perder historial; usuario expirado no crea sesiones premium; free no consulta TOTAL; ranking sin datos no verificados.
- **F2 — Paywall mock (antes de cobrar):** paywall en momento de valor; máx. 1 por sesión y punto de entrada; copy es/en/pt; pantalla de producto; selección mensual/anual; restore visible; login obligatorio antes de compra; medición completa (**PostHog: ≥8% ven-paywall→seleccionan-plan, ≥15% tocan CTA, piso <5% → no F3; n≥300 vistas/variante; D1/D7 no perder >5pp**). Los objetivos de conversión son **hipótesis** (muestra, duración, criterio estadístico), no decisiones permanentes.
- **F3 — Billing real (⛳ gate PO + autorización `AGENTS.md:86-87`; solo si F2 demuestra interés):** cuentas Play/Apple, RevenueCat, productos, trial 7d anual, webhook, restore, refunds, entitlements, sandbox, offline, anti-replay. **`react-native-purchases` requiere build nativa/dev build; NO funciona en Expo Go.**
- **F4 — Cumplimiento y stores:** T&C, política de privacidad, consentimiento de cámara, política de eliminación, exportación de datos, retención de evidencia (30 días), Data Safety, contenido 13+ (IAP 17+ — ver nota), revisión de menores y compras parentales, copy sin promesas médicas, ficha de store, closed testing, rollout gradual. _Nota de exactitud [ASO/LEG]: edad de compra NO como regla universal fija 17+ — revisar por país, store y controles parentales (D-C queda como default concreto hoy: 13+ contenido / compras 17+ con verificación parental)._ Google exige closed testing 12 testers/14 días **para cuentas personales nuevas determinadas, no todas**. Reembolsos: Play 48 h / UE 14 días, meta <3%.
- **F5 — Métricas y anti-abuso:** conversión, retención, churn, reembolsos, ARPU, MRR, usuarios premium activos, sesiones premium rechazadas, cuentas anómalas, intentos de replay, propuestas por usuario, consumo Edge/DB. **CAC < LTV/3 = objetivo futuro** (no aplicable sin adquisición paga).

### 13. Orden recomendado (v4)

1. Congelar reglas free/premium → 2. catálogo y tiers → 3. asignaciones server-side del reto → 4. cerrar RLS heredada → 5. reparar cola de sync → 6. abdominales y detector → 7. pruebas de cámara → 8. instrumentar eventos → 9. paywall mock → 10. medir retención/conversión → 11. entitlements → 12. RevenueCat → 13. cumplimiento y stores → 14. rollout gradual.

### Correcciones y ajustes adoptados en la revisión (acordados con el PO)

1. **Reto offline (goal):** la derivación on-the-fly permite offline-first, pero el `goal_snapshot` del cliente es **solo informativo**; para aprobar históricamente un reto tras un cambio de objetivo hace falta **historial server-side del objetivo** (§3). Opción general más barata: `goal_history` (`user_id, goal, valid_from, valid_until`) sirve también para progresión histórica si el catálogo cambia; alternativa simple: asignación por fecha. A definir en F0.
2. **Ejercicio de espalda → DIFERIDO a futuro (no bloquea F0):** `bird_dog` es válido como core/posterior pero **no cumple** "espalda" católicamente; si el producto quiere venderlo como espalda, el estándar honesto es **remo con banda** (mayor complejidad CV) y como opción barata sin equipamiento **`superman`** (erector/paravertebrales, encuadre fácil). Decisión adoptada: dejar para fase futura, mantener el catálogo premium base en los 5 ejercicios actuales.

**Veredicto de la revisión (adoptado):** v3 tenía buena dirección pero el plan correcto es v4 — free primero; reto diario limitado a 3 ejercicios; tiers controlados por DB; asignaciones server-side; cola resistente a rechazos; rankings solo con resultados verificados; premium por entitlement; billing después de validar demanda; legal y tiendas antes de cobrar.

**Pendientes del PO para arrancar F0:** (1) luz verde a F0+F0.5; (2) acto formal D-A + actualizar `PLAN_COMPLETO` §15.4; (3) decidir en F0: `goal_history` vs asignación por fecha para el reto server-side.

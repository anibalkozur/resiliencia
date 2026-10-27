# Bitácora de ResiliencIA

Registro de peticiones del cliente (PO) y cambios aplicados. Se actualiza a medida que se planifica y desarrolla cada fase.

## Historial

### 2026-10-26 — Cierre de cambios móviles, onboarding y recursos visuales

**Petición del PO:** guardar y registrar el estado probado de la app, incluyendo
la corrección de la imagen de flexiones en las tarjetas de Modo Libre.

**Cambios incluidos en el cierre:**

- La pose mostrada en las tarjetas de flexiones de mujer y hombre usa la
  posición inferior/de trabajo, no la posición superior/de descanso.
- Se incorporó el mapa de recursos visuales de ejercicios para adaptar la
  imagen al modelo visual elegido por el usuario.
- Se conservaron los recursos de ejercicios, onboarding y banco de pruebas
  acumulados en el estado de trabajo.
- Se incluyeron los cambios acumulados de onboarding de perfil, autenticación,
  ajustes, eliminación de cuenta y persistencia local que estaban pendientes de
  cierre.

**Validación:** typecheck ✓ · lint ✓ · **225/225 tests ✓** · la app móvil y la
selección visual de ejercicios fueron probadas por el PO: **OK**.

**Alcance:** se excluyó `tmp.test`, que permanece sin tocar como archivo local
pendiente. No se eliminaron backups ni cambios fuera de este cierre.

**Entrega:** commit y push a `main`; acta 031; tag de recuperación y backup
local asociados al mismo commit.

### 2026-10-25 — Animaciones de ejercicios en el banco de pruebas

**Petición del PO:** probar recursos visuales profesionales para ejercicios sin
animar todas las tarjetas al mismo tiempo.

**Cambios aplicados:**

- Se agregó `expo-video` compatible con el SDK del banco.
- Las tarjetas de abdominales y flexiones muestran una imagen estática
  transparente en pose superior para reducir consumo y distracción.
- Las pantallas "Antes de empezar" reproducen el video correspondiente en
  bucle y sin audio.
- Se incorporaron imágenes de mujer y hombre para abdominales, y poses de mujer
  para flexiones, con fondo negro y variantes transparentes.
- Se agregaron los componentes `AbdominalAnimation` y `PushupAnimation`.

**Validación:** typecheck ✓ · lint ✓ · banco **39/39 tests ✓** · bundle Android ✓.
El PO confirmó que el banco funciona correctamente.

**Alcance:** solo banco de pruebas; no se modificó la app móvil de producción.
Los cambios pendientes existentes de `apps/mobile` y `tmp.test` quedaron fuera
del commit y fueron preservados.

**Entrega:** commit de código `32f2f71`; acta 030; tag
`backup-resiliencia-20261025-225714`; backup local
`backups/resiliencia-20261025-225714.zip`.

### 2026-10-25 — Migración de Expo SDK 57 a SDK 58

**Problema:** Expo Go instalado desde Play Store era SDK 58, pero la app móvil estaba en SDK 57 y mostraba `Project is incompatible with this version of Expo Go`.

**Cambios aplicados:**

- Se actualizó la app móvil a Expo `~58.0.19`, React Native `0.88.0` y React `19.3.0`.
- Se alinearon Expo Router, Camera, Sensors, File System, Image Picker, SQLite, Secure Store, Web Browser, WebView y el resto de módulos de SDK 58.
- Se actualizaron Reanimated, Worklets, Jest y los presets de React Native.
- Se corrigió la configuración de la ruta inicial de autenticación para Expo Router 58.
- Se actualizó la referencia de `ScrollView` del chat para los tipos de React Native 0.88.
- El banco de pruebas de ejercicios conserva su SDK 57 independiente.

**Validación técnica:** `typecheck` ✓ · `lint` ✓ · Expo Doctor **20/20** ✓ · Expo config ✓ · bundle Android ✓ · **222/222 tests** ✓.

**Validación del PO:** la app abrió y funcionó correctamente en Expo Go SDK 58 instalado desde Play Store.

**Entrega:** commit de código `353c6f0` publicado en `main`; tag final `backup-resiliencia-20261025-110743`; backup previo preservado en `backup-resiliencia-20261025-105725`; acta 029.

### 2026-10-22 — Perfil local y rediseño profesional de Ajustes

**Petición del PO:** implementar la foto de perfil en versión local y ordenar Ajustes con una presentación moderna y profesional.

**Cambios aplicados:**

- Se agregaron `expo-image-picker` y `expo-file-system` para Expo SDK 57.
- La persona puede elegir una imagen de la galería, tomar una foto o quitarla desde Ajustes.
- La imagen se recorta cuadrada, se comprime y se guarda de forma persistente en el dispositivo, separada por `userId`.
- El avatar de Inicio abre Ajustes y muestra la foto guardada o la inicial como fallback.
- Ajustes se reorganizó en cabecera, perfil, foto, días de entrenamiento, idioma, cuenta y reinicio de datos.
- Se configuraron permisos de cámara/fotos y se agregaron traducciones es/en/pt.

**Validación:** `typecheck` ✓ · `lint` ✓ · Expo config ✓ · **20 suites / 222 tests** ✓.

**Alcance:** foto local únicamente; no hay subida a Supabase ni sincronización entre dispositivos. No afecta retos, ranking ni verificación.

**Entrega:** commit `855e7b7` publicado en `main`; tag `backup-resiliencia-20261022-001312`; backup `backups/resiliencia-20261022-001312.zip`; acta 028.

**Prueba manual pendiente del PO:** probar galería, cámara, cancelación, permisos denegados, eliminación, persistencia tras reinicio y cambio de cuenta en Expo Go.

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

### 2026-09-28 — F0 IMPLEMENTADO (núcleo): abdominales + tiers + reto free de 3 + asignaciones + cola segura + cámara v13

**Acto D-A (formal, acordado con el PO en sesión):** el reto diario es GRATIS para todos cuando el ejercicio del día cae en el pool FREE (`flexiones`/`abdominales`/`sentadillas`). Rachas vuelven para todos. El ranking TOTAL queda solo para suscriptores (se implementa en F1). Si el reto cae en uno de los 5 premium, el free ve ficha teaser (F2). Esto evita el conflicto con `PLAN_COMPLETO:731` y conserva el loop de hábito.

**Cambios implementados hoy (sin commit aún; pide commit al PO):**

- **Migración `0012_tiers_goal_history_assignments.sql`:** `exercises.tier` (default `'premium'` = fail-closed, CHECK free/premium); `sentadillas`/`flexiones` → free; **`abdominales`** (8º, reps, free) + ampliación del CHECK de catálogo; tablas `goal_history` (histórico server-side del objetivo vigente por fecha, escrito por trigger sobre `profiles.goal`) y `daily_challenge_assignments` (asignación del reto: `user_id,challenge_date,goal_snapshot,exercise_code,target,unit,feature_version`, UNIQUE por fecha) — ambas con RLS select-own y sin escritura del cliente (service_role). `reset_own_progress` también limpia asignaciones.
- **Migración `0013_close_legacy_client_surfaces.sql`:** cierra escrituras del cliente en `workout_exercises`, `progress`, `streaks`, `user_levels`, `user_achievements` (drop policies + revoke). Ningún cliente escribe progreso autoritativo.
- **Catálogo app (`catalog.ts`/`types.ts`):** `Exercise.tier`; **`abdominales`** con `DEFAULT_TARGETS 15` y `REP_CADENCE 3`; `FREE_EXERCISE_ORDER = [sentadillas, flexiones, abdominales]`; **`FEATURE_DATE = 2026-09-28`** (rotación; antes: 7 por goal, desde: solo 3 libres).
- **`service.ts` `buildChallenge`:** branch `date >= FEATURE_DATE` → rota solo en el pool FREE, ejercicio independiente del goal (rel objetivo sigue modulando target). Conserva el algoritmo por objetivo para fechas previas (sincronización tardía).
- **`verify.ts`:** `VERIFY_VERSION = 13`.
- **Edge `validate_workout`:** lee `tier` desde DB; **rechaza premium con `premium_required`** (fail-closed, sin listas hardcodeadas); `ALLOWED_EVIDENCE_VERSIONS = {12, 13}`; deriva el reto esperado usando `goal_history` (fallback a `profiles.goal`); **materializa `daily_challenge_assignments`**; devuelve **`results` por elemento** `{clientOpId,status,reason}`.
- **`syncService.ts`:** respuestas se procesan por elemento; `syncAfterLogin` ya no borra la cola ante rechazos — solo `retainOnlyUnaccepted` (F0: pending/rejected se conservan). `retainOnlyUnaccepted` nuevo en `freeSessions.ts`.
- **`camera-verification.html`:** CFG `abdominales` (lateral, ángulo hombro-cadera-rodilla, `downDelta 25`/`upDelta 10`, `restTorsoMax 35`) + **gate anti-pararse** `standingKneeMargin 0.45` (portado del prototipo) + función `kneeStandingMargin`.
- **i18n es/en/pt:** claves `exercise.abdominales.name/desc`.
- **Tests:** `service.test.ts` (rotación free desde FEATURE_DATE, pool por goal antes) y `syncService.test.ts` (respuestas por elemento) actualizados. **143 tests en verde + typecheck + lint OK.**

**Pendientes PO:** (1) aplicar migraciones 0008–0013 (y la 0014 de la revisión) y desplegar edge `validate_workout`; (2) deploy gh-pages del HTML v13; (3) commit/review de estos cambios.

### 2026-09-28 — Revisión F0 (cross-check): correcciones aplicadas

Revisión de un reviewer independiente sobre el paquete F0. Emparejamiento de cada hallazgo con la evidencia y la corrección:

1. **`profiles.goal` nunca se sincronizaba → la Edge rechazaba TODO reto con `challenge_mismatch`** (crítico, CONFIRMADO): el perfil creado por `handle_new_user` no setea `goal` (0003) y la app guarda el objetivo solo en prefs locales (`prefs/service.ts`), por lo que `profileGoal` quedaba null y `expectedChallenge` no se calculaba. Mitigación en la migración 0014 y la app.
2. **Trigger `maintain_goal_history` podía cerrar la fila del mismo día con `valid_until < valid_from`** (crítico, CONFIRMADO): la rama UPDATE cerraba con `current_date - 1` incluso si la fila abierta tenía `valid_from = current_date`, violando el CHECK. Corregido en la migración 0014 con tres pasos: update en la fila abierta de hoy, cierre de filas anteriores y apertura condicional.
3. **`daily_challenge_assignments` se sovrescribía en vez de consultarse** (importante, CONFIRMADO): la Edge calculaba el reto y hacía upsert sin leer la asignación previa. Ahora la asignación existente es la fuente de verdad y nunca se recalcula ni sobrescribe.
4. **Reto rechazado seguía viéndose como completado localmente** (importante, CONFIRMADO): se persistió el veredicto por fecha (`completedStatus:<date>`), la UI muestra "EN REVISIÓN"/"RECHAZADO" y no se reenvía lo rechazado en bucle.
5. **Elementos inválidos no venían en `results`** (importante, CONFIRMADO): la Edge no reportaba clientOpId de los items inválidos; ahora los incluye como `rejected` con motivo, y la cola de sesiones conserva `status`/`statusReason` (`applySessionResults`).
6. **Sesiones libres sin ventana de fechas** (importante, CONFIRMADO): se aplica la misma ventana de 365 días / sin fechas futuras (`session_date_out_of_window`).
7. **Cámara sin NAME/HOWTO de `abdominales`** (menor, CONFIRMADO): añadidos.
8. **Verificación real inexistente (todo `pending`)** (esperado por diseño hasta F1, no corregido): el rankings se reabre solo con un validador real; mientras tanto la UI es honesta ("enviado para validación", nunca "verificado").
9. **BITACORA con caracteres corruptos + conteo** (menor, CONFIRMADO): este bloque se reescribió con UTF-8 correcto.

**Cambios aplicados en la corrección:** migración `0014_fix_goal_sync_and_history.sql`; edge (asignación leída primero + inválidos en `results` + ventana de fechas en sesiones); app (`completions.ts` con estado de sync, `syncService.ts` con `syncGoalToServer` + no reenvío de rechazadas, `freeSessions.ts` con `applySessionResults`, `retos.tsx` con labels pending/rejected, i18n ×3); cámara (NAME/HOWTO `abdominales`).

**Verificación tras la corrección:** typecheck OK, lint OK, **145 tests / 12 suites en verde**.

### 2026-09-28 — Ronda 2 de revisión F0: reintento real, sesiones rechazadas y goal_snapshot autoritativo

Segunda revisión (3 hallazgos importantes + riesgos menores). Todos atendidos:

1. **Reto rechazado no se podía reintentar de verdad** (importante, CONFIRMADO): la cámara quedaba oculta (`done[date]=true`) y `markCompleted` abortaba si la fecha ya estaba marcada; el botón solo llevaba a Modo libre. Corregido: `markCompleted` acepta `{ retry: true }` (no cuenta dos veces el día y resetea el veredicto a `pending` para que el edge revalide); `retos.tsx` muestra "REINTENTAR RETO" (`home.retry`, i18n ×3) cuando `todayState.status === 'rejected'` y reabre la WebView del reto diario real.
2. **Sesiones libres rechazadas se reenviaban en cada sync** (importante, CONFIRMADO): `syncAfterLogin` subía todas las sesiones sin filtrar por `status`. Corregido: solo se suben las no rechazadas; las rejected se conservan localmente con su motivo (la UI puede mostrarlas) pero no vuelven a la cola.
3. **La asignación no usaba su `goal_snapshot` como objetivo** (importante, CONFIRMADO): la edge comparaba `item.goal` contra `goal_history`/perfil actual en vez de contra el objetivo con que se creó la asignación, pudiendo rechazar un reto legítimo tras un cambio de objetivo. Corregido: al validar contra una asignación existente se usa su `goal_snapshot` como objetivo autoritativo (fallback a historial solo si el snapshot falta/inválido).
4. **`tierGate` fail-closed reforzado** (menor): ahora rechaza (`premium_required`) cualquier tier distinto de `free`, no solo `'premium'`, protegiendo ante tier desconocido/NULL.

**Tests añadidos:** `markCompleted` retry (resetea rejected→pending, no doble conteo, no pisa `verified`), `uploadCompletions` no reenvía rejected salvo retry, `syncAfterLogin` no sube sesiones rechazadas, las conserva localmente y llama `set_goal` con el objetivo local. **Verificación: typecheck OK, lint OK, 153 tests / 12 suites en verde.**

**Pendientes PO** (se mantienen): aplicar migraciones 0008–0013 + 0014, desplegar edge, deploy gh-pages del HTML v13, y decidir commit/review. Nada fue commiteado ni pusheado.

### 2026-09-28 — Invariante `verified` terminal (cierre server-authoritative)

La guarda client-side en `setCompletionSyncState` (no sobrescribir `verified`) se elude con reinstalación, multi-dispositivo, reset o un cliente alterado. Para cerrar el sistema server-authoritative, `verified` ahora es terminal en TODAS las capas:

1. **Migración `0015_protect_verified_submissions.sql`** (nueva): trigger `protect_verified_submission` BEFORE UPDATE en `workout_submissions` y `daily_challenge_submissions` que aborta cualquier UPDATE que cambie una fila `verified` a otro estado (`raise exception`, errcode 23514). Es un invariante a nivel DB: no importa quién escriba (edge, servicio futuro, bug), una fila aprobada no puede degradarse.
2. **Edge `validate_workout`**: antes de upsertar sesiones o completions, encuesta el estado guardado y **no re-escribe** filas ya `verified`; en `results` devuelve `accepted`/`already_verified` para que el cliente quede en `verified` (idempotencia ante re-sync/reinstall sin degradar).
3. **Cliente `uploadCompletions`**: además de las `rejected`, ahora saltea las fechas `verified` (no reenvía lo confirmado). Sumado a la guarda de `setCompletionSyncState`, el cliente nunca degrada un `verified` local, y el retry de `retos.tsx` solo está disponible en estado `rejected`, no sobre `verified`.

**Prueba de cierre (breaker de degradación):** nuevo test `uploadCompletions` no reenvía una fecha `verified` (server-authoritative).

**Verificación:** typecheck OK, lint OK, **154 tests / 12 suites en verde**.

### 2026-09-28 — Sensor de orientación reparado (bridge nativo, validado en Reto diario y Libre)

**Problema:** la cámara verificada no arrancaba automáticamente al entrar a Retos/Libre. El sensor se confirmaba solo tras tocar "Reintentar" (un gesto), y el usuario quería cero toques.

**Causa raíz (diagnosticada con evidencia):** el WebView de Expo Go **no entrega eventos `deviceorientation`/`devicemotion` sin un gesto del usuario**. El experimento previo v16/v17 (`gh-pages`) había planteado el puente correcto (HTML exponiendo `window.__resilienciaSetNativeOrientation` + `post('sensor_request')`) pero **la app nunca implementó su lado** (sin `expo-sensors` ni `injectJavaScript`), por eso se revirtió. Además había cache: `VERIFY_VERSION` no subía con cada deploy.

**Solución aplicada (validada por el PO en ambos modos, sin tocar nada):**

- `camera-verification.html` (deploy gh-pages): hook `window.__resilienciaSetNativeOrientation` que resuelve la confirmación; `post('sensor_request')` al arrancar dentro de React Native; `devicemotion` como respaldo; ventana `SENSOR_CONFIRM_MS` **3s → 8s**; auto-reintento único al fallar el primer intento.
- App: `expo-sensors@~57.0.3` instalado; en `retos.tsx` y `camretos.tsx` (ambos WebViews), `DeviceMotion` (intervalo 200ms) calcula la verticalidad (tilt `atan2(z,y) ≤ 35°`) y la inyecta con `injectJavaScript('__resilienciaSetNativeOrientation(...)')`.
- `verify.ts`: `VERIFY_VERSION` 15 → **16** (cache bust).

**Pendiente (una advertencia detectada):** `onPermissionRequest` no está en los tipos de react-native-webview v14 (se conserva su uso en runtime con `any`); la auditoría ya lo marcaba como deuda en la config nativa de cámara (`app.json`) para el APK real. Verificación: typecheck OK, lint OK, **154 tests / 12 suites en verde**. Commits a gh-pages `7d4988f`; cambios de app aún sin commit (pide el PO).

### 2026-09-29 — Ejercicios premium bloqueados en Modo Libre + DECISIÓN: el free no compite en ningún ranking

**Hallazgo (bug real de producto, reportado por el PO):** al entrar con la cuenta, el usuario veía **los 8 ejercicios seleccionables** en Modo Libre, incluidos los 5 premium, sin tener suscripción.

**Causa raíz:** `components/BrandHeader.tsx:94` renderizaba `EXERCISES.map(...)` **sin consultar `tier`**. El campo `tier` existía (catálogo + DB, migración `0012`) pero **nada en la app lo leía para ocultar contenido**: no hay `revenuecat`/`react-native-purchases` en `package.json` ni `isPremium` en el código, así que a efectos de la app **todos los usuarios son free**. El único candado era el `tierGate` del Edge (`premium_required`), es decir: **la app dejaba hacer el trabajo completo (cámara, reps, evidencia) y el server lo rechazaba después, perdiendo la sesión**. Peor experiencia que bloquear de entrada.

**Cambios aplicados:**

1. **Picker de Modo Libre (`BrandHeader.tsx`):** los 5 premium ahora se listan **atenuados, no seleccionables** (`disabled`), con candado 🔒 y un tag `Premium` a la derecha. Solo `sentadillas`/`flexiones`/`abdominales` quedan elegibles. El menú pasó a `flexDirection: 'row'` para separar nombre y tag.
2. **Guard de defensa en profundidad (`camretos.tsx` `startSession`):** si por estado residual (`libreExerciseId`) llegara un premium, **no abre la sesión** y muestra "Este ejercicio es Premium". Evita que una sesión se descarte contra `premium_required` del servidor.
3. **Copy corregido por el PO — "Premium", no "Próximamente con Premium":** la primera versión decía "Próximamente con Premium", que **promete una release futura** y sugiere que el ejercicio "todavía no está listo", cuando en realidad **ya está listo y lo que bloquea es la suscripción**. El PO lo marcó como potentially confuso; se adoptó el tag seco **"Premium"**. Se reservó una clave aparte `header.premium_exercise` ("Este ejercicio es Premium") para el mensaje de bloqueo de `startSession`, que sí necesita texto explicativo.
4. **i18n es/en/pt:** `header.premium_locked` (`Premium`) + `header.premium_exercise` (`Este ejercicio es Premium` / `This exercise is Premium` / `Este exercício é Premium`). Se eliminó la clave `premium_soon` (grep confirma que no quedan residuos).

**DECISIÓN DEL PO (nueva, cierra una tensión del plan vigente):** el modelo free/premium queda así —

|             | Reto diario               | Racha | Ejercicios      | Rankings       |
| ----------- | ------------------------- | ----- | --------------- | -------------- |
| **Free**    | ✅ (rota en el pool free) | ✅    | solo los 3 free | ❌ **ninguno** |
| **Premium** | ✅                        | ✅    | ✅ **los 8**    | ✅ **todos**   |

El **free entrena, se compromete y enciende su racha, pero no aparece en ningún ranking** (ni verificado, ni libre, ni TOTAL) — su retención va por reto diario + racha. El **premium recibe todos los ejercicios, la racha y todos los rankings** — la competencia es el motivo de pago. Se mantiene la regla dura de que **el ranking verificado NUNCA se acelera con dinero** (pagar compra acceso, nunca posiciones).

Esta decisión **reemplaza** el texto anterior del plan que decía "El ranking TOTAL es exclusivo de suscriptores (F1)", que era más débil: dejaba abierta la posibilidad de que el free apareciera en el ranking verificado. Registrada en `docs/equipo/adr/2026-09-29_free-sin-ranking_premium-todo.md` (ADR nuevo, primer ADR del repo) y reflejada en `PLAN_COMPLETO.md` §15.3.

**Consecuencias anotadas:** rankings son Fase 4 (aún no construidos) → **esta decisión se fijó antes de construir, evitaría rediseñar la Fase 4**; el free debe excluirse del ranking **en el backend** (no solo ocultar en UI) → lo implementa [BE] con el gate de entitlements; [DATA] instrumentará la retención del free por **reto completado + racha** (no por posición, que ya no tiene); [UX] debe revisar la primera impresión de 5 candados sobre 8 (riesgo de "demo truncada"/"paywall falso" del análisis de competencia).

**Verificación:** typecheck OK, lint OK, Prettier OK, **154 tests / 12 suites en verde** (sin tests nuevos: el cambio es de gating de UI/estado, no de lógica de dominio). Probado por el PO en Expo Go: reto de hoy habilitado (correcto, siempre free) y solo los 3 libres seleccionables en Libre.

**Pendientes que siguen abiertos:**

1. **Verificar la Edge Function desplegada** — no hay evidencia de que el `tierGate`/`premium_required` esté en la versión en producción de `validate_workout` (se desplegó desde el Dashboard antes de escribirlo). Hoy es menos urgente porque la app ya no deja llegar al caso, pero es la barrera del server.
2. **E2E de abdominales completo** — hacer el reto y verificar `daily_challenge_submissions = pending` con `missing_evidence`.
3. **Deuda técnica:** `onPermissionRequest` sin tipar en react-native-webview v14 (funciona en runtime; revisar al construir el APK real).
4. Fases pendientes del plan v4: F1 (entitlements/semántica de ranking, donde se aplica esta decisión en el backend), F2 (paywall mock) y F3 (billing real — `react-native-purchases` **no funciona en Expo Go**, requiere dev build).

### 2026-09-30 — Console: Fase A desplegada y verificada + Fase B (núcleo premium) implementada y probada end-to-end

**Petición del PO:** construir la **ResiliencIA Console** (app admin de escritorio para operar el sistema, probar todos los estados free/premium, simular compras/cancelaciones/expiraciones y asistir con IA). Especificación acordada en `docs/equipo/console_spec.md`. Fases A–E; arrancamos con **Fase A** (base segura) y seguimos con **Fase B** (núcleo premium).

**Fase A — Base segura (implementada, desplegada y probada en producción):**

- **Migración `0016_admin_console_base.sql`:** `admin_users` (allowlist por rol `director|support|analyst`, sin RLS cliente), `entitlements` (RLS select-own; el usuario solo lee el suyo, nunca escribe), `admin_audit_log` (bitácora de acciones privilegiadas, sin acceso cliente), `app_config` y `feature_flags` (solo lectura para autenticados; escritura administrativa), helper `has_active_entitlement` (SECURITY DEFINER, **revocado a public/anon/authenticated** — no es oráculo; solo `service_role` lo ejecuta) + triggers `touch_updated_at`.
- **Migración `0017_admin_console_audited_writes.sql`:** RPCs `admin_set_config`/`admin_set_flag` que hacen **la escritura y su auditoría dentro de la misma transacción** (fail-closed) y **revalidan el rol dentro de la DB** (defensa en profundidad): si el audit falla, la escritura revierte; un bug de autorización en la Edge no alcanza para saltarse el control. También `admin_assert_role`.
- **Edge Function `admin_console`:** auth JWT → allowlist `admin_users` → 403 fail-closed si no es admin → ejecuta con `service_role` server-side → audita. Acciones Fase A: `whoami`, `list_config`, `list_audit`, `set_config`, `set_flag`. Correcciones sobre el borrador: parseo booleano **estricto** (`Boolean("false")` era `true`), lecturas ya no tragan errores (devuelven 500), lecturas auditadas best-effort, `reason` normalizado.
- **Bootstrap:** el PO se insertó como `director` vía SQL Editor (la tabla no es accesible desde el cliente, como corresponde). Usuario de prueba `admin-test@ejemplo.com` para el test.
- **Script `scripts/test_admin_console.ps1`:** login → whoami → set_flag → list_audit → (c) 403 no-admin. Fase A verificada en producción: director 200 + escritura visible en `admin_audit_log`; sin rol → **403 en todas las acciones**.

**Fase B — Núcleo premium (implementada y probada end-to-end `free → premium → expirado`):**

- **Migración `0018_admin_console_entitlements_lifecycle.sql`:** tablas `subscriptions` (por `(user_id, product_code)`, con estado `active|in_grace_period|expired|cancelled|refunded|paused` y `will_renew`) y `purchases` (`rc_event_id` unique, anti-replay; `is_simulation` y `source`). RPCs `admin_grant_entitlement` / `admin_revoke_entitlement` (director-only, transaccionales, auditadas) y `admin_sim_lifecycle`: simulador del ciclo completo — `purchase` (mensual 30d / anual 365d), `trial_start` (**7 días, SOLO anual**, D-B), `renew`, `cancel` (no revoca; conserva acceso hasta expirar), `expire` (revoca al vencer), `refund` (revoca), `billing_issue` (gracia, no revoca), `transfer`, `restore`. Todo lo simulado queda `is_simulation=true` y `source='simulation'` — **nunca cuenta como caja/MRR** [FIN]. Todas las RPCs auditan + validan rol dentro de la DB, y quedan revocadas para cliente.
- **Edge `admin_console` (v2):** acciones `list_entitlements`, `grant_entitlement`, `revoke_entitlement`, `sim_lifecycle`. `support` solo lista (sin dinero); `director` administra.
- **Edge `validate_workout` (v2):** el `tierGate` ahora es `premium_required` **salvo que el servidor confirme un entitlement activo** (`has_active_entitlement(user, 'premium')`, consultado por request, fail-closed: ante error se trata como free). **Esto desbloquea premium de verdad en el server.** De regalo, resolver pendiente histórico: queda desplegada la versión exacta del repo.
- **App móvil:** nuevo `src/premium/entitlements.ts` (lee `entitlements` vía RLS select-own con el cliente público; **fail-closed**: cualquier error = no premium; caché 60s) + `src/premium/usePremium.ts` + 6 tests. `BrandHeader` (picker de Modo Libre desbloquea los 5 premium si entitlement activo) y `camretos.tsx` (`startSession` permite premium solo con entitlement; las defensas en profundidad anteriores se mantienen).

**Verificación Fase B (script ampliado, pasos 7–11 contra la API en producción):** `sim_lifecycle purchase` → 200; `validate_workout` con `plancha` → **corre sin `premium_required`**; `sim_lifecycle expire` → 200; `validate_workout` de nuevo → **`premium_required` (fail-closed)**; `list_entitlements` muestra el entitlement vencido. Auditoría registra todas las acciones.

**Verificación general:** typecheck OK, lint OK, Prettier OK, **160 tests / 13 suites en verde** (+6 nuevos de premium). Commits: Fase A `8363af5`; Fase B (este registro incluido) pusheado a `main`.

**Pendientes abiertos:**

1. **Fase C de la Console** — pagos simulados con monto/recibo + replay RevenueCat, edición de `FEATURE_DATE`/pool free/catálogo desde la consola (dinámico, sin redeploy).
2. **La Console Electron en sí** — hasta acá lo construido es la base de servidor (Edge Functions + migraciones + gates). Falta la app de escritorio que usa estas funciones (módulos B–L de la spec).
3. **Rankings (Fase 4 del plan) y su gate de entitlement** — el free no compite en ningún ranking (decisión ya fijada; aplicarla en backend al construir).
4. **Deuda técnica:** `onPermissionRequest` sin tipar en react-native-webview v14 (revisar al construir el APK real).
5. **E2E de abdominales completo** (retenido por F0) y verificación de `missing_evidence` en `daily_challenge_submissions`.

### 2026-09-30 — Console Electron: la app de administración (núcleo operativo)

**Petición del PO:** la **ResiliencIA Console** como app de escritorio real en Windows, con acceso directo en el escritorio, y los módulos para operar usuarios, suscripciones y el simulador del ciclo premium. "Recuerda que estamos haciendo la aplicación de admin."

**Qué se construyó — `apps/console` (Electron + React 19 + TS 6, bundleado con `electron-vite`):**

- **Arquitectura thin-client:** la app nunca toca la DB. Habla únicamente con la Edge Function `admin_console` (ya desplegada en Fase A/B) usando el **JWT del admin logueado**. La `service_role` no existe en esta app. Los permisos del lado servidor (`PERMISSIONS`) son la frontera real: analyst/support solo leen; director escribe.
- **Procesos separados con seguridad por defecto:** main (`src/main/`), preload (`src/preload/`, expone una API mínima vía `contextBridge`), renderer (React). `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, ventana de login en partición aislada (`oauth-google`), `window.open` denegado, navegación a otros orígenes bloqueada, CSP estricta en `index.html`.
- **Login con Google (OAuth + PKCE):** el renderer pide la URL de autorización; el proceso principal abre la ventana de Google, **intercepta la redirección** hacia `http://127.0.0.1:5173/auth/callback` (nunca llega a navegar), le pasa el `code` al renderer y este hace `exchangeCodeForSession`. El verifier PKCE queda en memoria del client.
- **Sesión en el keychain:** con `persistSession: false` el cliente no toca localStorage; la sesión se guarda **cifrada con `safeStorage` (keychain del SO)** en `console-session.bin` dentro de `userData`, con clear automático si es inválida o expira (fail-closed). Sin `safeStorage` → no se persiste.
- **Pantallas:**
  - _Inicio_: rol, user_id, notas de seguridad.
  - _Suscripciones & Simulador_: listar entitlements (por user o todos), y para **director** el simulador con los 9 eventos (`purchase`, `trial_start` 7d-solo-anual, `renew`, `cancel`, `expire`, `refund`, `billing_issue`, `transfer` con destinatario, `restore`) + **otorgar/revocar** premium manual (con vencimiento opcional). Todo con campo **Motivo (se audita)**.
  - _Config & Flags_: toggles de flags para director (piden motivo), lectura de `app_config`.
  - _Auditoría_: últimas 100 acciones de `admin_audit_log` con payload y motivo.
- **Contratos tipados** (`lib/adminApi.ts`, `lib/types.ts`) espejando exactamente la Edge Function desplegada; errores del server traducidos a español (`messageFor`), incluyendo hints.
- **Tests nuevos (11):** catálogo del simulador (invariantes: 9 eventos, trial solo anual D-B, productos) y cliente API (fail-closed, clasificación de errores, hints). Suite total del repo: **240 tests verdes** (mobile 160, domain 69, console 11).
- **Acceso directo:** `launch-console.cmd` (arranca `pnpm dev` desde `apps/console`) + acceso directo _ResiliencIA Console_ creado en el escritorio (OneDrive) → consola minimizada, ventana de Electron visible.

**Verificación previa al commit:** `tsc --noEmit` en los 4 paquetes ✓, `electron-vite build` (main/preload/renderer) ✓, 240 tests ✓, prettier ✓. El CI corre igual al pushear.

**Notas técnicas / incidentes:**

- TS 6.0 deprecó `baseUrl` → se usan `paths` relativos (`./src/*`) en `apps/console/tsconfig.json`.
- El alias `@console/*` va configurado en **main, preload y renderer** de `electron-vite` (si falta, el bundle del main no resuelve los imports compartidos).
- Flat config: `@types/react`/`@types/react-dom` pinneados a `~19.2.x` (peers de React 19.2.3).
- **`@babel/runtime` agregado a devDependencies de mobile**: tras `pnpm install` quedó huérfano en el store (sin symlink en `apps/mobile/node_modules`) y jest no podía resolver `interopRequireDefault`; con la devDep explícita la suite vuelve a 160 verdes.
- En la raíz, `pnpm.onlyBuiltDependencies: ["electron", "esbuild"]`: pnpm v10 bloquea los postinstall (binario de Electron/esbuild); con esto el binario se descarga. Dejado así deliberadamente para que funcione el dev de la console.

**Deuda técnica (pendiente):**

1. **El PO debe dar de alta el redirect URL** `http://127.0.0.1:5173/auth/callback` en Supabase → Auth → Redirect URLs. Sin eso el login con Google no completa (primer paso para probar hoy hace falta esto).
2. Bundle del renderer ~1.3 MB pre-gzip (supabase-js): aceptable para escritorio; si molesta, `dynamic import` del módulo de auth.
3. Spec plantea "login email + MFA"; la v1 de la Console usa el OAuth de Google ya existente (single sign-on de la cuenta del director). Revisarlo con el PO.
4. Empaquetado .exe (electron-builder) e ícono propio — hoy se usa dev server + acceso directo.
5. Fase C de la Console: pagos simulados con monto/recibo, catálogo y `FEATURE_DATE` editables sin redeploy, y replay de eventos RevenueCat.

### 2026-09-30 — Console Electron: login probado en vivo + fix del flujo OAuth (PKCE)

**Petición del PO:** probar el login de la app Electron ya con el redirect URL dado de alta en Supabase Auth (`http://127.0.0.1:5173/auth/callback`).

**Problema encontrado en la prueba en vivo:** Google pedía el 2FA (confirmación por celular), pero al confirmar la app no ingresaba: _"El proveedor no devolvió el código de autorización."_

**Root cause (hallazgo):** el `@supabase/auth-js@2.116.0` instalado usa **`flowType: 'implicit'` por defecto**, así que el OAuth volvía con los tokens en el **fragmento** de la URL (`#access_token=...&refresh_token=...`) y NO con `?code=`. El intercambio PKCE (`exchangeCodeForSession`) nunca veía `code`.

**Fix aplicado:**

1. `createClient(..., { auth: { flowType: 'pkce' } })` — PKCE forzado, el callback vuelve con `?code=` y el exchange funciona.
2. `exchangeOAuthCode` resiliente: acepta `code` de la query; reporta `error`/`error_description` del proveedor con mensaje claro; y como respaldo, si vienen `access_token`/`refresh_token` en el fragmento (flujo implícito), arma la sesión con `setSession`.
3. `oauth.ts` (main): intercepta el callback **solo cuando la URL trae material de auth** (`code`, `error` o token en fragmento), con un fallback de 3s para no cortarse ante hops intermedios vacíos hacia nuestro origen.

**Verificado:** el PO entró a la app con su cuenta de director (2FA por celular incluido) → panel con rol **director**. Queda probado el flujo de login de punta a punta (Electron → Google → PKCE → keychain → whoami).

**Pendiente para mañana:** probar a fondo la app (simulador del ciclo premium, auditoría, comportamiento con roles analyst/support), y opcional empaquetar un `.exe` con ícono para dejar de depender del dev server.

### 2026-09-30 — Fase E Nivel 1: "Copilot del Director" integrado en la Console (IA on-device, gratis)

**Petición del PO:** responder si la IA ya estaba integrada en la Console y, en todo caso, construirla. Regla de producto fijada por el PO: el modelo SIEMPRE debe estar pensado para correr en el celular **gratis, on-device** (sin API de pago); se prueba primero en la PC dentro de la Console (llama.cpp/GGUF); el motor se integra ya; y por el "equipo" (roles) se arma su **hardcore** (harness de evaluación): marcar respuestas malas/buenas para ir condicionando el comportamiento.

**Respuesta y análisis previo:**

- No había IA integrada; era la Fase E de `console_spec.md` ("L. Copilot del Director", 4 niveles). El análisis de `docs/plan/IA_ENTRENADOR.md` recomienda **Qwen3.5-2B-Instruct Q4_K_M (~1.5 GB)** por GGUF/llama.cpp, Apache-2.0, patrón **ContextBuilder** (la IA nunca consulta datos por sí sola; el contexto se le inyecta por código).
- Verificado en HuggingFace: el GGUF público de Qwen3.5 da HTTP 401 (repo no accesible); **`ggml-org/Qwen3-1.7B-GGUF` / `Qwen3-1.7B-Q4_K_M.gguf` (~1.28 GB) confirmado** (Apache-2.0, chat template qwen3). Decisión: motor agnóstico (repo+archivo editables en la UI), default = Qwen3-1.7B; el dataset de evaluación queda 100% transferible a Qwen3.5 cuando haya GGUF.

**Implementado (Nivel 1, `apps/console`):**

- **Engine en `src/main/copilot.ts`:** `node-llama-cpp@3.22.1` con `getLlama({gpu:'vulkan'})` + fallback CPU; sesión de chat con `setChatHistory` + streaming de tokens por IPC; descarga del modelo con progreso (fetch streaming → `userData/models`); selección de `.gguf` por diálogo; carga con dedupe (una sola promesa compartida); generación serializada con cola y cancelación (AbortController); estado `ready` (descargado sin cargar) + IPC `prepare` para cargar a demanda; persistencia `copilot-state.json` (`modelPath`). `node-llama-cpp` queda como módulo nativo external en `electron.vite.config.ts`.
- **Contrato `src/shared/copilot.ts`:** canales IPC, `CopilotStatus`, `DEFAULT_SYSTEM_PROMPT` con `{contexto_json}`, `GUARDRAILS_FIXED`, presupuesto de prompt `TOKEN_BUDGET=1200` (mismo tope objetivo del celular), respuesta máx 512 tokens (configurable 64–2048), temp 0.4 default.
- **Renderer:** `lib/copilot/prompt.ts` (contexto + few-shots + historia podada al presupuesto, resumen de tokens), `store.ts` (persistencia de config/few-shots/ratings; promover respuesta buena a ejemplo; exportar dataset JSON), `client.ts` (**ContextBuilder**: arma `{contexto_json}` vía `admin_console` con rol, flags, config, entitlements activos/vencidos/simulados y últimas acciones de auditoría). UI `console/Copilot.tsx` con pestañas Chat / Ajustes / Evaluaciones: chat con streaming, botones **Correcta/Inapropiada** con nota (harness de feedback), editor del system prompt en vivo, setup del modelo. Tab "Copilot IA" en `ConsoleShell.tsx`.
- **PUENTE visible:** `window.consoleCopilot` (`preload` + `shared/api.ts`). La app de escritorio (no la web) expone el puente; el flag `hasCopilot` lo refleja.

**Verificado:**

- Typecheck OK (4 paquetes), prettier OK, **262 tests en verde** (mobile 160, domain 69, console 33: 22 nuevos de `copilotPrompt`/`copilotStore`).
- **Smoke test headless** (`apps/console/scripts/smoke_copilot.mjs`): descarga real del modelo, carga con Vulkan, generación en español ~9.8 s y respuesta coherente con el contexto inyectado ("5 vs. 3").
- Modelo pre-colocado en `userData` (`C:\Users\Anibal\AppData\Roaming\@resiliencia\console\models\Qwen3-1.7B-Q4_K_M.gguf`) + `copilot-state.json` con su `modelPath` → la app lo detecta `ready` al arrancar (verificado: Electron arranca con los 3 procesos sin crash).

**Pendientes / planes:**

1. El PO prueba en vivo: `pnpm --filter @resiliencia/console dev` → pestaña **Copilot IA** → cargar el modelo (ya está `ready`) → chat → marcar respuestas (harness) → exportar dataset.
2. Niveles 2+ de la Fase E (spec: más herramientas/harness) cuando el PO los pida; swap a **Qwen3.5** cuando su GGUF sea accesible; port móvil on-device queda fuera del alcance actual de la Console.
3. Commit pendiente de decisión del PO (estos cambios de hoy NO están commiteados).

### 2026-09-30 — Fix: crash de la Console al abrir ("A JavaScript error occurred in the main process")

**Síntoma (reportado por el PO):** al ingresar a la Console aparecía un cartel de Electron: _Uncaught Exception: Error require() cannot be used on an ESM graph with top-level await_.

**Causa raíz:** el bundle del proceso main sale en **CommonJS** (`apps/console/package.json` sin `"type": "module"`), y `node-llama-cpp` quedó externalizado en `electron.vite.config.ts`, así que rollup convertía el import estático a `require("node-llama-cpp")`. Ese paquete es **ESM-only con top-level await** → `require()` explota al arrancar la app.

**Fix (`apps/console/src/main/copilot.ts`):** el módulo se carga ahora con **`await import('node-llama-cpp')` dinámico** dentro de `loadModel`, en vez de import estático. El `require()` ya no existe (verificado en `out/main/index.js`), el binario nativo solo se carga cuando se usa el modelo, y el arranque no se rompe más.

**Verificación:** typecheck OK, 33 tests console / 262 repo en verde, build OK; instancia vieja cortada y Console relanzada: main + renderer activos, stderr vacío. Commits: `3f48e2b` (módulo Copilot) y `32c30f2` (fix del crash).

### 2026-09-30 — Fix: la Console volvía a pedir Google login en cada apertura (refresh token rotado no se persistía)

**Petición del PO:** _"¿no hay manera de entrar a la Console y que recuerde mi usuario/contraseña y el permiso del celular para no repetir los pasos cada vez?"_

**Análisis:** la persistencia de sesión **ya existía** (keychain cifrado del SO vía `safeStorage` → `console-session.bin`), pero fallaba a la segunda apertura. En `GoTrueClient._setSession` (`.pnpm/.../GoTrueClient.js:3046`) se confirmó la causa: cuando el access token expiró (>1h, default de GoTrue), `setSession()` hace un refresh y **GoTrue ROTA el refresh token** (el presentado queda revocado) pero el keychain seguía guardando el viejo → en el próximo arranque `restoreSession` fallaba con `refresh_token_not_found` → te obligaba a Google + 2FA de nuevo. También `autoRefreshToken: true` rotaba el token en memoria durante sesiones largas sin actualizar el keychain.

**Fix (`src/renderer/src/lib/session.ts` + `App.tsx`):**

- `restoreSession()` ahora **re-persiste la sesión devuelta por `setSession`** (que trae el refresh token rotado) antes de devolverla.
- Nueva `subscribeSessionPersistence()`: suscribe a `onAuthStateChange` y persiste la sesión en cada evento de auth (TOKEN_REFRESHED incluido), de modo que el keychain siempre tenga el refresh token vigente. Se suscribe en el `boot` de `App` y se desuscribe al desmontar.
- La ventana de OAuth ya usaba una partición persistente (`oauth-google`), así que las cookies de Google (cuenta/2FA confiable) sobreviven entre inicios.

**Efecto esperado:** el primer ingreso tras el fix puede pedir un login de Google más si el refresh token guardado ya quedó revocado; a partir de ahí, **abrir la Console reentra solo** (sin usuario, contraseña ni 2FA), incluido tras reinicios de la PC. El botón "Cerrar sesión" sigue borrando el keychain a propósito.

**Verificación:** tests nuevos en `session.test.ts` (restore persiste el token rotado; limpieza ante error; suscripción persiste refrescos y no escribe sesiones nulas) → **38 tests console / 267 repo en verde**; typecheck OK; Console relanzada sin crash (main + renderer activos).

### 2026-09-30 — Fix: la Console decía "Sin modelo" con el modelo ya descargado (BOM en copilot-state.json)

**Síntoma (reportado por el PO):** la pestaña Copilot mostraba "Primera vez con el Copilot / Sin modelo" aunque el `.gguf` ya estaba descargado en `userData\models`.

**Causa raíz (hallazgo con evidencia):** `copilot-state.json` (que apunta al archivo del modelo) empezaba con **BOM UTF-8** (`EF BB BF`) — el archivo se había creado a mano con PowerShell, que escribe BOM por defecto. `readPersistedModelPath()` hacía `JSON.parse(raw)` y el BOM lo hacía fallar en silencio → `modelPath = null` → estado `no-model`. El archivo del modelo en sí nunca fue el problema.

**Fix (doble):**

1. `src/main/copilot.ts` `readPersistedModelPath()`: quita un BOM inicial antes del `JSON.parse` (`raw.replace(/^\uFEFF/, '')`) — defensa ante editores/tools de Windows. El `writeFile` de la app ya escribe sin BOM.
2. Reescrito `copilot-state.json` sin BOM (ahora arranca con `{`).

**Modelo elegido (revisión de la doc `IA_ENTRENADOR.md`):** la mejor para Android es **Qwen3.5-2B-Instruct Q4_K_M (~1.5 GB)** pero su GGUF público sigue dando HTTP 401 (no descargable); la adoptada como default es **`ggml-org/Qwen3-1.7B-GGUF` · `Qwen3-1.7B-Q4_K_M.gguf` (1.28 GB exactos)** — segunda opción de la tabla del doc (gama media 4–6 GB RAM) y la que ya está bajada y funcionando. El dataset del harness se transfiere tal cual a Qwen3.5 cuando haya GGUF público.

**Verificación:** typecheck OK, **38 tests console / 267 repo en verde**; archivo de estado validado sin BOM; Console relanzada con renderer activo y el modelo detectado como `ready` (se muestra "Motor: descargado — Cargar modelo").

### 2026-09-30 — Copilot: responder como operador, no como suscriptor (fix de identidad)

**Síntoma (reportado por el PO):** al preguntarle al Copilot _"¿es recomendable pasarme a premium?"_, respondió tratando al director como usuario final: _"tu suscripción es gratuita, no podés acceder a contenido premium"_. Dos fallas: confundió al interlocutor (el director que opera la Console) con un suscriptor de la app, y **inventó un dato** ("tu suscripción es gratuita") que no está en el contexto del turno.

**Fix (`apps/console/src/shared/copilot.ts`):**

- **`GUARDRAILS_FIXED`** (reglas que no puede ignorar, siempre presentes): el interlocutor es el director/admin que opera la Console, NO un suscriptor; si pregunta por su "suscripción"/"pasarme a premium" se interpreta como decisión de negocio y jamás se le atribuye un plan salvo que el contexto lo diga.
- **`DEFAULT_SYSTEM_PROMPT`**: línea de rol aclarando que las preguntas de "premium/mi suscripción" se responden desde el rol de quien opera la app (análisis y propuestas de negocio).

**Uso del harness (recomendación al PO):** marcar la respuesta mala como **Inapropiada** con la nota correspondiente en la pestaña Chat/Evaluaciones: el ejemplo queda registrado en el dataset y sirve para condicionar el comportamiento. Verificación: typecheck OK, 38 tests console en verde.

**Rectificación del PO (mismo día):** la respuesta NO debe tratar la pregunta como análisis de negocio del operador. Cuando el director pregunte en **primera persona** por "premium"/"pasarme a premium", el Copilot debe ponerse **del lado del usuario** de la app y **motivar la subscripción detallando qué recibe**. Se ajustó:

- **`GUARDRAILS_FIXED`**: línea que hace explícito el modo usuario (motivar + detallar beneficio) y mantiene el "no atribuir plan actual salvo que el contexto lo diga".
- **`DEFAULT_SYSTEM_PROMPT`**: nuevo bloque **"Premium (qué incluye)"** con los beneficios reales del producto (los 8 ejercicios — 3 free + 5 premium —, todos los rankings y el ranking TOTAL, precios US$2.99/mes o US$19.99/año ≈ US$1.67/mes −44%, prueba 7 días solo anual) para que el modelo concrete los beneficios sin inventar. Tono motivador y sin prometer lo que el producto no da.

Verificación: typecheck OK, **38 tests console / 267 repo en verde**.

### 2026-09-30 — Copilot: avanzar el flujo cuando el usuario acepta (ya no repite la propuesta)

**Síntoma (reportado por el PO):** tras la corrección anterior, "¿es recomendable pasarme a premium?" respondió bien (motivación + beneficios + "¿te gustaría probarlo?"), pero al contestarle "sí", **repitió el mismo texto completo** en vez de avanzar al siguiente paso.

**Fix:**

1. **`DEFAULT_SYSTEM_PROMPT`** (regla de avance): si el usuario ya aceptó ("sí", "dale", "quiero"), **no repetir la propuesta ni los beneficios**; pasar al paso concreto y corto (activar la prueba gratis de 7 días del plan anual en la app, o verificar el entitlement desde la Console si es una prueba) y cerrar con "¿Algo más?".
2. **Few-shots de arranque** (`defaultFewShots()` en `store.ts`): ejemplo del flujo completo premium instalado por defecto (consulta → pitch con beneficios → "Sí" → siguiente paso). Visible y editable/deleatable en Ajustes.

Verificación: typecheck OK, **39 tests console / 268 repo en verde**.

### 2026-09-30 — Copilot: cortar el bucle de "¿quieres activarlo?" tras aceptar

**Síntoma (reportado por el PO):** tras el fix anterior, el flujo mejoró pero entró en **bucle**: con cada "si" el Copilot volvía a responder "¡Dale! Activa el plan anual… ¿Quieres activarlo?", re-preguntando lo mismo en cadena en vez de cerrar.

**Fix:**

1. **`defaultFewShots()`** (`store.ts`): el ejemplo "Sí → próx paso" ahora **termina sin pregunta**, con instrucción concreta única ("abrí la app → Premium → plan anual → confirmá; la prueba no cobra hasta el día 8" + "avisame cuando esté activo y lo verifico desde la Console"). Se rompe el patrón que el modelo imitaba.
2. **`DEFAULT_SYSTEM_PROMPT`** (regla de avance endurecida): al aceptar, **una sola vez** el paso concreto, sin repetir beneficios, sin preguntas de sí/no repetidas, cerrando con instrucción accionable; la conversación termina cuando ya se dio la instrucción.

Verificación: typecheck OK, **39 tests console / 268 repo en verde**.

### 2026-09-30 — App `exercise-tester`: banco de pruebas de cámara e inclinación (fase de calibración)

**Petición del PO:** una app aparte, sin tocar `apps/mobile` ni Supabase, para poder **comprobar en un teléfono real que los ejercicios libres y la prueba de vida se completan**, y ajustar los umbrales antes de portarlos a ResiliencIA.

**Decisiones:**

- Nueva app Expo SDK 57 en `apps/exercise-tester`, workspace `@resiliencia/exercise-tester`, corriendo en **Expo Go** (sin build nativo, sin assets custom).
- **Arquitectura:** `expo-camera` captura un snapshot cada ~700 ms y un **WebView oculto** corre MediaPipe Pose Landmarker (WASM/GPU desde CDN, fallback CPU) para extraer landmarks. Se descartó analyze-once por frame porque en Expo Go no hay frames continuos de cámara.
- **Fidelidad con producción:** todo se replica desde `camera-verification.html` (el motor real), no desde el prototipo: `VIS=0.65`, ventanas de suavizado 5/7, `CALIB_WINDOW=10`, `CALIB_RANGE_MAX=9`, `MIN_REP_INTERVAL_MS=350`, `CONFIRM_FRAMES=4`, vertical `atan2(|z|,|y|) ≤35°` durante 8 s.
- El motor de conteo quedó **portable y testeable** (`src/lib/`): `exercises.ts` (catálogo), `pose.ts` (geometría), `tilt.ts`, `repEngine.ts` (máquina de estados + telemetría por rep), `liveness.ts`, `report.ts`.
- Cada rep guarda **rep, ángulo de fondo, pico, valle, amplitud y duración** para poder ajustar umbrales con datos, y el resultado se exporta como JSON.

**Correcciones al replicar producción (encontradas auditando `camera-verification.html`):**

1. **Geometría de sentadillas equivocada:** el tester medía el segmento cadera-rodilla contra la horizontal. Producción usa `angleBetween(hip, knee, ankle)` —ángulo de rodilla— sobre **las dos piernas**, con `max` para abajo y `min` para arriba.
2. **Guarda de asimetría ausente:** producción bloquea si `|izq−der| > 35°`. Se agregó el gate `asimetria`.
3. **Ángulo de flexiones equivocado:** se usaba cadera-rodilla; producción mide `angleBetween(shoulder, elbow, wrist)` —ángulo de **codo**—, por eso el perfil lateral necesita codo y muñeca visibles.
4. **Abdominales:** el triángulo correcto es `shoulder → hip → knee`.
5. **Orientación de umbrales invertida** en sentadillas: "abajo" es ángulo **menor** en perfil absoluto y **mayor** en perfil de deltas.
6. **Liveness `hold`:** comparaba siempre `< threshold`; ahora respeta el perfil del ejercicio y acumula 2 s reales.
7. **Telemetría con amplitud negativa:** peak/trough se inicializaban mal; ahora se trackea `max`/`min` y la amplitud es siempre positiva.
8. **Telemetría ausente en ejercicios sin calibración:** `restAngle` pasó a `number | null` (antes solo se emitía si estaba calibrado, así que en sentadillas nunca había datos).
9. **Puntos requeridos por ejercicio** centralizados en `LATERAL_POINTS`, copiando `sides[].points` del prototipo.

**Tests:** se agregó `src/__tests__/engine.test.ts` con **27 tests** (catálogo, gates, calibración, conteo/intervalo mínimo/asimetría, isométricos, ant-video, vertical, geometría). Los tests estaban mal planteados al principio: ignoraban el suavizado de 5 cuadros, de modo que secuencias cortas nunca cruzaban los umbrales; se reescribieron con bloques de ≥8 cuadros por posición.

**Verificación:** 27 tests en verde, `tsc --noEmit` limpio, ESLint sin warnings, prettier aplicado y `expo export --platform android` correcto (621 módulos, bundle HBC 1.5 MB, sin errores).

**Segunda revisión (antes de la prueba en dispositivo) — 4 desvíos más encontrados:**

10. **Signo de la calibración invertido.** Producción (`:934-936`) calcula `dynamicDownThresh = restAngle - downDelta`; el tester sumaba. Con la corrección, en flexiones un codo de reposo en 30° da abajo −10° y arriba 18°.
11. **Orientación de "abajo" unificada.** En producción "abajo" es ángulo **menor** que el umbral en _todos_ los ejercicios; solo el puente de glúteos lo invierte (`:1686-1692`). El motor pasó a `downIsLess = !cfg.bridge` en vez de basarse en el perfil.
12. **La calibración usaba el ángulo equivocado.** `TestScreen` calibraba el torso horizontal; producción calibra la **métrica del ejercicio** (codo en flexiones, cadera en abdominales) y usa `restTorsoMax` solo como gate previo. Además se restaba el reposo del ángulo crudo, algo que producción no hace: compara el crudo contra umbrales derivados.
13. **Prueba de vida 'hand' mal definida.** Se comparaba la muñeca contra la nariz con margen 0.06; producción (`:980-981`) la compara contra el **hombro** correspondiente con margen **0.05**.
14. **Confirmación de estado:** el prototipo usa `STATE_CONFIRM_FRAMES = 3` (el tester usaba 2); `CONFIRM_FRAMES = 4` para cuerpo visible. Ambos quedaron como constantes exportadas.

**Limitaciones declaradas:** el conteo por snapshots (~700 ms) sirve para calibrar umbrales pero **no reproduce una cadencia rápida**; MediaPipe WASM/modelo se descarga por CDN, así que la primera ejecución necesita internet y no es totalmente offline.

**Pendiente:** prueba física en Android con Expo Go para los 3 ejercicios y la prueba de vida, y recién después portar los ajustes a `apps/mobile`.
---

## Banco de pruebas: catálogo completo (8 ejercicios) y fix de carga de pose

**Punto de partida:** el usuario probó el banco en su Android y la pose no cargaba. Además pidió cubrir los 8 ejercicios de la app, no solo los 3 gratuitos.

### Causa de la pose que no cargaba

El WebView que corre MediaPipe se servía con `source={{ html }}` sin `baseUrl`, o sea desde `about:blank`. Desde ahí el CDN del script, el WASM y el modelo fallan por CORS y la app se quedaba esperando en silencio.

**Cambios:**

1. `source={{ html, baseUrl: POSE_BRIDGE_BASE_URL }}` con origen `https://cdn.jsdelivr.net`.
2. `runningMode: 'IMAGE'` + `landmarker.detect(img)`.
3. Reporte de etapas (arrancando / script / wasm / modelo / lista), `window.onerror` y `unhandledrejection` reenviados a la app, fallback GPU → CPU, y `onError` del WebView.
4. Timeout de 45 s: si MediaPipe no dice `ready`, la app lo dice en vez de quedar en blanco.
5. El WebView era 1x1 con `opacity: 0.01`; Android lo deja en 1 fps o lo congela y la imagen nunca decodifica. Pasó a 2x2 casi transparente y fuera de pantalla.

> El punto 2 fue un parche, no una solución: está registrado más abajo que la causa real de que el modelo no cargara era otra.

### Catálogo completo

Se replicaron los 8 ejercicios de `camera-verification.html:609-764` con `unit`, `kind`, objetivo de `catalog.ts:24-33` y los umbrales exactos. La geometría pasó de `if (id === ...)` dispersos a campos declarativos (`angle`, `knee`, `kneeFold`, `lineMin`, `groundedMax`, `standingKneeMargin`, `points`), resueltos con `angleByNames` y `lateralPoints`, para que agregar un ejercicio no pueda olvidarse de un landmark.

**Cuatro bugs reales encontrados al portar:**

15. **Suavizado de mountain climbers.** El motor suavizaba con ventana 7 (lateral); producción suaviza el ángulo de rodilla con **5** (`:1594`). Con ventana 7 el pliegue nunca cruzaba 105 grados y **no contaba ninguna rep**.
16. **Hold de isométricos invertido en frontal.** El hold lateral es `smoothed > dynamicUpThresh` (`:1669`), pero el frontal es `cand === 'down'`, o sea **ambas rodillas bajo `downThresh`** (`:1450` + `:1420-1422`). El tester aplicaba la regla lateral a los dos, así que la sentadilla isométrica contaba segundos **de pie** y no en sentadilla.
17. **Calibración faltante.** Mountain climbers calibra con `deltas 0/0` (`:1597-1607`) y todo ejercicio en segundos pide "quedate quieto" antes de arrancar (`:1435-1449`), aunque use umbrales fijos. El gate solo cubría el perfil `deltas`, así que ninguno de los dos podía contar. Se unificó en `needsCalibration(cfg)`, usada por el motor y por la pantalla.
18. **Landmarks incompletos en puente.** `sides[].points` del puente pide también el **tobillo**, que el mapa hardcodeado no exigía, y `plancha` y `mountain_climbers` no existían en el mapa: `lateralPoints(cfg, side)` pasó a derivarlos de `cfg.points`.

Además `livenessRequired` comparaba `kind === 'isometrico'` cuando producción usa `unit === 'seconds' || target > 5` (`:768`).

### Discrepancia de mountain climbers (no normalizada)

`camera-verification.html:723` declara `unit: 'reps'` y cuenta una rep por rodilla al pecho. `apps/mobile/src/retos/catalog.ts:20` declara `unit: 'seconds'`. El tester usa `reps` porque reproduce el motor, pero lo deja asentado con `catalogUnit` y el informe lo marca con `[! unidad]` para que no pase despercibido al portar el cambio.

**Tests:** la suite pasó de 27 a **45**, con cobertura por ejercicio (umbrales contra el HTML, tier, unidad, `sides[].points`, índice de `lateralPoints` por lado, isométrico frontal y lateral con y sin calibración, conteo por pliegue con mesetas, y el triángulo genérico `angleByNames`).

**Verificación:** 45 tests en verde, `tsc --noEmit` limpio, ESLint sin warnings.

**Pendiente:** prueba física en Android para confirmar que la pose carga y que los 8 ejercicios cuentan, y resolver la unidad de mountain climbers antes de portar nada a `apps/mobile`.

### Esqueleto y checklist de landmarks (lo que faltaba para ver la postura)

El usuario reportó que no aparecía el esqueleto que sigue el movimiento. Causa: **la app real dibuja el esqueleto y el tester no dibujaba nada**. En producción (`HTML:1699-1731`) un canvas encima del `<video>` pinta `drawConnectors(lm, POSE_CONNECTIONS)` en `#3A4552` y un punto por landmark exigido, verde `#C8FF3D` si `visibility >= VIS`, rojo `#FF5A5A` con anillo si no. El tester tenía la cámara en `expo-camera` (nativa) y el WebView de MediaPipe **oculto**, así que no había canvas donde pintar y el esqueleto nunca existió.

19. **Esqueleto dibujado con Views.** Se agregó `POSE_CONNECTIONS` (las 35 conexiones de `PoseLandmarker.POSE_CONNECTIONS`) y `LANDMARK_LABELS` a `pose.ts`, y `src/components/PoseOverlay.tsx` armaba el mismo grafo con Views absolutas: una por conexión (anclada por el punto medio y rotada) y una por punto exigido, replicando radios 5/6, el anillo de radio 10 y los colores de producción. Se respetaba la proporción real de la foto (`takePictureAsync` devuelve `width`/`height`) con letterbox y centrado, y se espejaba cuando la cámara es frontal, igual que `applyMirror` (`HTML:1734-1737`). Sin dependencias nuevas: no hay `react-native-svg`.
20. **Checklist de landmarks, equivalente a `renderChecklist` (`HTML:1050`).** Un panel rojo abajo decía qué landmark falta por nombre ("falta ver: rodilla izq, tobillo der"). Es lo que permite distinguir "no te ve" de "te ve pero le falta una rodilla", que era imposible diagnosticar antes.

El esqueleto y el checklist se actualizaban **también cuando MediaPipe no devolvía pose**: en ese caso el panel mostraba "sin pose en el frame" o el estado de carga, en vez de congelar el último frame válido.

**Verificación:** 58 tests en verde (13 nuevos de esqueleto, checklist y puntos exigidos), `tsc --noEmit` limpio, ESLint sin warnings, `expo export --platform android` correcto (622 módulos, 1.6 MB).

> Todo este trabajo fue **deshecho** en la sección siguiente: el esqueleto pasó a dibujarse en el canvas del WebView, igual que producción, y `PoseOverlay.tsx` se eliminó.

### CONFIRM_FRAMES no estaba implementado (cuándo se habilita el conteo)

Al comparar el orden de decisión de producción apareció un quinto bug: producción exige `CONFIRM_FRAMES = 4` **cuadros consecutivos** con los landmarks completos antes de habilitar el conteo (`HTML:1405-1408` frontal, `:1519-1520` lateral), y en el medio muestra "Confirmando cuerpo…". El tester solo hacía `bodyOk = checkComplete(...)` de un cuadro: **un solo frame con las rodillas visibles alcanzaba para contar**. El campo `bodyOkStreak` existía en `RepEngineState` pero nunca se leía ni se escribía, y `CONFIRM_FRAMES` estaba exportado sin usarse.

21. **Confirmación de cuerpo implementada.** `processFrame` ahora lleva el streak, satura en `CONFIRM_FRAMES`, y devuelve gate `landmarks` con mensaje "Confirmando cuerpo… n/4" hasta llegar a 4. Cualquier gate roto lo reinicia, igual que `bodyOkStreak = 0` en producción.

**Tests:** 62 en verde (4 nuevos de la confirmación de cuerpo). Los 3 tests que fallaron al agregarlo estaban mal planteados: chamaban un solo cuadro y esperaban un gate de conteo; ahora usan `warmBody()` para pasar los 4 cuadros primero, que es lo que hace la app real.

**Verificación:** 62 tests del tester, 291 del repo, `tsc --noEmit` y ESLint limpios, `expo export --platform android` correcto.

### El modelo de seguimiento no cargaba: la arquitectura estaba mal

El banco nunca cargó el modelo, y la causa no era la red: **la arquitectura era distinta por diseño mío**. `TestScreen` usaba `expo-camera` con `takePictureAsync` en un bucle de ~700 ms, mandaba cada foto en base64 a un WebView **oculto** de 2x2 con `runningMode: 'IMAGE'` + `detect()`. Resiliencia hace otra cosa (`HTML:1906-1959`, `:1760-1770`): todo ocurre dentro del WebView, con un `<video>` real, `getUserMedia`, `runningMode: 'VIDEO'` y `detectForVideo` sobre el stream, deduplicando por `video.currentTime` dentro de un `requestAnimationFrame`.

Además había un bug concreto en el puente: se llamaba a `PoseLandmarker.createFromOptions(vision, ...)` **sin haber asignado nunca `vision`**, porque faltaba el `FilesetResolver.forVisionTasks(WASM_URL)` de `HTML:1810-1814`. Eso es un `ReferenceError` que el `catch` reportaba como `fatal`, y la app se quedaba esperando. El modelo tampoco se descargaba nunca: faltaba el `.task` entero. Y la URL apuntaba a `/float16/1/` en vez de `/float16/latest/` como producción.

**Consecuencia de fondo:** lo que se había "arreglado" en la sección de arriba (`baseUrl`,IMAGE, timeout, WebView 2x2) no era la causa. El `baseUrl` sí era necesario, pero el modelo nunca llegó a intentsarse a descargar.

22. **WebView de pose reescrito como copia de producción.** `src/lib/poseWorker.ts` ahora es el HTML del prototipo: `<video>` + `<canvas>`, `getUserMedia`, `FilesetResolver` + `PoseLandmarker` en `VIDEO`/`numPoses: 1`, `detectForVideo`, `draw()` con `DrawingUtils`, `renderChecklist`, `applyMirror`, `__resilienciaSetNativeOrientation` y `attemptCreate` GPU→CPU con timeout de 20 s. Se exporta como `POSE_VIEW_HTML`.
23. **El WebView pasó a ser la vista de cámara.** Se eliminó el `<CameraView>` nativo y el bucle de capturas: `TestScreen` inyecta `__start` / `__stop` / `__facing` / `__setHighlight` / `__snap` y corre el motor con los landmarks que llegan por el puente a la frecuencia del video. `expo-camera` queda solo para pedir el permiso runtime de `CAMERA`, que es lo que `react-native-webview` necesita para conceder `getUserMedia` (`RNCWebChromeClient.java:143` mapea `RESOURCE_VIDEO_CAPTURE` a `Manifest.permission.CAMERA`; no hace falta `onPermissionRequest`).
24. **Overlay nativo eliminado.** `components/PoseOverlay.tsx` y su test quedaron muertos al pasar el dibujo al canvas; también se borraron `POSE_CONNECTIONS` y `LANDMARK_LABELS` de `pose.ts`, que solo existían para armar el esqueleto con Views. Ahora el esqueleto se dibuja con `DrawingUtils` como en producción.
25. **Cuarto deadlock corregido.** El botón "Iniciar" exigía que MediaPipe ya estuviera `ready`, pero `ready` solo se emitía dentro de `startCamera()`, que era lo que el botón disparaba: no se podía arrancar nunca. Producción resuelve el modelo _dentro_ de `startCamera`, así que el botón ahora solo dispara eso y la UI va mostrando "bajando MediaPipe…" → "cargando WASM…" → "bajando modelo…" → "pidiendo cámara…".
26. **UI a ~12 fps.** El engine corre a la frecuencia del video como producción, pero los `setState` se agrupan cada 80 ms: 30 renders por segundo del árbol completo en el hilo de JS de React Native se sienten.

**Tests:** 70 en verde, 21 nuevos en `src/__tests__/poseWorker.test.ts` que fijan el contrato de carga e inferencia: `FilesetResolver` antes de `createFromOptions`, `runningMode: 'VIDEO'`, `detectForVideo`, `getUserMedia`, `detectForVideo` antes de `requestAnimationFrame`, colores del canvas, `/latest/`, y que no reaparezca `runningMode: 'IMAGE'` ni `takePictureAsync`. Ese bug de `vision` era testeable y por eso ahora hay un test que lo cubre.

**Verificación:** 70 tests del tester, 299 del repo, `tsc --noEmit` y ESLint limpios, `expo export --platform android` correcto.

**Lección:** antes de "arreglar" el síntoma, comparar la ejecución completa del original. El `baseUrl` y el timeout parecían la causa y eran condiciones necesarias pero no suficientes.

### Reparación de esta bitácora

Al escribir estas secciones con un here-string de PowerShell `@"..."@` (expandible), los backticks de markdown se consumieron como caracteres de escape: `` `r ``, `` `t ``, `` `v ``, `` `f ``, `` `a `` y `` `b `` borraron la letra siguiente y, en el caso de `` `r ``, partieron palabras en dos.

Se reparó el tramo desde "Banco de pruebas: catálogo completo" hasta acá. Las secciones anteriores nunca estuvieron dañadas: mantienen sus backticks y sus identificadores intactos.

**Para escribir markdown técnico hay que usar here-strings literales `@'...'@` o el editor, nunca `@"..."@`.** Un `@"..."@` con backticks corrompe el texto en silencio: no da error, solo pierde letras.

### La cámara no se veía: el contenedor colapsaba a altura cero

El usuario reportó que no se veía la cámara y que "no le dejaron espacio". Causa concreta: el CSS del WebView usaba `#stage { position: absolute; inset: 0 }` y confiaba en que `html, body { height: 100% }` resolviera dentro del WebView. Cuando eso no resuelve, el contenedor absoluto colapsa a **0 px de alto**: el video no tenía espacio y la pantalla quedaba en negro.

Producción no depende del alto del body: `.video-wrap` es un wrapper **estático** con `aspect-ratio: 3/4` (`HTML:66-74`), y `video`/`canvas` son absolutos _dentro_ de él (`HTML:75-83`). El alto sale de la relación de aspecto, no de la cadena de herencia del body.

27. **CSS del WebView alineado a `.video-wrap`.** Se copiaron `body`, `.video-wrap`, `video, canvas` y `.no-mirror` tal cual (`HTML:28-92`), incluido el `transform: scaleX(-1)` en la regla base de video y canvas en vez de agregarlo por JS. El `height: 100%` que queda es el de video/canvas respecto del wrapper, que es lo correcto.

28. **Caja de cámara nativa con la proporción exacta.** `TestScreen` ya no usa `flex: 1` para el alto de la cámara: usa `aspectRatio: 0.75` con `width: '100%'`, dentro de un `ScrollView`. El `flex: 1` anterior repartía el espacio con los controles y el log, y en pantallas bajas la cámara quedaba en cero. Los HUD absolutos (contador, gate, liveness, tilt) están dentro de dos wrappers (`camStack` + `camBox`) para que se midan contra la caja de la cámara y no contra la ventana del `ScrollView`.

**Tests:** 74 en verde, 4 nuevos de layout que fijan que el body no declare `height: 100%`, que no exista `position: absolute; inset: 0`, que el wrapper tenga `aspect-ratio: 3/4`, y que el espejo esté en la regla base de CSS.

**Verificación:** 74 tests del tester, 303 del repo, `tsc --noEmit` y ESLint limpios, `expo export --platform android` correcto.

### vision_bundle.js daba 404: el import de MediaPipe estaba mal copiado

El banco reportaba `vision_bundle.js no cargó (CDN sin respuesta?)`. Verificado con `HEAD` contra el CDN: **`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.js` devuelve 404**. El bundle publicado es `vision_bundle.mjs`. Ese `<script src>` nunca pudo funcionar, en ninguna versión del banco.

El error era de copia: producción no usa un tag `script` con `src`, sino un **import de módulo ES** desde el paquete completo (`HTML:471-476`):

```html
<script type="module">
  import { PoseLandmarker, FilesetResolver, DrawingUtils }
    from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
```

Eso tiene una segunda consecuencia que el sondeo de `window` ocultaba: el `import` expone **bindings del módulo**, no globales de `window`. `window.PoseLandmarker` nunca existió, así que `waitForVision` sondeaba algo que no podía aparecer y terminaba siempre en timeout con un mensaje que culpaba al CDN sin poder ser el CDN.

29. **Carga por import de módulo ES.** Se eliminó el tag `script src` y el sondeo `waitForVision`. `PoseLandmarker`, `FilesetResolver` y `DrawingUtils` se importan del paquete y se usan directamente, igual que producción. El `stage('script')` quedó como aviso de arranque: si el import falla, el módulo ni siquiera ejecuta y el error no es observable desde adentro, así que el timeout de 45 s de la app nativa sigue siendo la red de seguridad.

**Dependencias verificadas contra el CDN** (las tres que usa el banco):

| URL                                                                      | Estado      |
| ------------------------------------------------------------------------ | ----------- |
| `cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14`                   | 200, 137 KB |
| `.../wasm/vision_wasm_internal.js`                                       | 200, 210 KB |
| `.../wasm/vision_wasm_internal.wasm`                                     | 200, 9.4 MB |
| `.../wasm/vision_wasm_nosimd_internal.{js,wasm}`                         | 200         |
| `storage.googleapis.com/.../pose_landmarker_lite/float16/latest/...task` | 200, 5.8 MB |

Nota: un `HEAD` sobre la ruta de directorio `/wasm` da 404 aunque los archivos dentro existan. Hay que verificar los archivos individuales con `GET`.

**Tests:** 76 en verde, 2 nuevos que fijan el patrón de carga: que exista `<script type="module">` con el import de los tres símbolos, que no haya ningún `script src`, y que el código (sin comentarios) no espere `window.PoseLandmarker` / `window.FilesetResolver` / `window.DrawingUtils`. Un test que verifique URLs reales contra el CDN no puede ir en la suite porque rompe sin internet; la verificación de arriba es manual y queda registrada acá.

**Verificación:** 76 tests del tester, 305 del repo, `tsc --noEmit` y ESLint limpios, `expo export --platform android` correcto.

### 2026-10-01 — El banco deja de reimplementar: carga la misma página que la app

**Petición del PO:** el banco de pruebas tiene que **copiar tal cual** la ejecución de la app real, no una variante. Dejar registrado el relevamiento en un archivo de contexto.

**Diagnóstico:** el banco venía reimplementando el prototipo en TypeScript (motor de conteo, geometría, liveness, dibujo del esqueleto en el canvas del WebView de pose). Aun con "paridad verificada por tests cuadro a cuadro", no era el mismo archivo: cualquier cambio en `camera-verification.html` dejaba al banco midiendo otra cosa. Y el banco no mostraba cámara en el dispositivo.

**Cambio de arquitectura:** el banco pasa a cargar **la misma página, por URL**, en la WebView. La página prende la cámara sola, carga MediaPipe, dibuja el esqueleto y cuenta; el banco solo observa e inyecta el sensor.

1. **`src/lib/verify.ts`** es copia 1:1 de `apps/mobile/src/retos/verify.ts` (`VERIFY_URL` de gh-pages, `VERIFY_VERSION = 16`, `buildVerifyUri`). Se carga con `source={{ uri }}`, no con `source={{ html }}`: un documento con `html` usa `loadDataWithBaseURL` y no reproduce el origen HTTPS que exige `getUserMedia`.
2. **`TestScreen`** monta la página con los mismos props de WebView que producción (`camretos.tsx:193-209`) y el mismo puente de sensor (`DeviceMotion` con `setUpdateInterval(200)`, `tilt = atan2(|gz|,|gy|)·180/π`, `vertical = tilt ≤ 35`, inyección de `__resilienciaSetNativeOrientation`). La app **solo** escucha `complete`; el conteo, la calibración, el liveness y la cadencia quedan en la página.
3. **`src/lib/report.ts`** dejó de calcular: traduce el payload de `complete` a informe (objetivo/logrado/progreso, ranked con serie y vida, evidencia, y la discrepancia de unidad si la hay).
4. **`src/lib/exercises.ts`** quedó como catálogo puro (id, nombre, unidad de la página, `catalogUnit` cuando difiere, tier, objetivo, liveness). Se borraron `pose.ts`, `repEngine.ts`, `liveness.ts`, `tilt.ts` y `poseWorker.ts`, y sus tests.
5. **Se eliminó la carga por `<script type="module">` embebido** junto con el resto: ahora la página es externa y su propio import de MediaPipe es el de producción.

Esto deja **sin efecto** las secciones anteriores sobre el esqueleto en el canvas, la confirmación de cuerpo, la calibración, los cuatro bugs de portado y la carga ESM: eran correcciones a una reimplementación que ya no existe. El aprendizaje queda (las reglas del prototipo están documentadas), pero el código del banco ya no las reproduce, las ejecuta el original.

**Discrepancia que el banco ahora hereda sin tocar:** `mountain_climbers` sigue siendo `reps` en la página y `seconds` en `catalog.ts`; el informe lo marca con `[⚠ unidad]`.

**Tests:** 7 en verde (2 suites nuevas: contrato de `buildVerifyUri` y traducción del payload `complete`, incluida la discrepancia de mountain climbers). Se borraron las suites del motor reimplementado.

**Verificación:** 7 tests del tester, `tsc --noEmit` y ESLint limpios.

**Pendiente:** validar en Android físico que la página publicada carga y muestra el esqueleto con la cámara; el banco prueba la página de gh-pages, así que para probar un HTML local hay que servirlo por HTTPS.

**Relevamiento de contexto:** `apps/exercise-tester/RELEVAMIENTO_CAMARA.md` (anatomía del HTML con `archivo:línea`, integración nativa, tabla CFG y desvíos).

### 2026-10-01 — La cámara seguía sin verse: la WebView colapsaba a 0 px

El usuario probó en Android y la cámara no aparecía. La página ya era la correcta; el problema era de layout del banco.

**Causa:** `TestScreen` se renderizaba **dentro del `ScrollView`** de `App.tsx`. Un `WebView` con `flex: 1` dentro de un `ScrollView` no tiene una altura resoluble (el scroll da altura ilimitada), así que colapsa a **0 px de alto**: el video existe pero no se ve. Producción no tiene este problema porque la WebView vive en un `View` a pantalla completa (`camretos.tsx:334-335`).

30. **La prueba va a pantalla completa, fuera del `ScrollView`.** En `App.tsx`, cuando la pantalla es `test` se renderiza `TestScreen` directo bajo `SafeAreaView`, junto al `StatusBar`, sin header ni scroll. El resto (home/informe) sigue dentro del `ScrollView`.
31. **`react-native-safe-area-context`.** Se reemplazó el `SafeAreaView` de `react-native` (deprecado, el warning que reportó el usuario) por `SafeAreaProvider` + `SafeAreaView` de `react-native-safe-area-context` (`~5.7.0`, `npx expo install`).
32. **Setup centrado.** Ahora que la pantalla tiene alto completo, el setup se centra como en producción (`camretos.tsx:231-236`).

**`onPermissionRequest` no era la causa.** Producción pasa `onPermissionRequest={(request) => request.grant()}` (`camretos.tsx:208`), pero en `react-native-webview` 14.0.1 ese prop **no existe en los tipos JS** y no se reenvía: el `RNCWebChromeClient.java:143` concede la captura por su cuenta cuando el permiso runtime `CAMERA` ya está otorgado. El banco pide ese permiso con `useCameraPermissions` antes de montar la WebView, así que la condición se cumple y no hace falta el prop.

**Verificación:** 7 tests del tester, `tsc --noEmit` y ESLint limpios, `expo export --platform android` correcto (626 módulos).

**Confirmado por el usuario (2026-10-01):** en Android físico la cámara ya se ve. La prueba completa de los 8 ejercicios y del esqueleto/conteo queda para la sesión siguiente.

**Próxima sesión:** correr los 8 ejercicios en el celular, mirar que la página cuente bien, que el sensor la deje arrancar y que el mensaje `complete` llegue al informe. Ahí se decide qué portar a `apps/mobile` (empezando por la unidad de `mountain_climbers`).

### 2026-10-02 — "Se pierde la cámara y queda en confirmando sensor": es la cadencia de ranking

Reporte del usuario: en sentadillas, levanta la mano para empezar, cuenta una rep y a los segundos **se apaga la cámara** y abajo aparece **"Confirmando sensor"**; el sensor se ve bien (en vertical y al inclinar).

**No es un bug del banco: es la página apagando la cámara a propósito.** El camino, en `camera-verification.html`:

- En modo ranking y `unit === 'reps'`, cada rep llama a `beginCadence(now)`, que fija un deadline (`:1271-1275`).
- `cadenceTick` compara contra ese deadline y, si se pasó, llama a `failSeries('Descanso muy largo — fuera de ranking')` (`:1276-1282`).
- `failSeries` hace `stopCamera()` (`:1284-1291`): corta los tracks (`:1962-1963`) y vuelve a mostrar el botón de inicio.
- El texto del botón quedó en **`"Confirmando sensor…"`** desde `startCamera` (`:1908`) y nunca se restaura: `postComplete`/`stopCamera` solo lo muestran de nuevo (`:1194`, `:1967`). Por eso parece "trabado en confirmando sensor" cuando en realidad es el botón **Reiniciar mal rotulado** (un defecto de la página, no del banco).

**Cómo distinguir ranking de verificado:** el gesto de levantar la mano para empezar (`startGesture`, `:1217`, y `announceSession`, `:1119`) **solo existe en `MODE_RANKED`** (`:1939-1941`). Si levantar la mano arranca la sesión, estás en ranking y la cadencia aplica. En verificado (`ranked` apagado) no hay gesto ni corte por cadencia.

**Riesgo del banco que sí se corrigió.** El banner de resultado se renderizaba de forma condicional (`{last ? <Text/> : null}`) **antes** de la WebView. Al insertarse un hermano delante, React podía remontar la WebView (por índice) y recargar la página a mitad de sesión, apagando la cámara. Ahora el banner se renderiza **siempre** (como el `resultBar` de producción, `camretos.tsx:140-146`), así el número de hermanos de la WebView no cambia y no puede remontarse. De paso muestra un hint del límite de cadencia cuando `ranked` está activo.

**Para mañana:** primero validar el conteo con **ranking apagado** (sin gesto ni cadencia); después, con ranking, respetar la cadencia (~5 s por rep en sentadillas) para que no rompa la serie. Y reportar a producción el botón que no restaura el texto (`"Confirmando sensor…"` debería decir "Reiniciar").

**Verificación:** 7 tests del tester, `tsc --noEmit` y ESLint limpios.

### 2026-10-02 — Arreglos de cadencia en un fork aparte (sin tocar ResiliencIA)

El usuario pidió aplicar los arreglos detectados al analizar la cadencia, pero sin mezclar el banco con ResiliencIA. Decisión: **la página de producción
`camera-verification.html` queda intacta** (funciona bien) y los arreglos van a un
fork que usa **solo el banco**, `apps/exercise-tester/camera-verification-bench.html`,
publicado en `https://anibalkozur.github.io/resiliencia/camera-verification-bench.html`.
El banco (`src/lib/verify.ts`) apunta a esa copia. Cuando se validen, se portan a mano.

33. **Botón con texto viejo.** En el fork, `postComplete` y `stopCamera` restauran `startBtn.textContent = 'Reiniciar'`. En producción quedaba el `"Confirmando sensor…"` de `startCamera` cuando la cámara se detenía por completar o por romper la serie.
34. **Una rep durante la cuenta 5-4-3-2-1 ya no rompe la serie.** `registerRep` separa los dos motivos: si `!gestureStarted` **ignora** la rep (antes hacía `failSeries` → apagaba la cámara); solo la demora entre reps (`now > cadenceDeadline`) rompe el ranking. Además se agregó el guard `MODE_RANKED && !gestureStarted` a los tres caminos de reps (frontal, lateral y mountain climbers), que muestra "Levantá la mano arriba de la cabeza para empezar a contar" en vez de contar antes del "¡Ya!". Los caminos de segundos ya lo tenían.
35. **Segundero de cadencia más claro.** `#cadenceHud` pasó de 56 px a 72 px con sombra, y en los últimos 2 s se pone en rojo y pulsa (clase `urgent` + `@keyframes cadencePulse`); `cadenceTick` marca `urgent` cuando quedan ≤2 s.

36. **Sentadilla frontal: menos profundidad.** `downThresh` de `sentadillas` pasó de 100 a 130 en el fork. Con la cámara de frente el ángulo de rodilla se achata (la flexión va hacia cámara), así que con 100 había que bajar casi hasta alinear rodillas con caderas. Con 130 la rep cuenta bastante antes. **Falta validar** si 130 es cómodo o si conviene 120/140. La isométrica también quedó en 130 (mismo criterio, misma vista frontal).

37. **El informe respeta el objetivo elegido.** Bug del banco: `report.ts` comparaba contra `cfg.target` (el del catálogo, ej. 20) e ignoraba el objetivo que el usuario elige en la pantalla de prueba. La página **sí** usa el target del query y lo devuelve en `evidence.targetVal`/`targetMet`, pero el resumen decía "No llegó al objetivo (5/20)" aunque la página hubiera contado 5/5. Ahora `summarizeCompletion` toma `payload.targetVal ?? evidence.targetVal ?? cfg.target` como meta real (afecta `reached`, `target`, el resumen y el progreso). Sirve para todos los ejercicios.

38. **Zancadas de perfil (lateral).** De frente, en la zancada larga y baja la rodilla de la pierna de atrás tapaba el pie: el tobillo caía por debajo de `VIS = 0.65`, `checkComplete` marcaba "Falta ver" y `processFrontal` reseteaba el estado, así que no contaba. En el fork, `zancadas` pasa de `type: 'frontal'` (`downThresh: 115`) a `type: 'lateral'` con `sides` (shoulder/hip/knee/ankle por lado), `downDelta: 45`, `upDelta: 18` y `startMsg` de perfil; se autocalibra con el ángulo de rodilla de la pierna cercana. También se cambió `HOWTO.zancadas` a "de perfil". Requiere que el usuario se pare de costado; los deltas quedan a afinar probando.

39. **Mountain Climbers avisa que es de perfil.** El ejercicio ya se detectaba `lateral` (`kneeFold 105`, `lineMin 150`), pero ni el instructivo ni los mensajes lo decían. Se agregó "de perfil a la cámara" al `HOWTO.mountain_climbers`, al `postureMsg` y al `startMsg` del fork. Queda la duda de si conviene aclarar lo mismo en los demás `lateral` (flexiones, abdominales, plancha, puente de glúteo).

40. **Zancadas con objetivo par.** El usuario confirmó que la zancada de perfil funciona muy bien, pero como alterna piernas el objetivo debe ser par. Se decidió (por ahora) no intentar detectar la pierna —en perfil puro MediaPipe no distingue de forma fiable cuál va adelante— y en cambio hacer que el selector avance de 2 en 2: `ExerciseInfo.step: 2` para `zancadas` y `TestScreen` usa `exercise.step ?? (seconds ? 5 : 1)`, con `minTarget = step` para no caer en impar. Documentado para producción (`camretos.tsx`, modo libre premium) en `PORTAR_A_PRODUCCION.md` (punto 5).

41. **El inicio por mano levantada exige el cuerpo completo.** Bug del fork: `gestureTick` aceptaba la mano sobre la cabeza sin mirar el checklist, así que la sesión arrancaba aunque faltara ver partes del cuerpo (los pies, por ejemplo). Se agregó `bodyComplete`/`bodyMissing`: `processPose` lo resetea al entrar y cada camino (`processFrontal` y `processLateral`) guarda el resultado de `checkComplete`; `gestureTick` solo cuenta la mano si `bodyComplete` y, mientras falte algo, muestra "Completá el cuerpo en cámara — falta ver: …" en vez de arrancar. Verificado en la página publicada (`0050a5b`).

42. **Flexiones: cuclillas de arranque y 10 s para la primera rep.** La primera flexión necesita tiempo para pasar de cuclillas a plancha, así que se aclaró en `HOWTO.flexiones`, `postureMsg` y `startMsg`, y se agregó `firstRepGraceMs: 10000` a `CFG.flexiones`. `beginCadence(now, ms)` acepta duración y `readyTick` le pasa el margen solo al arranque; las reps siguientes vuelven a la cadencia normal (5 s). El campo es reutilizable para otros ejercicios que necesiten margen de arranque. Verificado en la página publicada (`6169a61`).

**Recordatorio:** la cadencia sigue siendo `CADENCE_SEC` (5 s por defecto) y la prueba de vida la extiende garantizando 10 s desde la señal (`extendCadenceForLiveness`). El corte por demora entre reps en ranking es **intencional**; lo que se arregló es que no corte por reps durante la cuenta y que el aviso sea visible.

**Cómo probarlo:** el banco carga la copia `camera-verification-bench.html` de
gh-pages. La app real sigue con `camera-verification.html`, sin cambios.

**Portado pendiente:** los cambios a aplicar en producción quedaron documentados con
diffs exactos en `apps/exercise-tester/PORTAR_A_PRODUCCION.md`.

**Verificación:** `node --check` del módulo del HTML OK.

---

## Registro del 2026-10-03 al 2026-10-12 (año 2026-10-12, [PM])

_Este bloque recupera el atraso de la bitácora (cortaba el 2026-10-02), según la
acción del acta de gate Fase 0 (`docs/equipo/actas/2026-10-09_gate_fase0.md`). El
contenido del 2026-10-09 en adelante está al día porque se escribió el mismo día._

### 2026-10-03 — El banco pasa a copia 1:1 de la página y suma 15 ejercicios

La copia del banco dejó de ser una reimplementación y pasó a **cargar la página por
URL (HTTPS) como producción**, en vez de HTML embebido (`5960dfc`). Se eliminaron
`pose.ts`/`repEngine.ts`/`liveness.ts`/`tilt.ts` y sus tests; el banco consume el
reporte de la página. `verify.ts` con `VERIFY_VERSION` 24, `buildVerifyUri` y tests
de `verify`/`report`.

Catálogo nuevo: **elevación de piernas + 14 ejercicios** — zancadas (reversa /
lateral / búlgara), patada de glúteo, elevación lateral de pierna, flexiones
(rodillas / declinada / pica), fondos en silla, superman, encogimientos (inverso /
bicicleta), burpee y rodillas altas. El motor del banco mide el pliegue de rodilla
por `cfg.kneeFold` y `cfg.metric='ratio'`. Documentó `EJERCICIOS_CANDIDATOS.md`,
`PORTAR_A_PRODUCCION.md` y `RELEVAMIENTO_CAMARA.md`.

**Verificación:** tests del tester en verde, `tsc`, lint.

### 2026-10-04 — Secuencia de ejercicios, paso por mano, voz del entrenador y chat en el banco

Día intenso en el banco (`apps/banco de pruebas de ejercicios`, en ese momento
`apps/exercise-tester`):

- **Reinicio por mano sin apagar la cámara** (`7ce7c5b`): al completar o al romper
  la serie, la cámara sigue encendida; levantar la mano reinicia con el mismo
  5-4-3-2-1. `failSeries` ya no detiene la cámara; cadencia por rep **6 s** (antes 5) y señal de vida **12 s** (antes 10). Se documenta `IDEAS_RESILIENCIA.md` con
  la idea de sesión con secuencia de ejercicios.
- **Sesión con secuencia de ejercicios y paso por mano** (`646ff06`): en la home se
  eligen varios ejercicios con orden y objetivo propio; la página los recorre en
  vivo con `loadExercise()` sin recargar cámara ni modelo. La mano que habilita el
  paso es la de arranque (sin segundo gesto); sin ranking la secuencia avanza sola a
  3 s. Cada ejercicio reporta `exerciseId`, `seqIndex`, `seqLength` y `seqDone`.
- **Objetivos editables y prueba de vida en el setup** (`194f430`): cada fila de la
  secuencia tiene −/+ con el paso y límites de la pantalla de prueba; el toggle de
  ranking/prueba de vida se mueve junto con la secuencia y el setup scrollea con 8
  ejercicios.
- **Voz del entrenador sin modelo** (`8aa7ce2`, `VERIFY_VERSION` 26→27): 40 frases
  escritas en 5 puestos (pre/mid/last/done/rest × 8), una por serie y por puesto, el
  índice sale de `seqDone`. Reglas duras: los números los pone el código, en
  isométricos no se habla dentro de la serie, en ranking hay silencio (cadencia),
  gap de 2,5 s y el descanso se compone en un solo utterance.
- **Chat del entrenador en el banco + fix de la frase de fin de serie** (`72fe1a8`,
  27→28): `postComplete` tomaba la frase con `voiceTake()` y la componía con el
  mensaje de transición (antes `speechSynthesis.cancel()` cortaba a media palabra).
  Chat con dominio cerrado en `src/lib/chat.ts` (sin modelo en Expo Go; por texto,
  con micrófono deshabilitado y nota al pie). Tres reglas coded con test: puerta de
  edad (<18 sin perfil ni consejo, evaluada primero), datos del perfil se leen pero
  **no se hablan** (`habla:false`, TTS cloud), y el perfil no genera consejo.
- **Estilo técnico y puente TTS RN** (`b7943b7`): respuestas sin reps/tier, guía por
  ejercicio, `speak()` RN-first con `{type:'voz',text}` hacia `expo-speech` desde
  `apps/mobile/src/lib/voz.ts`, y precalculo de frases. Ajustes de chat: perfil solo
  en primera persona + "para qué sirve la app" + tests anti-falsos positivos
  (`cb30475`), TTS de datos del perfil a pedido (`c07bf04`), "Medís X cm" en vez de
  "Mirá X cm" (`71f7d32`).
- **Precalculo de frases, gap estable, no hablar desde WebView y log a RN** (`88c0239`,
  v29): la rotación se resuelve en RN, el WebView no habla por sí mismo y loguea
  `voz`/`voz_log` al nativo.
- **`done` antes de `waitForRestart`** (`17ff2b0`, `0d4f591`, `a029b0a`): al terminar
  una serie (no ranking) la frase `done` se pronuncia antes de avanzar; con la cámara
  apagada el mensaje es "toca Reiniciar".

**Verificación:** tests del dominio (14 nuevos de chat) en verde, `tsc`, lint.

### 2026-10-05 — Reverts a la base estable y precalculo de frases en vivo

El cambio de `loadExercise()` que cambiaba `cfg`/objetivo en vivo **rompió la
carga**: la WebView quedaba en negro. Se revirtió el HTML a la base estable
`72fe1a8` (`74e4dda`, `b5ac134`) y el cambio de `loadExercise` (`b091a88`,
`14a7f27`). Sobre esa base se reaplicó el **precalculo de frases del guion al cargar
el ejercicio** (`1c0551c`, `34a68bf`, `VERIFY_VERSION` **30**) — la lección quedó
documentada: los cambios de "secuencia/rotación" se llevan por la vía del
precalculo y la inicialización, no mutando el camino de carga a mitad de vuelo.

**Verificación:** el banco vuelve a cargar la cámara y el contador; tests en verde.

### 2026-10-06 — Reparación del bench (sensor gate, UTF-8) y puente de TTS a RN

- **Restauración de la base estable** (`3d92f58`, `5aa209e`): el HTML del banco
  vuelve a la base `72fe1a8` que carga y enciende la cámara.
- **Puente RN sobre base estable** (`7ded6a0`) y **puente TTS a RN** (`27d5c6b`,
  v31): la WebView no usa `speechSynthesis`; manda `{type:'voz'}` y
  `{type:'voz_log'}` al nativo, que habla con `expo-speech`.
- **Reparación del HTML del banco** (`d351a0c`): fix de sintaxis y restauración del
  **gate de sensor** (`__resilienciaSetNativeOrientation`); `VERIFY_VERSION` sube a
  **32**; launcher y README corregidos.
- **UTF-8 y ortografía de la UI** (`e01a326`, `0f6efb5`, `190af81`, `3f7dfca`): se
  limpian los caracteres no-ASCII (mojibake) del texto visible y se corrigen
  "levanté/cámara/completá" etc.

**Verificación:** 7 tests del tester, `tsc`, lint. La cámara vuelve a verse en el
banco con el esqueleto y el sensor conectado al RN.

### 2026-10-07 — Renombre de la carpeta del banco y plan de IA durante el ejercicio

- **Renombre de carpeta** (`bb1bae0`): `apps/exercise-tester` → `apps/banco de
pruebas de ejercicios` y la cámara del banco pasó a **9:16 sin recortes** (todo el
  cuerpo entra en las sentadillas sin cortar pies ni cabeza).
- **Docs(plan)** (`8a265cc`): mejoras IA durante el ejercicio + chatbot entrenador
  quedan planificadas (revisión de REQUIREMENTS/roadmap), alineadas con lo que ya
  existía en el banco (voz sin modelo + chat de dominio cerrado).

**Verificación:** el banco abre con la cámara completa; rutas del repo actualizadas.

### 2026-10-08 — Checks del cuerpo más estrictos y tobillos con proporción anatómica

En el banco, la verificación del cuerpo se endureció para que **los checks en rojo
sean de verdad**:

- **Cuerpo completo con checks verdes para iniciar o reiniciar** (`0058c09`): la
  sesión no arranca ni se reintenta si falta alguna parte visible.
- **Límites del marco visible** (`5b3a2d3`): una parte fuera del encuadre se marca
  en rojo de inmediato (antes quedaba en gris/ambigua).
- **Corte de pies + proporción anatómica de tibia** (`5509442`): los tobillos
  dependen de que se vean los pies y de una relación anatómica razonable.
- **Unificación de `isLandmarkValid`** (`7787025`, `VERIFY_VERSION` **38**): el
  dibujo del esqueleto y la lista de checks usan el mismo criterio de validez.
- **Contenedor de cámara 9:19.5** (`086d6c8`): más alto y con menos espaciado, para
  que el checklist inferior no se pierda (prepara la verificación de tobillos).

**Verificación:** 7 tests del tester, `tsc`, lint. Este bloque dejó documentado en
`estado.md` que **aún no estaba en `BITACORA.md`** (el atraso que este bloque
recupera).

### 2026-10-09 — Gate Fase 0 (devuelta), tobillos verificados y primeros portes a producción

- **Estado y gate al día** (`9fdfa0f`): `estado.md` repuesto al 2026-10-09 (estado
  verificado: typecheck 5/5, ~300 tests, lint; Keep-Alive **resuelto**, run
  `37978602425`, con los secrets `SUPABASE_URL`/`SUPABASE_ANON_KEY` cargados) y acta
  de gate `2026-10-09_gate_fase0.md` **firmada por el PO**. La Fase 0 **no se
  cierra**: faltan B1 (marca, [LEG]), ítem 4 (backup `healthz` formal + medición
  del free-tier, [SRE]) y la disciplina de "un PR por tarea" ([PM]).
- **Checks de tobillos pulidos en el banco** (`e586eb2`→`b196e3e`, v39→v46):
  tobillo derivado del pie con umbral propio e histéresis (v39), HUD inferior
  anclado al viewport (v40), altura de cámara limitada para que entre sin scroll
  (v41), umbrales de pie/talón y márgenes aflojados (v42/v43), pie/tobillo hasta el
  borde inferior (v44), tolerar el pie levemente por debajo del borde
  (`ANKLE_MAX_Y 1.08`, v45) y quitar el debug de visibilidad (v46). Verificado en
  acta **010** (`docs/equipo/actas/2026-10-09_verificacion_tobillos_bench.md`):
  verde con el pie en el borde, rojo al desaparecer.
- **Portes a producción** (registrados en `PORTAR_A_PRODUCCION.md`):
  - **Cambio 1 — `downThresh` 130** en sentadillas e isométrica, `VERIFY_VERSION`
    **17** (`a030350`).
  - **Cadencia 6 s/12 s + segundero 72 px con aviso urgente**, v**18**, y el banco
    espejo pasa a v47 (`f864542`); registro de los cambios 2/10/11.
  - **Inicio con la mano en todos los modos + cuerpo completo** (punto 4), v**19**
    (`389b03f`).
  - **Voz guía del entrenador (punto 12) + chat IA en Inicio**, v**20** (`3a3e68f`).
- **Housekeeping**: el backup personal del banco y el de la app resiliencia pasan a
  `.gitignore` (`eb4393d`; el del banco con `f3d2fa5`/`9fdfa0f`); lista nueva de
  pendientes 1-6 en el PORTAR + prod en v20 (`d78016b`); cambio 10 (cadencia)
  registrado con `a301aa5`.

**Verificación:** portes probados por el PO en la app el 2026-10-09 (1, 2, 6, 10,
11 y 12); banco con **300 tests**, typecheck 5/5 y lint.

### 2026-10-10 — Botones gestuales SALIR / INICIAR / REPETIR (punto 13)

Primer pedido del PO **desarrollado directo sobre producción** (sin pasar por el
banco), v**21** (`14a1de9`, punto 13): salir / iniciar / repetir se hacen con la
mano sostenida sobre un botón (dwell de 1 s con anillo de progreso), en lugar del
gesto "levantá la mano arriba de la cabeza".

- **SALIR** (arriba-izquierda, siempre visible): postea `exit` y vuelve a la pantalla
  previa. **INICIAR** (arriba-derecha, primera serie) → cuenta 5-4-3-2-1. **REPETIR**
  (arriba-derecha, de la segunda serie en adelante) → serie siguiente.
- Ambos **solo se habilitan con el cuerpo completo en verde** (`bodyComplete`), con
  aviso de voz; el estado del cuerpo se refresca también después de la serie.
- Se quitó el HUD superior ("En vivo", chip 0/n, botón "Frontal"); con esto se
  **perdió el botón de cambiar de cámara** (queda frontal por defecto). El flujo
  inicio/reinicio vive en la WebView; el móvil reacciona a `exit` y `repeat`.

**Verificación por PO (2026-10-10):** OK en la app (v21, gh-pages).

### 2026-10-11 — Guía de técnica en barra superior y pantalla de cámara minimalista (puntos 14-15)

- **Punto 14** (v23, `caae124`): la guía de técnica pasa a la **barra superior de la
  app** (libre y reto del día) y se elimina el `<p id="desc">` duplicado de la
  página; se agrega el botón **SALIR touch** en el header, visible solo durante la
  sesión en modo libre (`LibreExerciseProvider` expone `libreActive`/`salir`;
  `BrandHeader` lo renderiza; clave i18n `cam.exit`).
- **Punto 15** (v24→v34, `4dd99f7`): la cámara queda **borde-a-borde** (sin
  `border-radius`, `margin: 0 -14px`, alto ≈1.41× el ancho) y se quitan los botones
  inferiores ("Activar cámara", "Finalizar y verificar serie"), el `#log` y el
  recuadro de resultado `#resultCard` (con stubs en el JS). En la app, la barra
  superior muestra **siempre** la guía (se elimina el estado `result`) y el bloqueo
  premium pasa a `Alert.alert`.
  - **Gotcha corregido en v34:** el stub de `resultCard.querySelector('.verify-tag')`
    debe devolver un objeto **con `.classList`**; si no, la ruta de fallo
    (`failSeries → stopCamera`) lanzaba excepción, cortaba el `requestAnimationFrame`
    y **congelaba el esqueleto** dejando mudos los botones gestuales.

**Verificación por PO (2026-10-11):** OK en la app (v23 `4f3a996`, v34 `6b8b9f6`).

### 2026-10-12 — HUD de cámara y reps, botón indicador de postura y rutina en modo libre (puntos 16-20)

- **Punto 16** (v35, `8ea261c`): los botones gestuales bajan **~0,5 cm**
  (`.dwell-btn` `top: 10px → 40px`); el `getBoundingClientRect()` del gesto sigue al
  botón, sin tocar JS.
- **Punto 17** (v36, `d2d269b`): la cámara ocupa **todo el alto hasta la tab bar**
  (`#app` `height: 100vh`, `.video-wrap` `flex: 1` con el video en `cover`),
  reemplazando el `aspect-ratio` del punto 15.
- **Punto 18** (v40, `85c88aa`): se elimina el HUD de texto arriba-centro
  (`#stateMsg`, con stub JS) conservando `#checklistHud` (restaurado en v38), y la
  advertencia de orientación sube a `top: 10px`. La app **sigue pausando** la
  detección con el celu acostado, solo que sin mensaje visible.
- **Punto 19** (v41→v45, `68bb5c8`): en el HUD de reps se quita la etiqueta "de N",
  el número sube ~3 mm y pasa a la **esquina inferior derecha**; el botón superior
  derecho deja de desaparecer durante la serie y se reusa como **indicador de
  postura**: verde "CORRECTO" (`repState === 'down'` y cuerpo completo) / naranja
  "FALTA" (solo ejercicios por reps; el gesto queda inactivo; SALIR sigue activo).
- **Punto 20 — Rutina en modo libre** (v46, `c9c2ca3`): en el tab Libre se arma una
  rutina de 1+ ejercicios (editor en el setup: orden ↑↓, meta −/+ por ejercicio,
  quitar, agregar con premium bloqueados). Con 1 ejercicio se conserva el flujo
  único (ranking posible); con 2+ corre `seq=id:objetivo,...` sin ranking. Al
  terminar cada ejercicio aparecen **SALIR | SIGUIENTE | REPETIR** con anillo de
  carga (trio `26px`), `REPETIR` repite y `SIGUIENTE` carga el próximo con su cuenta
  regresiva y la voz _"Meta cumplida. Siguiente: X, meta N reps. Sostené tu mano
  sobre SIGUIENTE para empezar"_ (+ hint al apoyar la mano). `cfg`/`targetVal`/
  `targetUnit`/`livenessEnabled` pasan a `let` por ejercicio (`loadExercise`); cada
  `complete` postea `exerciseId`/`target`/`seqIndex`/`seqLength`. En RN:
  `LibreExerciseProvider` expone `routine` + mutators, el setup de `camretos.tsx` lo
  edita, `BrandHeader` muestra "Rutina · N" y `verify.ts` sube a **46** con
  `opts.seq`.
- **Cierre (rutina de cada port):** registro en `PORTAR_A_PRODUCCION.md` (punto 20),
  commit + push a main (la rama quedó limpia contra `origin/main`), **backup local**:
  tag `backup-resiliencia-20261012-160500` → `c9c2ca3` + manifest
  `apps/mobile/backup app resiliencia.txt` (gitignored, solo local), y este registro.

**Verificación por PO (2026-10-12):** OK en la app (v35 `7ae72f2`, v36 `be550d1`,
v40 `e3e0c3c`, v45 `9840ba2`, v46 `ddebf47`). Validaciones previas al cierre:
`node --check`, typecheck, tests mobile 14 suites / 175, lint en los archivos
tocados.

### 2026-10-13 — Revisión [DER] de seguridad/calidad (acta 011) + sesión cifrada; política de prueba de vida (acta 012)

**Acta 011 — Revisión de seguridad y calidad del producto** ([DER], insumo del
gate Fase 0, sin cambios de código en esa revisión): RLS completo (22 tablas),
autoridad server-side, entitlements fail-closed, consola admin cerrada, sin
secretos en el repo. **Sin hallazgos críticos ni altos**. Medios: token de sesión
móvil en SQLite; `verify.ts` sin test + versión 46/47; rejections async sin
manejar; lint parcial. Acta: `docs/equipo/actas/2026-10-13_revision_seguridad_calidad.md`.

**Cierre medio [SEC] — sesión móvil cifrada en `expo-secure-store`** (`ac13c25`):
`apps/mobile/src/auth/authStorage.ts` (troceo de 1800 bytes, migra y borra el
texto plano previo de SQLite; `supabase.ts` conserva la excepción PKCE);
`expo-secure-store ~57.0.3→57.0.4`; tests `authStorage.test.ts` (6). Corre en
Expo Go sin rebuild. (Acta 011 commiteada en `acd6dba`.)

**Decisión del PO — "solo se rankea con prueba de vida" (acta 012):** un resultado
validado (libre rankeado o reto diario) **nunca** se envía sin vida. **Cuándo**:
meta de repes **> 10** → durante la serie (temporizador aleatorio 4–13 s), **nunca
antes de la repe 5**; meta **≤ 10** → al finalizarla (sin interrumpir series
cortas). Segundos (plancha/isométrica): durante. La vida al final usa la **misma
consigna** ("Señal de vida. Levantá la mano…") que la aleatoria y, **tras dar la
señal**, la voz anuncia "Serie completa". Cierra el bypass de metas ≤ 5 y el reto
diario que abría sin `ranked=1`.

**Implementación:**

- `camera-verification.html` (**v51**): `LIVENESS_REQUIRED = MODE_RANKED ||
qs.get('liveness')==='1'`; `livenessEndOnly = targetUnit==='reps' &&
targetVal<=10` (no arma el temporizador); la vida aleatoria no se arma antes de
  `LIVENESS_MIN_REP = 5` y se arma al completar la repe 5; **fallback al final**
  en `postComplete` (si la meta está cumplida y no hay vida → arma el desafío y no
  envía, camino normal de las series ≤ 10); `onLivenessPassed()` centraliza el
  "pasó" y envía el resultado pendiente con la voz "Serie completa" (en la misma
  locución final, para que el TTS no la corte; **sin duplicar** si el turno de voz
  del corpus `done` ya empieza con "Serie completa", p. ej. "Serie completa.
  Recuperate."); la consigna final es la misma que la aleatoria; sin re-entrada si
  ya hay resultado pendiente. La repe con vida **durante** pasa a **12 s**
  (`CADENCE_MS + 6000`). Sin cambios de servidor (la evidencia
  `livenessRequired`/`livenessPassed` ya existía).
- Móvil: `verify.ts` opción `requireLiveness` + **`VERIFY_VERSION` 46 → 51**;
  `retos.tsx` abre el reto diario con `{ requireLiveness: true }`. El libre
  rankeado ya pasaba `ranked=libreRanked`.
- **Publicado:** gh-pages (v51) y verificado en CDN. **Probado por el PO en Expo
  Go: OK.** Commits en `main`: `1442353` (feature v47-v51) + `732b181`
  (`.gitignore` de `backups/`); tag `backup-resiliencia-20261013-221615`; snapshot
  local `backups/camera-verification-v51-20261013-221615.html`; registro local en
  `apps/mobile/backup app resiliencia.txt` (Punto 21).
- Verificación local: prettier ✓, typecheck ✓, lint ✓, mobile **181/181** (15
  suites), console **39/39**.

**Límite declarado:** la vida sigue siendo **reportada por el cliente** (no es
prueba criptográfica) y el ranking real sigue en `pending` hasta que exista el
validador server-side (acta 011 §7) — no se simula nada.

### 2026-10-14 — Reorganización de pestañas, historial en Progreso, Perfil en Ajustes y selector de días de entrenamiento (acta 013)

Decisiones del PO desarrolladas directo sobre producción (sin pasar por el banco).

- **Ranking, ahora pestaña propia.** Se extrae la UI de ranking de Progreso a
  **`app/(tabs)/ranking.tsx`** (Racha | Reps | Total, chips de ejercicio, estados
  vacíos honestos; `fetchRanking`/`fetchRepsRanking`/`fetchTotalRepsRanking`). Progreso
  deja de mezclar ranking con lo personal.
- **Progreso = historial de ejercicios.** Tarjeta **HISTORIAL DE EJERCICIOS** que une
  retos completados y sesiones libres (orden por fecha descendente, etiqueta
  Reto/Libre, `valor/meta unidad`). Lógica pura en **`src/retos/history.ts`**
  (`buildHistory`, `unitForExercise`) con tests.
- **Perfil deja de ser pestaña.** Su contenido pasa a **`components/PerfilPanel.tsx`**;
  `app/(tabs)/perfil.tsx` se elimina. En Ajustes se muestra una fila **plegable
  "Perfil ▸"** (colapsada por defecto, con accesibilidad `expanded`).
- **Orden de pestañas**: Inicio · Retos · Libre · Progreso · Ranking · Ajustes;
  nuevo ícono `PodiumIcon` (SVG de tokens) para Ranking. Inicio suma el CTA
  **VER RANKING** junto a **EMPEZAR RETO**.
- **Día de descanso sin simulación.** Nuevo **`buildNextTraining`** (`week.ts`); si hoy
  no toca entreno, el CTA de Inicio **no navega** y avisa con un mensaje **adaptativo**
  ("mañana vuelven los retos" solo si el próximo reto es mañana; si no, el día concreto).
- **Selector de días de entrenamiento (reemplaza "Días por semana").** El modelo pasa
  de `Prefs.daysPerWeek: number` a **`Prefs.trainingDays: number[]`** (0=dom…6=sáb),
  default `[1,3,5,6]`, con **migración** automática desde `daysPerWeek`
  (`LEGACY_TRAINING_SLOTS`) y validación (enteros 0–6, únicos, ordenados, mínimo 1); se
  retiran `MIN_DAYS`/`MAX_DAYS`. En Ajustes, fila de **7 chips Lun→Dom** en una línea
  (adaptativos) con la leyenda **"Selecciona los días en que quieres entrenar."**; el
  último día activo no se puede deseleccionar. `buildWeek`/`buildNextTraining` toman
  `trainingDays`; "Plan N días" en Retos usa `trainingDays.length`. i18n `settings.days`
  → "DÍAS DE ENTRENAMIENTO" + nueva `settings.days_hint` (es/en/pt); se retira
  `settings.saved`. La abreviatura de miércoles en ES pasa de `X` a `M`.

**Verificación:** prettier ✓, typecheck ✓, lint ✓, `apps/mobile` **198/198** (16
suites). **Probado por el PO en Expo Go: OK.** Acta:
`docs/equipo/actas/2026-10-14_reorg_pestanas_selector_dias.md`.

### 2026-10-16 — Fix de la prueba de vida (mano) + cadencia de ejercicios premium

**Reporte del PO (vía chat):**

1. Al probar **Fondos en silla** (premium), al terminar la serie la app pedía la
   **prueba de vida**; levantaba la mano por encima de la cabeza y la cámara
   **no la detectaba** ("SEÑAL VIDA" quedaba fijo, varios intentos).
2. Consulta: "¿hay 6 segundos para cada repe?".

**Análisis y hallazgos ([CV]/[DER]):**

- La detección de vida con mano **no era independiente del ejercicio**: vivía
  dentro de `processFrontal`/`processLateral`, **después** de los gates
  anti-trampa de postura, y exigía `repStateInitialized`.
- `fondos_silla` exige **rodilla extendida** (`kneeExtendMin: 150`): al levantar
  el brazo con las piernas no perfectamente estiradas, el gate hacía `return`
  temprano y **reiniciaba la calibración** → nunca se leía la mano.
- La vida es una señal **deliberada** del usuario: no debe quedar bloqueada por
  los anti-trampa (que sancionan el **conteo**, no la vida).

**Cambios aplicados:**

- `camera-verification.html` (**v53**) y banco espejo: la vida de mano se evalúa
  **al inicio de `processPose`, antes de cualquier gate**; se quita el requisito
  de `repStateInitialized`; se eliminan los call sites duplicados en
  `processFrontal`/`processLateral`; visibilidad de muñeca **0.5 → 0.3** y
  `LIVENESS_FRAMES` **5 → 3**. Mejora colateral en abdominales, puente y
  escaladores.
- **Cadencia** (máximo de descanso entre repes; se sanciona solo en ranking):
  `REP_CADENCE` suma **zancadas 4 s**, **puente_gluteo 4 s**, **fondos_silla 5 s**
  (además de sentadillas 5, flexiones 5, abdominales 3) y se **unifica el
  fallback en 6 s** (`DEFAULT_CADENCE_SEC`, default de la cámara y de `chat.ts`;
  antes `camretos.tsx` usaba 5). Los ejercicios por tiempo no usan cadencia.
- App: `VERIFY_VERSION` **52 → 53**.

**Verificación:** `node --check` OK (prod y banco); banco y espejo idénticos
(MD5); typecheck ✓, lint ✓, `apps/mobile` **198/198** (16 suites) ✓; publicado en
**gh-pages** (`camera-verification.html` + `camera-verification-bench.html`) y
CDN confirmado. **Probado por el PO en Expo Go: OK.** Acta:
`docs/equipo/actas/2026-10-16_fix_prueba_de_vida.md`.

### 2026-10-16 - Ranking: selector de períodos (UI) + visibilidad de perfil (`showInRanking`); acta 016

**Peticiones del PO (vía chat):**

1. Implementar los rankings de la pestaña Ranking **por partes**; primero la UI.
2. Que en la lista del ranking aparezca el **nombre de perfil (identidad)**.
3. Los botones de período (Hoy · Semana · Mes · Año · Histórico) **no deben salirse de pantalla**.
4. Agrandar el recuadro del Ranking **hasta el borde**, con los 5 botones en **una sola fila**, adaptativos y con **menos separación**.

**Análisis y hallazgos:**

- El **acta 016** (decisión de producto, `docs/equipo/actas/2026-10-16_ranking_rutinas.md`) fija los períodos
  Hoy · Semana · Mes · Año · Histórico (default **Histórico**) y la visibilidad `show_in_ranking`; la
  implementación de datos es **Fase 4** (bloqueada por el validador server real).
- `apps/mobile/src/sync/rankingPeriods.ts` (creado en un arranque previo, **sin commitear**) **no compilaba**:
  `rankPeriodSince` no cerraba el `switch` ni la función (faltaba `case 'all'`); además tenía BOM y era **huérfano**.
- Faltaban las claves i18n `progress.period_*` (es/en/pt) → `TranslationKey` inválida.
- El **nombre/apodo ya se mostraba** en la lista (`entry.nickname`); no requería cambios. Lo nuevo es el opt-out
  `showInRanking`, que queda **dormido** (sin consumidor) hasta la Fase B.
- Primer intento de UI con `ScrollView horizontal` → el último chip ("Histórico") **quedaba fuera de pantalla**.

**Cambios aplicados:**

- `apps/mobile/src/sync/rankingPeriods.ts`: cerrado el `switch` con `case 'all': default: return null;`; BOM eliminado.
- `apps/mobile/src/i18n/translations.ts`: `progress.period_day|week|month|year|all` + `progress.period_empty` en es/en/pt.
- `apps/mobile/app/(tabs)/ranking.tsx`: fila de 5 chips de período (default **Histórico**), en **una sola fila**
  (`flex: 1`, gap 4), tarjeta a **borde de pantalla**, y **estado vacío honesto por período** (no muestra datos sin filtrar).
- `apps/mobile/src/prefs/*`: `showInRanking` (default `true`) con tests (dormido).
- `apps/mobile/src/sync/__tests__/rankingPeriods.test.ts`: 7 tests nuevos.
- Acta 016 incluida en el commit.

**Verificación:** `prettier --check` OK · `typecheck` 5/5 OK · `lint` OK · `apps/mobile` **207/207** (17 suites).
UI probada por el PO en Expo Go: **OK**.

**Pendientes / decisiones:**

- **Fase B**: migración `0019` (hoy crea **sobrecargas** de las funciones y hay que recablear `syncService`
  para mandar `p_since`) — **NO commiteada**; queda como borrador local.
- **Fix del handshake de versión** (`validate_workout` acepta `{12,13}` vs cámara `?v=53`) y **validador
  server-side real** (Fase 4) antes de **encender** el ranking; el free sigue fuera de todo ranking (ADR).
- `tmp.test` (copia basura de `estado.md`) sigue **sin commitear**.

### 2026-10-16 - Ranking Fase B: cableado de datos por período + visibilidad (migración 0019 aplicada en producción)

**Peticiones del PO (vía chat):**

1. "Vamos con Fase B" (cablear el selector de período a datos reales del servidor).
2. Aplicar la migración en Supabase productivo ("puedes hacer todo tú").

**Análisis y hallazgos:**

- El borrador `0019` **creaba sobrecargas** en vez de reemplazar firmas: `get_ranking(p_max_rows, p_since)`
  convivía con `get_ranking(max_rows)`, y las variantes de 3/2 args con `p_since` default quedaban
  **ambiguas** ante PostgREST (`{p_exercise_code, p_max_rows}` matcheaba 1 y 2) → riesgo `PGRST203`.
- El cliente (`syncService.ts`) llamaba `get_ranking { max_rows }` (param viejo) y no mandaba `p_since`.
- El rank de racha **no debe filtrar las rachas por período** (acta 016 §7): la "racha actual" es un valor de
  HOY; el período solo acota `completed_challenges`. El primer `create` filtraba todo por `p_since` → la racha
  actual caía a 1 al elegir "Hoy". **Corregido**.
- No hay `supabase` CLI, `config.toml`, `project-ref` ni service-role en la máquina; solo la `anon key`
  (no puede DDL). Se aplicó por **Management API** (`POST /v1/projects/{ref}/database/query`) con un PAT
  provisto por el PO (project_ref `cgaxpmmbpwaefaigsisu`). Ojo: hay que mandar el body como **bytes UTF-8**
  (los acentos en comentarios rompían el JSON con `Invoke-WebRequest`).

**Cambios aplicados:**

- `supabase/migrations/0019_ranking_periods_visibility.sql` (reescrita): `drop function` de las firmas viejas
  `get_ranking(int)`, `get_reps_ranking(text,int)`, `get_total_reps_ranking(int)` → `create or replace` con
  `p_since timestamptz default null` (sin sobrecargas); `profiles.show_in_ranking boolean not null default true`
  - índice de visibilidad + índice de corte por `created_at`; filtro `coalesce(show_in_ranking,true)` y
    `revoke`/`grant` a `authenticated`. En racha: `completed_all` (histórico para rachas) vs `completed_period`
    (`p_since` para `completed_challenges`).
- `apps/mobile/src/sync/syncService.ts`: `fetchRanking(client, maxRows, since?)`, `fetchRepsRanking(client,
exerciseCode, maxRows, since?)`, `fetchTotalRepsRanking(client, maxRows, since?)` → mandan `p_max_rows` + `p_since`.
- `apps/mobile/app/(tabs)/ranking.tsx`: el período dispara el **fetch real** (`rankPeriodSince(period)`); se
  quitó el estado vacío simulado y ahora se usa `progress.period_empty` (período ≠ Histórico) o `ranking_empty`;
  `period` agregado a las deps de los efectos.
- `apps/mobile/src/sync/__tests__/syncService.test.ts`: asserts con `p_max_rows`/`p_since` + 3 tests nuevos de `since`.

**Verificación:**

- `typecheck` OK · `lint` OK · `prettier --check` OK · `apps/mobile` **210/210** (17 suites).
- **Migración aplicada** en producción vía Management API (201). Verificado: una sola firma por función con
  `p_since`; columna `show_in_ranking` (bool, default true); ACL `authenticated`/`service_role` sí, `anon`/`public` no.
- Smoke test: `get_ranking(5,null)` corre (hoy solo hay 2 perfiles "atleta" y **0 retos completados** → ranking vacío,
  consistente con "ranking latente"). Simulación SQL de la racha: con `p_since=hoy` → `completed_challenges=1`
  pero `current_streak=3` (histórico). ✅

**Pendientes / decisiones:**

- **NO commiteado** por pedido del PO ("no commitear todavía"); cambios en working tree + migración sin trackear.
- **Fix del handshake de versión** (`validate_workout` `{12,13}` vs cámara `?v=53`) y **validador server-side real**
  (Fase 4) antes de **encender** el ranking; el free sigue fuera de todo ranking (ADR).
- El PAT usado (acceso full, 90 días) conviene **revocarlo**; no quedó guardado en el repo.
- `tmp.test` (copia basura de `estado.md`) sigue **sin commitear**.

### 2026-10-16 - Ranking Fase 4: validador server-side real desplegado (el ranking ENCIENDE)

**Petición del PO (vía chat):** "quiero que empiece a funcionar el rankeo ya, haz lo que falta, reúne a los
especialistas y que funcione con base de datos y todo. Que aparezca la lista si empiezo a hacer ejercicios."

**Análisis y hallazgos (reconocimiento server-side):**

- El validador real **no existía**: por diseño `validate_workout` dejaba **todo `pending`** y **nunca** escribía
  `verified`, ni `workout_sessions` (ranking de reps/total), ni `daily_challenges` (racha). El ranking estaba
  "latente" aunque las funciones ya estuvieran listas (0019).
- **Handshake de versión roto** (acta 016 §5): `ALLOWED_EVIDENCE_VERSIONS = {12,13}` vs cámara `?v=53` → con
  `ranked=1`, `evidenceIssue` devolvía `unsupported_evidence_version` → sesión **rechazada**.
- **Cuentas prod:** `kozuranibal@gmail.com` (=`70d9264f-...`, nickname "atleta") es **premium activo
  (`expires_at=null`)**; `admin-test@ejemplo.com` premium **expirado**. El PO es el premium → verá la lista.

**Cambios aplicados (solo Edge Function; sin migración):**

- `supabase/functions/validate_workout/index.ts`:
  - `ALLOWED_EVIDENCE_VERSIONS = {12, 13, 53}` (acepta la evidencia actual).
  - **Sesiones libres:** una sesión `ranked` se promueve a `verified` y **escribe `workout_sessions`**
    (`value/target`, `server_value/server_target`, `source='libre'`, `ranked=series_ok`,
    `status='verified'`, `verification_source='server'`, `evidence_hash`, `verification_version`) **solo si pasan
    TODOS los gates:** tier, límites, **entitlement premium (ADR 2026-09-29: el free no compite)**, prueba de
    vida (`livenessOk`) y plausibilidad (`evidenceIssue`). Fallo → `pending`/`rejected` con motivo.
  - **Retos diarios:** un reto con evidencia válida se promueve a `verified` y **hace upsert en `daily_challenges`**
    (`status='completed'`, `completion_source='server'`, `verified_at`, `verification_version`). Alimenta la
    **racha, para todos** (las rachas no son premium).
  - **Fix de idempotencia (bug preexistente):** el camino `already_verified` de completions buscaba el resultado
    con `daily:${date}` fijo; ahora matchea por `client_op_id` real. Además, no se re-escriben filas ya decididas
    (se filtran por `existingDecided`/`decidedDates`) para no degradar un `verified` (invariante 0015).
  - Respuesta: `verified` ahora son propuestas **realmente verificadas** (el cliente recibe `accepted` y limpia su
    cola); mensaje actualizado.

**Despliegue:**

- `npx supabase@latest functions deploy validate_workout --project-ref cgaxpmmbpwaefaigsisu` con
  `SUPABASE_ACCESS_TOKEN` (PAT del PO). Resultado: **versión 3, ACTIVE, verify_jwt=true**. `deno check` OK.

**Verificación end-to-end (usuarios de prueba desechables, borrados al final):**

| Caso                                                        | Resultado                                                                                                                                           |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Premium + sesión `ranked` sentadillas 25/20 + evidencia v53 | `accepted`/`verified`; fila en `workout_sessions` (`server_value=25`, `ranked=true`); aparece en `get_reps_ranking` y `get_total_reps_ranking`      |
| Reenvío (idempotencia)                                      | `already_verified`; **1 sola** fila en `workout_sessions`                                                                                           |
| Free + sesión `ranked`                                      | `rejected` / `ranking_premium_required`; **0** filas (gate ADR OK)                                                                                  |
| Premium + sesión `ranked` sin evidencia                     | `pending` / `missing_evidence` (no se descarta)                                                                                                     |
| Reto diario con evidencia válida (goal `mantener`, hoy)     | `verified`; `daily_challenges` `completed`/`completion_source='server'`/`verified_at`; `get_ranking` → `current_streak=1`, `completed_challenges=1` |

- Datos de prueba **eliminados** (cascade): 0 usuarios/perfiles/sesiones `qa-*` al cierre. Las filas del PO
  quedaron **intactas**.

**Estado / decisiones:**

- **El ranking está encendido** para **libre con 1 ejercicio + "participar del ranking"** (premium) y la **racha**
  para todos. **NO commiteado** (working tree; el PO no lo pidió).
- **Pendiente Fase 4 (acta 016 §3):** habilitar `ranked` en el flujo de **rutina (`seq`, 2+ ejercicios)** — requiere
  decisión UX (mostrar el toggle en multi / comportamiento de gesto y vida por tramo) y prueba en device. Se dejó
  fuera a propósito para no cambiar el flujo de rutina sin validación.
- **Revocar el PAT** usado (quedó expuesto en el chat; no está en el repo).

### 2026-10-16 - Ranking en rutina (seq) + ocultar el ranking a free

**Peticiones del PO (vía chat):** (1) "tener dos ejercicios en rutina no debería ser un impedimento para rankear,
cada ejercicio se rankea por separado"; (2) "ocultar a usuarios free el ranking"; (3) el PAT se deja como está.

**Cambios aplicados (solo cliente móvil; sin migración ni re-deploy del validador):**

- `apps/mobile/app/(tabs)/camretos.tsx`:
  - `ranking = premiumActive && libreRanked`; `buildVerifyUri` recibe `ranked` y `cadenceSec` **también en la rama
    `seq`** (antes se omitían). `buildVerifyUri` ya ponía `ranked=1`/`cadence` fuera del `if/else`, así que el
    problema era la llamada, no la función.
  - El toggle "participar del ranking" se muestra a **premium** tanto en **1** como en **N** ejercicios; se retiró la
    nota `cam.free_setup_routine_note` (y su estilo `routineNote`). Para **free** no se muestra (evita `rejected`).
  - La cámara ya soporta `MODE_RANKED` + `SEQ` (gesto, cadencia y prueba de vida **por tramo**) y `handleMessage` ya
    encolaba cada tramo con su `seqIndex`/`exerciseId`/`ranked`/`evidence`. El server valida las **N sesiones del
    mismo `body`** en un solo loop → **una fila `workout_sessions` por ejercicio** (rank por ejercicio + suma al total).
- `apps/mobile/app/(tabs)/_layout.tsx`: la pestaña Ranking se oculta del tab bar para **no-premium**
  (`href: premium ? undefined : null`).
- `apps/mobile/app/(tabs)/index.tsx`: el botón "VER RANKING" del inicio se oculta para **no-premium**.

**Verificación:**

- `pnpm --filter mobile typecheck` OK · `lint` OK · `test` **210/210 (17 suites)** OK.
- **Falta prueba en dispositivo** ([QA], acta 016 §8 acción 4): matriz 1 vs N ejercicios, mezcla reps/segundos,
  REPETIR, rutina parcial, cola offline, motivos de rechazo, i18n.

**Estado / decisiones:**

- **NO commiteado** (working tree; el PO no lo pidió).
- **Observación ([UX] pendiente):** el texto `progress.ranking_note` ("Clasificación verificada en el dispositivo —
  todavía no se revalida en el servidor") quedó **desactualizado**: el validador server-side ya está activo. Requiere
  actualización de copy es/en/pt (fuera del alcance de esta sesión).

### 2026-10-18 - Reto diario: corte por cadencia con REPETIR + fix de la vida de aguante + cadencia 6 s

**Peticiones del PO (vía chat):** (1) al fallar una repe en el **reto del día** no podía reiniciar (en libre sí
aparece REPETIR); (2) en el reto de **flexiones** la **señal de vida** pidió "bajar y aguantar", el PO bajó y se
quedó en el piso pero la cámara **no la tomó** ("creo que la señal de vida está mal configurada"); (3) **todas** las
cadencias por repeticiones deben ser **6 s** (12 s con la vida).

**Análisis y hallazgos:**

- **Vida de aguante bloqueada por los gates de postura (causa raíz):** la vida `'hold'` (flexiones, plancha) vivía
  **dentro** de `processLateral`, **después** de los gates anti-trampa (`checkComplete`, `grounded`, `line`,
  calibración). Es **el mismo defecto que el acta 015** ya había corregido para la vida `'hand'`, pero **nunca se
  aplicó a `'hold'`** → cualquier desvío de postura al bajar a aguantar (muñeca ocluida, cadera hundida, tobillo
  fuera de cuadro) hacía que un gate devolviera temprano y la vida quedara **ignorada**.
- **El reto no cortaba la serie:** `MODE_RANKED` era la única condición de corte por cadencia. El reto abre la cámara
  **sin** `ranked`, así que la cadencia solo se mostraba y nunca cortaba → sin `failSeries` no había REPETIR.
- **Cadencia:** flexiones tenía 5 s (y otras menos); se unificó a **6 s**.

**Cambios aplicados:**

- `camera-verification.html`:
  - `STRICT_CADENCE = MODE_RANKED || qs.get('strict') === '1'`: la cadencia de corte aplica en ranking **y** cuando el
    reto pide `strict=1`, sin rankear la sesión (`seriesOk` sigue calificando solo a ranking). Usada en `registerRep`,
    `cadenceTick` y `extendCadenceForLiveness`.
  - **Vida de aguante fuera de los gates** (espejo del fix del acta 015): nueva `checkHoldLivenessPose(lm)` evaluada
    **al inicio de `processPose`, antes de cualquier gate**, junto a la vida `'hand'`; se **elimina** el call site
    duplicado dentro de `processLateral`.
  - **Umbral de "abajo" congelado** (`livenessDownThresh`): la vida captura el umbral al **armarse** el desafío y al
    **arrancar**, así no depende de que los gates sigan recalibrando mientras se aguanta.
  - Mensajes de serie cortada (`failSeries`, `stopCamera`: "Serie cortada por pausa larga — tocá REPETIR").
- `apps/mobile/src/retos/verify.ts`: nueva opción `strict?: boolean` → `strict=1`.
- `apps/mobile/app/(tabs)/retos.tsx`: el reto pasa `strict: true` + `cadenceSec: REP_CADENCE[id] ?? DEFAULT_CADENCE_SEC`.
- `apps/mobile/src/retos/catalog.ts`: `REP_CADENCE` **todo en 6 s**; la repe con vida suma 6 s → **12 s**.

**Verificación:**

- `node --check` del `<script>` de la cámara: OK · `pnpm --filter mobile typecheck` OK · `lint` OK · `test`
  **214/214 (18 suites)** OK (nuevo `src/retos/__tests__/verify.test.ts`).
- Publicado en **gh-pages**: `6bab0f2` (reto con cadencia estricta + REPETIR) y `f1aa0ca` (vida de aguante + cadencia
  6). CDN confirmado sirviendo ambos cambios (ETag actualizado).
- **Probado por el PO en dispositivo (2026-10-18): OK** (vida de aguante en flexiones + REPETIR en el reto).

**Estado / decisiones:**

- Sin bump de `VERIFY_VERSION` ni cambio de servidor (`ALLOWED_EVIDENCE_VERSIONS = {12,13,53}` intacto). Acta 018.
- **Commiteado y pusheado** en `main`: `8a6965c` (Fase 4), `7aea329` (cámara), `034b61b` (botón SALIR),
  `aee932e` (pantalla intermedia).
- La vida sigue siendo **reportada por el cliente** (no criptográfica); el fix solo evita que la señal deliberada
  quede bloqueada por los anti-trampa.
- `progress.ranking_note` sigue desactualizado (fuera de alcance).

### 2026-10-18 - Botón SALIR nativo en el header del Retos

**Petición del PO:** "quiero en la pestaña retos un boton salir touch como lo tiene en libre, arriba a la derecha de
la pantalla".

**Análisis y hallazgos:**

- El SALIR del reto vive **dentro** del WebView y pasa por `dwellStep('exit', ...)`, que solo responde si
  `bodyComplete === true`. Con el cuerpo no 100% visible, el botón de la propia cámara no contestaba (mismo bloqueo
  que había que salvar con el fix del acta 018).
- `BrandHeader` ya tenía el patrón en Libre (`libreActive` + `setSalirHandler`), pero **no había estado ni canal**
  para Retos, y los dos efectos comparten un solo slot de handler: reusarlo pisaría la salida de Libre.

**Cambios aplicados:**

- `src/header/LibreExerciseProvider.tsx`: `retosActive` / `setRetosActive` / `setRetosSalirHandler` / `salirRetos`
  (canal propio, no pisar `salir` de Libre).
- `components/BrandHeader.tsx`: mismo `Pressable` de SALIR en el branch `section === 'retos'`, visible solo con
  `retosActive` (`marginLeft: 'auto'` → arriba a la derecha, igual que en Libre).
- `app/(tabs)/retos.tsx`: `exitChallenge()` único, compartido entre el mensaje `exit` del WebView y el botón
  (`setCamaraAbierta(false)`, `setRetoSalido(true)`, `setRetrying(false)`); banderas `showDoneBox` / `showStartBox`
  / `cameraVisible` para no duplicar condiciones del JSX.

**Verificación:** typecheck OK · lint OK · test **214/214 (18 suites)** · probado por el PO en dispositivo: OK.
Commit `034b61b`, pusheado.

### 2026-10-18 - Pantalla intermedia antes de empezar en modo libre

**Petición del PO:** "cuando elijo varios ejercicios para la rutina, arriba aparece la ayuda solamente para el primer
ejercicio... quiero una pantalla mas despues de presionar iniciar... que explique cada ejercicio... y abajo un boton
de continuar. con eso podemos borrar la ayuda que aparece arriba y desplazar todo lo de inicio para arriba".

**Cambios aplicados:**

- `app/(tabs)/camretos.tsx`: nuevo `introOpen` y stage **`setup → intro → cámara`**. La pantalla intermedia lista
  **todos** los ejercicios de la rutina (número, nombre, meta y `TECNICA[id].guia`) y abajo **VOLVER** (al armado) y
  **CONTINUAR** (abre la cámara). Se quitó `resultBar` (la guía que solo mostraba el primer ejercicio): el armado
  ocupa toda la pantalla.
- `src/i18n/translations.ts`: claves nuevas en es/en/pt `cam.intro_title` ("ANTES DE EMPEZAR" / "BEFORE YOU START" /
  "ANTES DE COMEÇAR"), `cam.intro_continue`, `cam.intro_back`.

**Notas [UX]:** sin **VOLVER** no había salida de la pantalla intermedia (se agregó); el botón nativo SALIR del
header **no** aparece en la intermedia, solo con la cámara abierta (consistente con Libre); las guías de `tecnica.ts`
siguen **solo en español** (preexistente, fuera de alcance).

**Verificación:** typecheck OK · lint OK · test **214/214 (18 suites)** · probado por el PO: OK.
Commit `aee932e`, pusheado.

### 2026-10-18 - Backup local punto 24

- Tag **`backup-resiliencia-20261018-223024`** (apunta a `aee932e`); copia local en
  `backups\resiliencia-20261018-223024` (295 archivos, sin `.git` ni `node_modules`).
- Entrada "Punto 24" al inicio de `apps/mobile/backup app resiliencia.txt` (ventana de los últimos 4 bloques).
- Alcance: ranking Fase 4 + cámara v53 (vida de aguante, cadencia 6, REPETIR del reto) + botón SALIR de Retos +
  pantalla intermedia de Libre. Todo commiteado y pusheado.
- Siguen abiertos: `tmp.test` sin trackear (basura) y el **PAT del Management API sin revocar**.

### 2026-10-18 - El reto diario alimenta el ranking de reps (source `reto_diario`)

**Reporte del PO:** completó el reto del día (11 flexiones), aparecía completado, pero **Ranking → Hoy → Reps →
Flexiones** decía "Todavía no hay resultados en este periodo".

**Diagnóstico (prod):** `daily_challenges` 2026-10-18 `completed/server/v53` ✓, pero `workout_sessions` con
`exercise_code='flexiones'` = **0 filas** y `get_reps_ranking('flexiones')` vacío; `get_ranking` (Hoy) sí devolvía
`completed_challenges=1`. Causa: `retos.tsx:142-160` sólo llama `markCompleted` (completación), `pushFreeSession`
sólo existe en `camretos.tsx:127` (Libre), y `get_reps_ranking`/`get_total_reps_ranking` filtraban
`source='libre'` (`0019:131`/`:171`).

**Cambios:**

- `supabase/migrations/0020_challenge_sessions_in_reps_ranking.sql` (**nuevo**): funciones con
  `source in ('libre','reto_diario')`, índice parcial recreado para las dos fuentes y backfill idempotente
  (`client_op_id = 'reto:' || challenge_date`, `ranked = has_active_entitlement(...)`,
  **`created_at = verified_at`** para no machacar todo en el día de la migración).
- `supabase/functions/validate_workout/index.ts`: la completación verified escribe su `workout_sessions`
  (`source='reto_diario'`, `ranked` lo decide **solo** el servidor, `series_ok=true`, `challenge_id`);
  `verifiedSessions` ya no hardcodea `source:'libre'`. **Sin tocar la app.**

**Verificación:** dry run con `rollback` en prod (detectó `CREATE INDEX` con esquema, no admitido) · typecheck/lint
repo OK · **214 + 39 tests** OK · migración **aplicada** · edge **redesplegada** ·
`get_reps_ranking('flexiones', Hoy)` → `atleta best_value 11` · `get_total_reps_ranking` → 16.
**Confirmado por el PO en dispositivo**: "ya lo muestra".

**Estado / decisiones:**

- Decisión del PO: **"que el reto cuente en Reps"**. Revisión cruzada `[BE] + [SEC] + [QA]`.
- Código en **`b386170`**; acta 019 en `docs/equipo/actas/2026-10-18_reto_diario_en_ranking_reps.md`.
- Límites: los períodos filtran `created_at` y no `session_date` (deuda preexistente, acta 017); ventana de fallo
  si el upsert de sesión falla tras escribir `daily_challenges` (reparable re-ejecutando 0020).

### 2026-10-19 - Pestaña Retos en dos pantallas (presentación + cámara a pantalla completa)

**Pedido del PO:** pantalla con el reto del día y su explicación y **abajo el botón INICIAR**; al iniciar, la
pantalla del ejercicio **sin** "TU SEMANA", sin los días, sin "RETO DE HOY" y sin la ayuda del ejercicio, para
**estirar la cámara**.

**Cambio (sólo `apps/mobile/app/(tabs)/retos.tsx`):**

- Nueva variable de fase `fase: 'inicio' | 'camara'` que reemplaza `camaraAbierta`, `retoSalido` y
  `showStartBox`/`showDoneBox`. SALIR y el cierre tras completar vuelven a `'inicio'`; completar no cambia de
  fase (la cámara queda montada para REPETIR/SALIR); REINTENTAR entra en `'camara'`.
- **Inicio**: conserva el encabezado TU SEMANA + fila de días (decisión del PO: no se borra) y suma tarjeta
  **RETO DE HOY** con ejercicio, objetivo (`unit.reps`/`unit.seconds`) y la guía técnica completa, con
  **INICIAR** abajo de todo.
- **Cámara**: sólo la WebView en `cameraContainer`. Del JSX y los estilos se eliminaron `topSection`/
  `titleRow`/`weekRow`, `challengeBar`, `challengeTop`, `cameraTitle`, `cameraMeta` y `cameraGuide`.
- `cameraVisible = challengeBlock && fase === 'camara' && focused` gobierna el SALIR nativo **y** la
  suscripción a `DeviceMotion` (antes también corría en la pantalla de inicio).

**Verificación:** `typecheck` ✓ · `lint` ✓ · **214/214 tests (18 suites)** ✓. Sin cambio de cámara
(`camera-verification.html` sigue **v53**, `gh-pages f1aa0ca`), sin migración y sin deploy de edge.

**Estado / decisiones:** aprobado por el PO ("buena decisión… quedó muy bien, aprobado"). Código en **`87e308b`**;
acta 020 en `docs/equipo/actas/2026-10-19_reto_pantalla_inicio_camara_completa.md`; backup local
`backup-resiliencia-20261019-103354` (Punto 25).

### 2026-10-19 - Inicio: rediseño compacto y responsive (Fase 1)

**Pedido del PO:** acomodar la pestaña Inicio — que el diseñador vea vicios, un diseño más compacto, evaluar qué
más colocar, y usarlo bien **en cualquier pantalla**.

**Auditoría de vicios (`app/(tabs)/index.tsx`):** aire muerto arriba (estilo `title` sin uso), sin scroll ni
`insets.bottom` (FAB IA se recortaba), jerarquía invertida (dos "40"), estilos y `letterSpacing` repetidos,
bloques sin relación visual, sin estado vacío (renderizaba `null`), CTA muerto, hardcode `#1d5c3a` y el bug del
chip "Día N" (`completedCount + 1`).

**Cambios:**

- Tarjeta a **todo el ancho** (ejercicio a la izquierda, meta grande a la derecha).
- **Franja de 3 métricas** en una fila (Racha · Completados · Días `N/M`) con divisores finos, en lugar de los
  chips y la caja de racha flotante.
- Tira de una línea con "Mañana: X" y "Último: ejercicio V"; mejor racha y VER RANKING como texto discreto.
- **Responsive**: `ScrollView` + `insets.bottom`, FAB con safe-area, `numberOfLines`/`flexShrink`, sin anchos
  fijos, `paddingHorizontal: spacing.sm` para llegar casi al borde.
- **Skeleton** si falta el reto; estado de sync integrado al CTA; limpieza de hardcode e imports.
- Soporte: `spacing.xxl` en `design-tokens`; `home.days_short`, `home.last`, `home.best` en i18n (es/en/pt).

**Fuera de alcance (acordado):** peso/IMC/WHtR (salud, [MED]), notificaciones (expo-notifications), accesos
rápidos y consejo del día.

**Verificación:** `typecheck` raíz ✓ · `lint` raíz ✓ (0 warnings) · **214/214 tests** ✓. Aprobado por el PO en
dispositivo. Sin cambios de cámara (v53), sin migración ni edge.

**Estado:** código en **`f3e6df8`**; acta 021 en `docs/equipo/actas/2026-10-19_inicio_compacto_responsive.md`;
backup local `backup-resiliencia-20261019-150015` (Punto 26).

### 2026-10-19 - Inicio: dato de la semana (Fase 1) y competencias geolocalizadas (Fase 2, futuro)

**Pedido del PO:** un "flyer de noticias semanales de deporte" desde fuentes gratuitas. Tras el análisis se
acordó **no** traer noticias de terceros (copyright + red + backend) y usar **contenido propio**; además dejar
**analizado a futuro** un módulo de competencias locales geolocalizadas.

**Fase 1 (implementada):** tarjeta "DATO DE LA SEMANA" en Inicio. `src/retos/weeklyFact.ts` con 7 datos
curados (respiración, descanso, postura, constancia, calentamiento, rango, escuchar el cuerpo) que rotan de
forma **determinística por semana ISO** — sin red, sin backend, sin copyright. i18n es/en/pt
(`weekly.title` + `weekly.<id>.title|body`). Test nuevo `weeklyFact.test.ts`. Verificación: `typecheck` ✓ ·
`lint` ✓ · **221/221 (19 suites)** ✓. Sin cámara, sin migración, sin dependencias nuevas.

**Fase 2 (sólo documentada, NO construida):** módulo de **competencias locales** (running, MTB, calistenia,
gym, natación, aguas abiertas, duatlón, triatlón, tetratlón) publicadas por organizadores. **Decisión de
privacidad tomada: ciudad/región del perfil, sin GPS** (sin permisos nuevos ni consentimiento de ubicación).
Riesgos a resolver antes de construir: atribución/link a inscripción oficial (LEG), moderación de eventos
falsos, textos de salud para eventos exigentes (MED), métricas honestas (DATA) y modelo de pago (FIN).
Encuadre `[PM] + [LEG] + [SEC] + [DATA] (+ [FIN])`. No crear trabajo operativo hasta tener usuarios o un
organizador real (modo lean).

**Estado:** Fase 1 **en disco** (pendiente de prueba del PO y cierre); acta 022 en
`docs/equipo/actas/2026-10-19_inicio_dato_semana_y_competencias_futuro.md`.

### 2026-10-20 - Cierre aprobado: salida automática del reto + dato de la semana

**Prueba del PO:** completado el reto del día en dispositivo, al terminar las repeticiones la app **salió sola
a la pestaña Retos** con la caja de reto completado. **Aprobado.** Se cierra con el protocolo completo.

**Entregado (commit + push):**

- **Auto-salida del reto** (`apps/mobile/app/(tabs)/retos.tsx`): fix del bug "REPETIR queda activo" — al llegar
  un `complete` válido (`reps >= target`) se marca hecho de forma sincrónica y se vuelve a la pantalla de
  inicio del reto. Si no completa, `REPETIR` sigue igual (acta 018).
- **Dato de la semana** (`src/retos/weeklyFact.ts` + `index.tsx` + i18n es/en/pt + test): tarjeta "DATO DE LA
  SEMANA" con 7 datos propios que rotan por semana ISO; sin red, sin backend, sin copyright.
- **Texto de racha**: `home.streak` → DÍAS DE RACHA / STREAK DAYS / DIAS DE SEQUÊNCIA.

**Verificación:** `typecheck` ✓ · `lint` ✓ · **221/221 (19 suites)** ✓. Sin cámara (v53), sin migración, sin
edge, sin dependencias nuevas.

**Estado:** acta 023 en `docs/equipo/actas/2026-10-20_cierre_salida_reto_dato_semana.md`; backup Punto 27.

### 2026-10-20 - Documentado: flujo de pago Premium (free → premium)

**Pregunta del PO:** con la app en Play Store, ¿cómo se pasa un free a Premium pagando?
¿Se activa solo y se controla mensual/anual automáticamente?

**Respuesta (documentada, sin código):** el usuario **paga en la store y el Premium se
activa solo** vía webhook. La app **nunca** se declara Premium localmente. Flujo canónico
(`BITACORA:480`):

```
Play/App Store → RevenueCat → webhook firmado → Supabase Edge Function → entitlements → app
```

Mensual/anual se distingue por el **producto** (`premium_monthly` / `premium_annual`);
la store renueva sola; cancelar **no** revoca (sigue hasta vencer); "Restaurar compra"
reconstruye el estado.

**Ya existe (núcleo server-side verificado):** `entitlements` (fuente de verdad, RLS
select-own), `subscriptions`/`purchases` con ambos SKUs, `rc_event_id` unique
(anti-replay), RPCs grant/revoke/simulador auditadas, gate real en `validate_workout`,
lectura fail-closed en la app, simulador de ciclo de vida en la Console. Precios
decididos: US$2.99/mes, US$19.99/año, trial 7d solo anual (D-D/D-E).

**Falta (ejecución, no diseño):** SDK `react-native-purchases` (dev build, no Expo Go),
paywall real (hoy es un `Alert`), Edge Function `revenuecat_webhook` (con firma +
idempotencia), cuentas Play Console/RevenueCat + productos en Play, cumplimiento (T&C +
data safety), y Fase C de la Console (replay de payloads).

**Ruta crítica ya decidida:** paywall **mock** (sin cobrar) → medir intención de pago →
si convierte (≥8% paywall→plan) → recién ahí pagar cuentas y activar cobro real. Respeta
"sin inversión inicial".

**Estado:** ADR `docs/equipo/adr/2026-10-20_flujo_pago_premium_store.md`. Sin cambios de
código.

### 2026-10-20 - Fondos en silla completado en el catálogo (prod + migración)

**Hallazgo:** el catálogo móvil (`catalog.ts`) ofrecía **9** ejercicios incluyendo
`fondos_silla` (premium), pero la tabla `exercises` de producción tenía un **CHECK que
hardcodeaba solo 8 códigos** y las migraciones nunca insertaban `fondos_silla`. La cámara
(v53), la técnica y el i18n ya lo soportaban completo. Consecuencia: cualquier sesión de
`fondos_silla` era rechazada por la edge `validate_workout` (FK/CHECK sobre `exercise_code`).

**Acción (autorizada por el PO):** en prod `cgaxpmmbpwaefaigsisu` se recreó el CHECK
`exercises_code_check` incluyendo `fondos_silla` y se insertó la fila (premium, reps).
`exercises` pasa de **8 → 9** ejercicios.

**Replicado y versionado:** migración `supabase/migrations/0021_exercise_catalog_fondos_silla.sql`
(idempotente: recrea el CHECK con la lista completa + upsert de la fila).

**Verificación:** `select code, tier from public.exercises` en prod devuelve los 9, con
`fondos_silla` premium. Sin cambios de código en la app (ya lo listaba).

**Estado:** migración 0021 en el repo; sin commitear.

### 2026-10-21 - Fix mínimo: sensor no disponible avisa a la WebView

**Motivo:** en `retos.tsx` y `camretos.tsx`, si `DeviceMotion.isAvailableAsync()` devolvía
`false`, el código hacía `return` **sin avisar** a la WebView; esta esperaba sus 8 s
(`SENSOR_CONFIRM_MS`) y recién ahí mostraba "Sensor no confirmado", sin distinguir "sensor
ausente" de "sensor lento".

**Origen:** propuesta de otro asesor (máquina de estados + handshake completo). Se
**descartó el plan sobredimensionado** y se aplicó **solo el fix mínimo**.

**Cambio:** al detectar `!available`, se inyecta
`window.__resilienciaSetNativeOrientation({ available: false })` (el HTML ya lo maneja,
L2624-2627 → corta de inmediato). Se mantiene el guard `!active`. 2 archivos, +14/−2.

**Alcance:** no se toca cámara, HTML ni `VERIFY_VERSION` (sigue 53); sin deploy de gh-pages.

**Verificación:** PO en dispositivo (Caso 1, teléfono con sensor OK): Retos → INICIAR y Modo
Libre arrancan **normalmente** — el fix no rompió el camino normal. Casos 2/3 (forzar sensor
ausente) sin efecto por decisión del PO. `typecheck` ✓ · `lint` ✓ · **221/221 (19 suites)** ✓.

**Límite:** el aviso depende del orden de carga (si `isAvailableAsync` resolviera antes del
hook, el `&&` lo descarta); riesgo bajo porque el efecto se monta con la cámara ya visible.
No verificado en dispositivo.

**Estado:** acta 025 en `docs/equipo/actas/2026-10-21_fix_sensor_no_disponible.md`.

### 2026-10-21 - Prueba de vida sin bucle (v54) + sincronización de versión de evidencia

**Motivo:** el PO reportó un **bucle rápido de la señal de vida** en el reto diario de
flexiones ("señal de vida → ejercicio → señal de vida → …"). Diagnóstico ([CV]/[BE]): el
desafío se **cancelaba** al perder un frame de pose y dejaba `livenessNextTriggerAt` vencido →
se rearmaba al instante, y cada rearme renovaba la cadencia estricta (anulaba `strict`).

**Origen:** propuesta de otro asesor ([CV]) revisada por el equipo y aprobada por el PO.

**Cambio:** solo `camera-verification.html` (65 inserciones, 4 borrados): no reiniciar la vida
por pérdida breve de pose; `livenessNextTriggerAt = null` al armar; timeout `LIVENESS_TIMEOUT_MS
= 10000` → `failLiveness()` corta con REPETIR; `livenessCadenceExtended` (extiende cadencia
**una sola vez**); limpieza de temporizadores/estados al pasar o fallar. **Deploy** HTML v54 a
gh-pages (`f1aa0ca..da7ab49`).

**Sincronización obligatoria:** `verify.ts` `VERIFY_VERSION` **53 → 54**; edge
`validate_workout` `ALLOWED_EVIDENCE_VERSIONS` **`[12,13,53]` → `[12,13,53,54]`** +
**redeploy** de la edge.

**Incidente detectado y corregido:** el PO hizo el reto **antes** de actualizar la edge y fue
**rechazado** con `unsupported_evidence_version` (la cámara firmaba v54, la edge solo aceptaba
hasta 53). No fue culpa del PO ni del registro. Corregido en la edge; el PO rehízo el reto por
cámara ("reintentar reto" reenvía por cámara) y quedó **`verified`**: `workout_sessions`
`reto:2026-10-21`, `ranked=true`, `series_ok=true`, `verification_version=54`,
`verification_source=server`.

**Guard nuevo:** `apps/mobile/src/retos/__tests__/evidenceVersionSync.test.ts` falla si
`VERIFY_VERSION` no está en `ALLOWED_EVIDENCE_VERSIONS` → atrapa la desincronización antes de
prod. Regla: **bump de versión + edge + deploy en el mismo movimiento**.

**Verificación:** PO en dispositivo: reto completo con señal de vida, sin bucle, **verified** en
prod. `typecheck` ✓ · `lint` ✓ · **222/222 (20 suites)** ✓.

**Estado:** acta 026 en `docs/equipo/actas/2026-10-21_prueba_de_vida_v54_y_sincronizacion.md`.

### 2026-10-21 - Deuda técnica: dependencias desalineadas de Expo SDK 57 (no se toca ahora)

**Motivo:** `npx expo install --check` reportó **11 paquetes** fuera de la versión
recomendada para Expo SDK 57. Investigación del historial (confirmada):

- `expo-camera` y `react-native-webview` entraron con **`pnpm add`** (commit `48990d4`,
  implementación de la cámara por WebView), **no** con `expo install` → se instaló la
  última versión, sin consultar la tabla de compatibilidad de SDK 57.
- `onPermissionRequest` (permisos de cámara) quedó **asociado al runtime de webview v14**;
  la deuda ya conocida es que **no está tipado** en v14 (se usa con `any`).

**Inventario (actual → esperado):**

- `expo-camera` 15.0.16 → ~57.0.6 (**major**)
- `react-native-webview` 14.0.1 → 13.16.1 (**downgrade**; ligado a permisos de cámara)
- Patch: `expo` 57.0.20→~57.0.31, `expo-auth-session` 57.0.11→~57.0.16,
  `expo-constants` 57.0.17→~57.0.22, `expo-crypto` 57.0.3→~57.0.4,
  `expo-linking` 57.0.9→~57.0.13, `expo-router` 57.0.19→~57.0.29,
  `expo-sqlite` 57.0.2→~57.0.4, `expo-web-browser` 57.0.2→~57.0.3,
  `jest-expo` 57.0.5→~57.0.6.

**Decisión:** **no cambiar nada ahora** (la app funciona; la cámara/WebView/sensor están
estables). Abordar **de forma controlada antes del release** (APK/AAB a Play Store):
`expo install --fix` sobre un punto de backup, **prebuild nativo + build real** (no solo
Expo Go) y **prueba en dispositivo de cámara/WebView/sensor** por el PO. Los tests de Jest
**no** cubren el lado nativo, así que un verde no garantiza build sano.

**Regla preventiva:** usar **`npx expo install <pkg>`** (nunca `pnpm add`) para dependencias
de Expo, para no reintroducir esta desalineación.

**Estado:** solo registro; **sin cambios de dependencias ni de versiones**.

### 2026-10-21 - Deuda de seguridad: defensa contra clientes modificados (no se implementa ahora)

**Motivo:** propuesta de un asesor para endurecer la protección contra evidencia falsificada,
en capas. Revisada por [SEC]/[BE] con una **corrección importante**: la Edge Function **no
rederiva la evidencia cruda**; es autoridad del **estado**, pero parte del input sigue siendo
**declarado por el cliente**.

**1. Qué controles ya existen (server-side):**

- El servidor es la **autoridad del estado**: solo él marca `verified`
  (`verification_source='server'`); el cliente solo **propone**.
- **Deriva en server** lo derivable: ejercicio, meta, unidad y fecha del reto.
- **Lista blanca de versiones** de evidencia (`ALLOWED_EVIDENCE_VERSIONS`).
- **Límites de valores**, validación de duración mínima, cadencia, objetivo, `series_ok`.
- **Deduplicación / anti-reenvío**: `client_op_id` + unique `(user_id, client_op_id)` + `upsert`;
  `decidedDates` bloquea fechas ya `verified`.

**2. Autoridad del estado ≠ verificar evidencia cruda.**

El server **decide** el estado final, pero **no rederiva la prueba de vida ni el conteo**: valida
que el cliente envíe campos **coherentes** (`livenessPassed`, `durationMs`, `startedAt`,
`finishedAt`, `evidence`, `seriesOk`), no que sean **auténticos**.

**3. Qué campos todavía puede falsificar un cliente modificado:**

`livenessPassed`, `seriesOk`, `evidence`/`onPermissionRequest`, `durationMs`, `startedAt`,
`finishedAt`. Un hash del cliente, una firma con clave embebida o un `livenessOk:true` son
**falsificables** y por eso **no** se usan como fuente de verdad.

**4. Prioridad de lo que falta:**

1. **Rate limiting** por usuario/dispositivo (dificulta ataques automatizados).
2. **Nonce / intento firmado** — principalmente **anti-replay**; por sí solo **no** impide
   fabricar evidencia nueva.
3. **Play Integrity (Android) / App Attest (iOS)** + verificación server-side del token —
   antes de competencia pública o premios.
4. **Validación de evidencia real** (video/frames) — solo si se requiere confianza alta.

**5. Decisión:** **no implementar ahora.** Un nonce emitido por el servidor **exige round-trip
previo** y **rompería el modo offline-first** de la cámara; no se implementa sin diseñar antes
cómo convive con el offline. Queda como **deuda de seguridad de release**.

**6. Condición para resolverlo:** **antes** de rankings públicos, premios o release comercial
(APK/AAB a Play Store). No es urgente hoy: no hay usuarios reales compitiendo.

**Conclusión:** la app ya tiene **validación server-side sólida** contra datos inválidos y
duplicados, pero **todavía no** tiene defensa fuerte contra una **aplicación cliente modificada**.

**Estado:** solo registro; **sin cambios de código**.

### 2026-10-21 - Plan de verificación server-side (mínimo lean): estado real de cada punto

**Motivo:** recomendación de un asesor con un "mínimo" para verificar que la app funciona.
Revisada por [SEC]/[QA]/[BE] contra el código real de la Edge Function. De los 5 puntos,
**3 ya están hechos**, **1 es parcial** y **1 falta entero**.

**1. Mantener la validación server-side actual — ✅ HECHO.**
`validate_workout` valida ejercicio, meta, fecha, unidad, duración y cadencia; decide el estado
final (`verified`/`pending`/`rejected`).

**2. Rate limiting básico — ⚠️ PARCIAL.**
Existe tope de **tamaño de lote** (`MAX_BATCH = 50`, `index.ts:10`, chequeado en `:390-392`),
pero **NO hay** límite por **usuario/IP ni ventana de tiempo**. Falta un contador básico por
usuario/ventana (barato para el modo lean); un sistema con estado pesado no se justifica.

**3. Idempotencia — ✅ HECHO.**
`client_op_id` único (`(user_id, client_op_id)`) + `upsert`; `decidedDates` bloquea fechas ya
`verified` (no degrada ni duplica).

**4. Motivos de rechazo distinguibles — ✅ HECHO.**
La edge devuelve motivos específicos: `unsupported_evidence_version`, `invalid_evidence`,
`invalid_duration`, `impossible_duration`, `invalid_timestamps`, `impossible_cadence`,
`liveness_failed`, `invalid_target`, `challenge_mismatch`.

**5. Probar los 5 casos — ❌ FALTA (ítem de más valor hoy).**
No existe ningún test de la Edge Function (`supabase/` sin archivos de test). Casos a cubrir:
sesión válida → pending/verified; meta incorrecta → rejected; duplicada → no duplica; reintento
de rechazada → funciona; sesión offline → cola y sincroniza después.
**Nota técnica:** la edge corre en **Deno** y no hay `deno` instalado localmente; hay que decidir
cómo testearla (`deno test` o extraer y testear la **lógica pura**). Es tarea real, no trivial.
Este punto habría atrapado el incidente real de hoy (`unsupported_evidence_version` v54 vs edge).

**No implementar (acordado):** nonce, Play Integrity/App Attest y validación de video — medidas
de release/rankings importantes (ver entrada anterior).

**Prioridad recomendada:** **tests de la edge primero** (capturan lo que ya rompió), luego rate
limit **básico** por usuario/ventana.

**Estado:** solo registro; **sin cambios de código**.

### 2026-10-21 - Flexiones en horizontal (celular apaisado): experimento en el banco

**Petición del PO:** probar flexiones con el celular **en horizontal** (pantalla girada 90°)
para que el cuerpo de perfil entre completo en el cuadro, con los botones cerca del pulgar.

**Hallazgo previo (el cálculo viejo no podía ver el horizontal):** el puente nativo usaba
`tilt = atan2(|gz|,|gy|)·180/π`, `vertical = tilt ≤ 35` y el guard `hypot(gy,gz) < 1`.
El cálculo **ignora el eje `x`**: con el celular apaisado daba 0 (falso "vertical") y el guard
**descartaba la muestra** justamente en ese caso → el puente dejaba de informar la
orientación y la página quedaba con el último valor.

**Cambios aplicados (solo el banco; producción intacta):**

- `apps/banco de pruebas de ejercicios/src/lib/orientation.ts` (nuevo) + test (7 casos):
  clasificador de **tres ejes** (`portrait` / `landscape` / `flat` / `tilted`), misma tolerancia
  de 35° pero con el **eje dominante** mandando (`|y| ≥ |x|` vertical, `|x| ≥ |y|` apaisado).
- `src/screens/TestScreen.tsx`: el puente manda `{ available, orientation, vertical, landscape,
beta }`; la página acepta el contrato viejo. Chrome nativo compacto en horizontal.
- `camera-verification-bench.html`: gate **por ejercicio** (`cfg.orientation`), mensajes
  ("Girá el celular a horizontal (apaisado)" / "Poné el celular parado en vertical"), badge
  "Vertical"/"Horizontal" y layout ancho (`data-layout="wide"`: video 16:9 y botones fijos en la
  esquina inferior derecha).
- Ejercicio del banco `flexiones_landscape` (mismo CFG que `flexiones` + `orientation:
'landscape'`), con marca en catálogo, chat y home.
- `app.json` del banco: `"orientation": "portrait"` → `"default"` (para que la app gire).
- `VERIFY_VERSION` del banco 48 → 49 y publicación en gh-pages (commit `1fcb838`).

**Verificación:** banco con `typecheck` ✓ `lint` ✓ **39/39 tests** ✓; HTML parseado con
`node --check` ✓; página publicada y **verificada servida** (contiene el clasificador, el gate y
el ejercicio); las tres copias del HTML con hash idéntico (`7FF8ADEF…F7495`);
`camera-verification.html` de producción **sin cambios**.

**Pendiente:** validación del PO en dispositivo (que la app rote, el cuerpo entre completo, las
reps coincidan con `flexiones` en vertical y los dos sentidos de giro). Ojo: si Expo Go no
respeta el `app.json`, la app queda trabada en vertical y el experimento no es testeable ahí.

**Estado:** código commiteado y publicado; **sin aprobación todavía como característica de
producción** (ver `docs/equipo/actas/2026-10-21_flexiones_horizontal_banco.md`).

### 2026-10-21 - Registro consolidado de pendientes para Play Store y Premium real

**Motivo:** el PO pidió consolidar qué falta para publicar ResiliencIA en Google Play,
cobrar suscripciones Premium y actualizar automáticamente el acceso cuando cambie el estado
del pago.

**Registro existente localizado:** este pendiente ya tenía una base en el ADR
`docs/equipo/adr/2026-10-20_flujo_pago_premium_store.md` y en la entrada de flujo de pago del
2026-10-20. Esta entrada **no crea una arquitectura alternativa**: ordena y amplía el
backlog de release con lo que todavía no está implementado o verificado.

#### Lo que ya está construido

- Tablas `entitlements`, `subscriptions` y `purchases`.
- Productos definidos: `premium_monthly` y `premium_annual`.
- Entitlement server-side `premium` y lectura fail-closed en la app.
- Gate Premium en `validate_workout`.
- Simulador de ciclo de vida en ResiliencIA Console.
- Idempotencia de eventos simulados mediante `rc_event_id`.
- Perfil de build de producción con incremento automático del `versionCode`.

Esto **no equivale todavía a cobros reales**: la app no tiene SDK de compras, paywall real
ni webhook de RevenueCat.

#### Pendientes P0 — necesarios para cobrar Premium de verdad

1. **SDK nativo de compras:** integrar `react-native-purchases` y configurar el `appUserID`
   con el `auth.uid()` de Supabase. Requiere development build/EAS; Expo Go sirve para la
   interfaz y simulación, pero no para compras reales.
2. **Pantalla Premium real:** reemplazar el `Alert` actual por planes mensual/anual, precio
   entregado por la store, prueba anual si se mantiene, compra, estados pendiente/error,
   restaurar compras y acceso a administrar/cancelar la suscripción.
3. **Webhook `revenuecat_webhook`:** crear y desplegar la Edge Function con firma Bearer,
   comparación constante, mapeo seguro de `app_user_id`, escritura server-side,
   idempotencia por `rc_event_id` y matriz de eventos: compra, renovación, cancelación,
   vencimiento, reembolso, transferencia y problema de facturación.
4. **Sincronización automática del entitlement:** refrescar después de comprar/restaurar, al
   volver al foreground, al iniciar sesión y al abrir la app en otro dispositivo. Agregar
   listener de cambios del SDK y corregir la caché para que quede asociada al `userId`.
5. **Configuración comercial:** crear en Play Console los productos y base plans exactos,
   precios, países, impuestos, renovación y testers; enlazarlos con RevenueCat y el
   entitlement `premium`.
6. **Pruebas end-to-end:** compra, prueba, pendiente, rechazo, restauración, renovación,
   cancelación, vencimiento, reembolso, problema de facturación, cambio de cuenta,
   reinstalación, offline/reintento y webhook duplicado.

#### Pendientes P1 — publicación y cumplimiento

1. Política de privacidad pública y enlace visible dentro de la app.
2. Términos de suscripción con precio, frecuencia, renovación automática, cancelación,
   prueba y reembolsos.
3. Flujo para eliminar la cuenta y los datos; hoy existe cerrar sesión/borrar progreso,
   pero no eliminación de cuenta.
4. Formulario Data Safety, clasificación de contenido, público objetivo y declaración del
   uso de cámara, sensores, evidencia y datos de cuenta.
5. Ficha de Play Store: icono final, capturas, descripción, soporte y correo de contacto.
6. Verificar el `targetSdk` del `.aab` generado. La documentación antigua del proyecto
   menciona API 35; antes de publicar debe confirmarse el requisito vigente de Play y el
   target real del build.
7. Crear el `.aab` firmado, probarlo en track interno/cerrado y completar el rollout
   gradual. La cuenta personal nueva puede quedar sujeta al requisito de testers y días de
   prueba cerrada.
8. Ejecutar `expo-doctor`/verificación de dependencias y resolver de forma controlada la
   deuda de Expo SDK 57 antes del build final, con prueba real de cámara, WebView y sensor.

#### Aclaración sobre “actualización automática”

- **Actualización de la app:** la gestiona Google Play; el usuario puede tenerla automática
  o manual según su configuración.
- **Actualización de Premium:** la produce el webhook y la lectura fresca del entitlement;
  no requiere publicar una nueva versión de la app.
- **Actualización OTA:** `expo-updates` sería opcional para cambios JavaScript, pero no
  reemplaza una publicación cuando cambian módulos nativos como billing.

#### Propuesta: “Pantalla de planes” en Inicio

**Opinión del equipo:** aprobada como **paywall mock de F2**, sin cobro todavía. Es una buena
forma de medir interés antes de pagar cuentas externas y activar el billing real, siempre que
no prometa una compra inexistente.

Recomendación UX:

- Mostrar en Inicio una tarjeta discreta: **“Conocé Premium”** o **“Ver planes Premium”**.
- Abrir una pantalla común reutilizable desde Inicio, Retos y Ajustes/Perfil.
- Comparar Free vs Premium y mostrar mensual/anual, beneficios y prueba prevista.
- En modo mock, el botón debe decir **“Avisarme cuando esté disponible”** o equivalente;
  no debe simular que el usuario pagó ni activar Premium localmente.
- Cuando exista billing real, esa misma pantalla se conecta al SDK y agrega Comprar,
  Restaurar compras y Administrar suscripción.

**Decisión:** implementar primero la pantalla como presentación/medición, sin activar
entitlements ni inventar cobros. El acceso desde Inicio es recomendable, pero no debe
reemplazar la entrada desde Retos ni convertirse en un banner invasivo.

**Estado:** registro actualizado; sin cambios de código en esta entrada. El ADR de flujo de
pago continúa siendo la fuente de verdad arquitectónica.

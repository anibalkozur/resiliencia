# Acta 012 — Política de prueba de vida ("solo se rankea con vida")

- **Fecha**: 2026-10-13 · **Tipo**: decisión de producto + implementación · **Fase**: 3 (producto) con efecto en el gate (Fase 0).
- **Estado**: **implementado** (código en cámara + móvil). Pendiente de verificación del PO con Expo Go.
- **Conduce**: [DER] · **Decide**: [PO] · **Implementa**: [DER].
- **Referencia**: acta 011 `2026-10-13_revision_seguridad_calidad.md`, `docs/equipo/estado.md`, `camera-verification.html` (prod).

## 1. Problema

- La prueba de vida de la cámara se dispara con un **temporizador aleatorio de 4–13 s** desde el primer "arriba". En series cortas (p. ej. ranking con meta ≤ 5) la serie puede terminar **antes** de que salga el desafío → el resultado se enviaba **sin vida**.
- Además, el reto diario abría la cámara **sin** `ranked=1`, y la vida funcionaba "por casualidad" (el servidor la exige por evidencia, no por modo): frágil ante futuros cambios.

## 2. Decisión [PO]

> **"Solo se rankea si hizo la prueba de vida: durante la serie si la meta es
> mayor a 10 repes; si es 10 o menos, al finalizarla."**

Reglas derivadas:

1. **Cuándo**: meta de repes **> 10** → la vida se pide **durante** la serie
   (temporizador aleatorio 4–13 s), pero **nunca antes de terminar la repe 5**.
   Meta de repes **≤ 10** → la vida se pide **al final** (no se interrumpe una
   serie corta). Ejercicios por segundos (plancha, sentadilla isométrica):
   durante (son largos).
2. **Garantía**: en una sesión validada (ranking o reto diario) **nunca** se
   envía el resultado sin prueba de vida. Si la vida durante no salió, se pide al
   final (respaldo).
3. **Repes de la vida**: en la repetición donde se pide la vida **durante** la
   serie, la cadencia de esa repe pasa a **12 s** (6 s normales + 6 s extra) para
   dar la señal **y** completar la repetición.
4. **Consigna (voz/overlay)**: la señal de vida **al final** usa la **misma**
   instrucción que la aleatoria durante la serie ("Señal de vida. Levantá la mano
   por encima de la cabeza"; en ejercicios de aguante, "bajá y aguantá"). **Tras
   dar la señal**, la voz anuncia "Serie completa" (en la misma locución final,
   para que el TTS no la corte; sin duplicarla si la frase del turno ya empieza
   con "Serie completa").
5. **Alcance**: sesiones validadas = modo libre rankeado (`ranked=1`) y reto
   diario (`liveness=1`). Cierra el bypass de metas ≤ 5 (antes quedaban sin vida).

## 3. Implementación

### 3.1 Cámara (`camera-verification.html`)

- **`LIVENESS_REQUIRED`** (`MODE_RANKED || qs.get('liveness') === '1'`): marca si la sesión exige vida para acreditarse.
- **`livenessEnabled`**: se pide vida en sesiones validadas, por segundos o meta > 5 (sin cambios).
- **`livenessEndOnly`** (`targetUnit === 'reps' && targetVal <= 10`): la vida va **solo al final**; `scheduleLiveness()` no arma el temporizador.
- **Vida aleatoria con meta > 10**: `scheduleLiveness()` no arma antes de `LIVENESS_MIN_REP = 5`; se arma al completar la repe 5 (`registerRep`), así que sale aleatoria (4–13 s) pero **después de la repe 5**.
- **Fallback al final** en `postComplete`: si la vida está habilitada, la meta está cumplida y `livenessPassed` es falso → **no** se envía; se arma el desafío y se envía al confirmarlo (`onLivenessPassed`). Es el camino normal de las series ≤ 10.
- **`onLivenessPassed()`**: centraliza el "pasó la vida" (estado, overlay, log, voz) y, si había un resultado pendiente, lo envía con la voz "Serie completa" (vida al final).
- **Cadencia de la repe con vida**: `extendCadenceForLiveness` da `CADENCE_MS + 6000` (12 s con cadencia 6) para dar la señal y completar la repe.
- **Consigna**: la vida (durante o al final) usa la misma instrucción — "Levantá la mano por encima de la cabeza" / "Señal de vida. Levantá la mano por encima de la cabeza" (o "Bajá y aguantá…" en aguante). Al **confirmarse al final**, la locución final antepone "Serie completa" (`postComplete(detail, 'Serie completa')`, una sola frase para no pisar el TTS) **salvo** que la frase del corpus `done` ya empiece con "Serie completa" (p. ej. "Serie completa. Recuperate."), para no decirla dos veces.
- **Re-entrada**: `postComplete` no rearma ni reenvía si ya hay un resultado pendiente (la serie de segundos llama en cada cuadro mientras sostiene).
- `completed` sigue sin activarse hasta enviar: el detector sigue corriendo para poder capturar la vida final.
- Sin cambios en el servidor ni en el contrato de evidencia (`livenessRequired`/`livenessPassed` ya existían).

### 3.2 Móvil

- `apps/mobile/src/retos/verify.ts`: nueva opción `requireLiveness` → `liveness=1`; **`VERIFY_VERSION` 46 → 51**.
- `apps/mobile/app/(tabs)/retos.tsx`: el reto diario ahora abre la cámara con `{ requireLiveness: true }` (antes dependía de que la meta fuera > 5).
- Modo libre (`camretos.tsx`) ya pasa `ranked=libreRanked`, así que el libre rankeado queda cubierto sin cambios.

## 4. Verificación (hecha)

- `pnpm typecheck` ✓ · `pnpm lint` ✓ · `pnpm prettier --check` ✓.
- `apps/mobile` tests **181/181** (15 suites) ✓ · `apps/console` **39/39** ✓.
- Pendiente: prueba manual del PO con Expo Go (series cortas y largas, con y sin ranking; reto diario).

## 5. Efectos y límites

- **Cierra** los dos huecos detectados: meta ≤ 5 en ranking y reto diario sin `ranked=1`.
- **No** cambia el ranking real: las sesiones siguen entrando `pending` hasta que exista el validador server-side (ver acta 011 §7). Esto **no** simula la verificación.
- La vida **sigue siendo reportada por el cliente** (no es prueba criptográfica); es una barrera anti-replay más, no una garantía absoluta.
- Sesiones no validadas: si la meta > 5, la vida se sigue pidiendo durante la serie como antes; **no** se bloquea el cierre (sin cambios).

## 6. Acciones

1. **[PO]**: probar con Expo Go y firmar/observar.
2. **[DER]**: publicar a gh-pages (`camera-verification.html` v51) para la prueba.
3. **[DER]**: con OK del PO, commit + push a `main`, backup y actualizar `estado.md`/`BITACORA.md`.

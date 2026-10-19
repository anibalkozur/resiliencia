# Acta 016 — Ranking por ejercicio en la rutina (modo libre)

- **Fecha**: 2026-10-16 · **Tipo**: decisión de producto (ranking) · **Fase**: 1 (producto) → implementación en Fase 4 (verificación real).
- **Estado**: **implementado** (2026-10-16). El validador server-side está desplegado
  (acta 017) y el ranking en modo rutina quedó encendido: cada tramo del `seq` viaja
  con `ranked=1` y rankea por ejercicio, además de sumar al total.
- **Participan**: [PO] (decide), [CV]/[DER], [BE], [SEC], [QA], [MOB], [DATA], [UX]/[GRO], [PM].

## 1. Motivo

El PO plantea que quien **arma sus rutinas a diario** debería **participar del
ranking**. Hoy el modo libre con **2 o más ejercicios** corre como serie
(`seq=id:meta,...`) y **queda fuera del ranking** por diseño.

## 2. Cómo funciona hoy el ranking (verificado)

- **Grano: por ejercicio.** `get_reps_ranking(exercise)` = **mejor sesión** por
  usuario (máx. `value`, con `ranked && series_ok AND source='libre' AND value >= target`).
  `get_total_reps_ranking()` = **suma de volumen**. La **racha** (`get_ranking`)
  sale aparte, de los retos diarios.
- **UI** (`ranking.tsx`): pestañas **Racha · Reps (por ejercicio) · Total**.
- **Sin período:** los tres tableros son **histórico/acumulado (all-time)**. No
  existe día/mes/año ni temporadas (lo único con "period" en el esquema son las
  **suscripciones**, no el ranking).
- **Rutina en modo libre** (`camretos.tsx`): 1 ejercicio → flujo único (ranking
  posible); **2+ → `seq` sin `ranked`** y con la nota "La rutina no participa del
  ranking".
- **Ranking latente:** todo entra `pending` (no existe validador server real);
  además el **handshake de versión de evidencia está viejo** (§5).
- **Tier:** el ADR `2026-09-29_free-sin-ranking_premium-todo.md` fija que el
  **free no participa de ningún ranking** (solo premium); la racha es para todos.

## 3. Decisión [PO]

> **"Para mí debe estar en ranking de ejercicio por separado, por más que el
> usuario haga una seguidilla de ejercicios distintos o iguales: rankea el de
> mayor volumen y además le suma al ranking total."**

En concreto: **encender el ranking en el modo rutina** y que **cada ejercicio del
recorrido compita por separado**; si la rutina **repite** un ejercicio (o se usa
REPETIR), **igual cuenta** — la **mejor sesión** (mayor volumen) va al tab "Reps"
de ese ejercicio y **cada sesión suma** al "Total". Coincide con el grano actual:
**no cambia la matemática del ranking, solo se habilita `ranked` en la rutina**.

## 4. Diseño técnico

- **Server:** el grano ya es por ejercicio (`get_reps_ranking` /
  `get_total_reps_ranking`); **no requiere cambio de esquema** para "mejor + total".
  Cada tramo del `seq` ya viaja con `exerciseId`, `seqIndex`, `value`, `ranked`,
  `seriesOk`, `livenessOk`, `cadence` y `evidence` propios.
- **Cámara (`camera-verification.html`):** evaluar por tramo el gesto de arranque,
  la **cadencia** y la **prueba de vida**; cuidar que el _dwell_ de "SIGUIENTE" entre
  tramos **no reinicie/extienda** la cadencia del tramo anterior.
- **App (`camretos.tsx`):** pasar `ranked=1` también en modo `seq` (hoy se omite a
  propósito) y retirar la nota `cam.free_setup_routine_note` cuando aplique.

## 5. Advertencias asentadas

- **[SEC] Auto-inflado:** repetir un ejercicio en la misma rutina (o REPETIR)
  infla `get_total_reps_ranking` y da **varias chances** a `get_reps_ranking`.
  El PO **acepta** que las repeticiones cuenten; queda como opción a evaluar un
  **tope/dedupe por ejercicio/día** si aparece abuso.
- **[BE]/[DER] Handshake de versión roto:** el server acepta
  `ALLOWED_EVIDENCE_VERSIONS = {12, 13}` (`validate_workout/index.ts`), pero la
  cámara manda `evidence.verifyVersion = ?v = 53`. Con `ranked=1`, `evidenceIssue`
  devuelve **`unsupported_evidence_version`** → la sesión se **rechaza**.
  **Debe corregirse antes de encender** el ranking en cualquier flujo.
- **Ranking no verificado:** sin validador real, todo queda `pending`; **no se
  comunica ranking verificado** (se preserva la honestidad de la UI).
- **Tier:** sigue siendo **premium** (los ejercicios de rutina ya lo son);
  la **racha** permanece para todos.

## 6. Decisiones complementarias (2026-10-16)

1. **Períodos del ranking: SÍ.** El ranking se muestra por **Hoy · Semana · Mes ·
   Año · Histórico** (default **Histórico**); las funciones se parametrizan con
   ventana de fechas (`p_since`) y la pestaña Ranking suma un **selector de
   período** (§7).
2. **Tope anti-inflación: sin tope.** Las repeticiones dentro de una rutina
   cuentan (mejor sesión + suma al total), según §3.
3. **Momento de encendido:** junto con el **validador real** (Fase 4), no antes.

## 7. Diseño — pestaña Ranking con períodos

**Ubicación:** `apps/mobile/app/(tabs)/ranking.tsx`.

**Layout (mock):**

```
┌ RANKING ─────────────────────────────┐
│ [HOY][SEM][MES][AÑO][HISTÓRICO]      │  ← fila de períodos (scroll horiz.)
│ [ Racha ][ Reps ][ Total ]           │  ← tabs de métrica (actuales)
│ <lista / estado vacío del período>   │
└──────────────────────────────────────┘
```

- **Períodos** (nuevo): chips horizontales, mismo estilo que los chips de
  ejercicio. Default **Histórico**.
- **Métricas** (sin cambios): `Racha · Reps · Total`. El período aplica a las tres:
  - **Reps** → mejor sesión del ejercicio **dentro del período**.
  - **Total** → volumen acumulado **dentro del período**.
  - **Racha** → retos completados **dentro del período** (la "racha actual" sigue
    siendo un valor de HOY, independiente del período).
- **Estados vacíos honestos** por período ("Todavía no hay resultados en este
  período"), nunca "verificado".

**Backend (migración nueva):** parametrizar las funciones con `p_since
timestamptz` (null = histórico); el corte se deriva del período:

| Período   | Corte                                    |
| --------- | ---------------------------------------- |
| Hoy       | `date_trunc('day', now())`               |
| Semana    | `date_trunc('week', now())` (ISO, lunes) |
| Mes       | `date_trunc('month', now())`             |
| Año       | `date_trunc('year', now())`              |
| Histórico | `null`                                   |

- Firmas: `get_reps_ranking(p_exercise, p_since)`, `get_total_reps_ranking(p_since)`,
  `get_ranking(p_since)`. Índices por `created_at` para el corte.
- `syncService.ts`: `fetchRanking`/`fetchRepsRanking`/`fetchTotalRepsRanking`
  suman un `since` (ISO) opcional.

**i18n (es/en/pt, paridad):** `progress.period_day|week|month|year|all`.

**Nota:** depende del validador real para tener datos (hoy las tablas están
vacías). Se puede adelantar la **UI** (selector + estados vacíos) sin datos.

## 8. Acciones

1. **[PO]**: decisión tomada (§3). — **Hecho**.
2. **[BE]/[DER]**: corregir el handshake de versión de evidencia. — **Hecho** (acta 017: v53 aceptada y
   validador real desplegado; el ranking enciende para libre 1-ejercicio + racha).
3. **[CV]/[MOB]**: diseño/implementación del ranking por tramo en el `seq`
   (gesto, cadencia, vida por tramo) + retiro de la nota. — **Hecho** (2026-10-16):
   `camretos.tsx` pasa `ranked` y `cadence` también en la rama `seq`; el toggle
   "participar del ranking" se muestra a premium tanto en 1 como en N ejercicios;
   se retiró la nota `cam.free_setup_routine_note` y su estilo. La cámara ya
   soporta `MODE_RANKED` + `SEQ` (vida y gesto por tramo) y `handleMessage` ya
   encolaba cada tramo con su `seqIndex`/`evidence`. El server valida las N
   sesiones del mismo `body` en un solo loop (una fila por ejercicio).
   **Pendiente de prueba en dispositivo** ([QA], acción 4).
4. **[PO] Ocultar el ranking a usuarios free** (2026-10-16): la pestaña Ranking se
   oculta del tab bar (`href: null`) para no-premium, se oculta el botón
   "VER RANKING" del inicio, y el toggle de participación solo se muestra a
   premium. Refuerza el ADR `2026-09-29_free-sin-ranking_premium-todo.md`.
5. **[QA]**: matriz 1 vs N ejercicios, mezcla reps/segundos, REPETIR, rutina
   parcial, cola offline, motivos de rechazo, i18n. — **Pendiente**.
6. **[MOB]/[BE]**: selector de período en la pestaña Ranking + funciones con
   `p_since` (migración) + i18n. — **Hecho** (UI = Fase A, commit `c427f6a`;
   datos/backend = Fase B, migración `0019` **aplicada en producción** y
   `syncService` cableado; smoke test OK). La UI muestra vacío hasta que exista
   el **validador real** (Fase 4): hoy hay 0 retos verificados en prod.

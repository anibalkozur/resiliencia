# Acta 014 — Ampliación del catálogo a 4-4-4 (superior / media / inferior)

- **Fecha**: 2026-10-15 · **Tipo**: decisión de producto (catálogo) · **Fase**: 1 (producto, cámara).
- **Estado**: **decisión tomada**; implementación **pendiente**.
- **Participan**: [PO] (decide), [MED], [CV]/[DER], [UX], [DATA].

## 1. Motivo

El catálogo actual tiene **8 ejercicios** repartidos de forma despareja por zona
([UX]/[DATA]): 1 superior, 3 media, 4 inferior. El PO quiere un **4-4-4** para que el
plan y los rankings queden equilibrados.

## 2. Catálogo actual (antes)

- **Superior (1)**: Flexiones.
- **Media** (3): Abdominales, Plancha, Escaladores (mountain climbers).
- **Inferior** (4): Sentadillas, Zancadas, Puente de glúteos, Sentadilla isométrica.

## 2. Decisión [PO]

> **"Sumamos 3 para superior y 1 para media, y quedamos 4-4-4. Todos los nuevos son
> premium (el free sigue con sentadillas/flexiones/abdominales). Elegidos: Fondos en
> silla, Flexión declinada y Superman (superior) y Elevación de piernas (media)."**

## 2. Catálogo final (4-4-4)

**Zona superior (4)**: Flexiones · **Fondos en silla** · **Flexión declinada** ·
**Superman**.

**Zona media** (4): Abdominales · Plancha · Escaladores · **Elevación de piernas**.

**Zona inferior** (4) — sin cambios: Sentadillas · Zancadas · Puente de glúteos ·
Sentadilla isométrica.

## 3. Ejercicios nuevos

| id                  | Zona     | Unidad | Tier    | Meta | Vida   | Detección                                       |
| ------------------- | -------- | ------ | ------- | ---- | ------ | ----------------------------------------------- |
| `fondos_silla`      | Superior | reps   | premium | 12   | `hand` | ángulo `shoulder-elbow-wrist` (lateral)         |
| `flexion_declinada` | Superior | reps   | premium | 10   | `hold` | ángulo `shoulder-elbow-wrist` (lateral)         |
| `superman`          | Superior | reps   | premium | 15   | `hand` | ángulo `shoulder-hip-knee`, no-bridge (lateral) |
| `elevacion_piernas` | Media    | reps   | premium | 15   | `hand` | mismo patrón que `encogimiento_inverso`         |

## 4. Advertencias asentadas

- **[CV] `flexion_declinada`**: su ángulo es **idéntico al de `flexiones`** → la
  cámara la cuenta **como una flexión normal** y **NO puede verificar que los pies
  estén elevados**. Se acepta como "variante de flexión" a efectos de conteo.
- **[CV] `superman`**: ROM corto → **requiere calibrar umbrales** (riesgo de falsos
  negativos por ruido).
- **[MED] `fondos_silla`**: usa una **silla** (elemento mínimo).
- **[UX]/[PO] Tier**: los cuatro nuevos son **premium**; el free conserva
  sentadillas / flexiones / abdominales (1 por zona).

## 5. Estado en el banco de pruebas (verificado)

Los **cuatro** ejercicios **ya están en el banco** (`camera-verification-bench.html`,
`src/lib/exercises.ts`, `src/lib/tecnica.ts` y tests), así que sirven para prototipar
antes de portarlos a producción:

- `elevacion_piernas` — sí (banco HTML, catálogo y test de `buildVerifyUri`).
- `flexion_declinada` — sí.
- `fondos_silla` — sí.
- `superman` — sí.

Origen: `apps/banco de pruebas de ejercicios/EJERCICIOS_CANDIDATOS.md` (tanda de
alta en el banco).

## 6. Costo de portar cada uno a producción (pendiente)

- `catalog.ts` (id, unidad, tier) + i18n `exercise.<id>.name/desc` **es/en/pt**.
- Geometría/CFG en `camera-verification.html` (**sube `VERIFY_VERSION`**).
- Tests (catálogo, semana, i18n) y, si aplica, `tecnica.ts`.

## 7. Acciones

1. **[PO]**: decisión tomada. — **Hecho**.
2. **[CV]/[DER]**: validar/afinar la detección de los cuatro en el banco (superman y
   declinada con más atención) y portarlos a producción.
3. **[MOB]**: actualizar `catalog.ts`, i18n y tests; actualizar `estado.md`/`BITACORA.md`.

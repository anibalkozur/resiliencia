# Acta 003 — Consulta: propuestas del archivo "preguntar a mis agentes.txt"

- **Fecha**: 2026-09-07 · **Tipo**: consulta al equipo · **Estado**: **cerrada (OK del PO)**
- **Cerrada el**: 2026-09-07
- **Fase**: 0 (Fundaciones) en curso · **Sprint**: 0
- **Convocados**: [DER] (conduce la consulta), [CV], [MOB], [SRE], [PM], [SEC],
  [QA]. Vos (PO) decidís tras el reporte.
- **Fuente**: `C:\Users\Anibal\OneDrive\Escritorio\App Retos GYM 1\preguntar a mis agentes.txt`

## Orden del día

1. Lectura del archivo del PO con 4 propuestas de mejora.
2. Opinión de cada rol hardcore (cada agente leyó el archivo y su perfil).
3. Decisión del PO sobre qué hacer con cada propuesta.
4. Registro para las fases correspondientes.

## Las 4 propuestas (resumen del archivo)

1. **Migración del motor de cámara** a nativo: `react-native-vision-camera` +
   ML Kit Pose (Android) / Vision (iOS) a 30 FPS sin sobrecalentar.
2. **Centralización de la documentación** en el repo git (`/docs`) en vez de
   OneDrive (evitar desincronización spec↔código).
3. **Fallback graceful de la IA local** (IA_ENTRENADOR): gama alta → LLM local
   (Qwen3.5-2B); gama baja (<4 GB RAM) → plantillas del SafetyEngine o Edge
   Functions.
4. **Automatización CI/CD**: `pnpm typecheck` + `pnpm test` por PR/push a main
   - integración con EAS Build (APK/IPA automáticas).

## Opiniones de los roles (veredictos)

### 1. Cámara nativa

- **[CV]**: de acuerdo (planteo técnico correcto = Fase 3). Sin backend
  (`validate_workout`) ni dev builds, no se valida evidencia → riesgo de hash
  inútil. Requiere calibración por persona + test grid antes de fijar umbrales.
- **[MOB]**: no hoy. El módulo nativo **no corre en Expo Go** (rompe la cadencia
  "verla en el celu"); migrar al entrar en Fase 3 con pipeline de dev builds.
- **[PM]**: ya está en el plan como tarea de Fase 3 → **no reabrir frentes**.
- **[SRE]**: de acuerdo; corre 100% on-device (cero costo de infra).
- **[SEC]**: de acuerdo; fortalecer con **pinning del modelo `.task`** (hash) —
  faltaba especificarlo.
- **[QA]**: test grid (5 perfiles × 5 ejercicios × 3 gamas = 150 combos) inviable
  sin device farm; muestras clave (≈20) durante desarrollo, grid completo a fin
  de Fase 3.
- **Conclusión**: se implementa **en la Fase 3** con [CV]+[MOB]+[QA], +
  pinning de modelo [SEC] y contrato `validate_workout` [BE].

### 2. Documentación en el repo

- **[PM]**: de acuerdo (post-gate Fase 0) — actas/estado versionados en git.
- **[MOB]**: de acuerdo; cero riesgo. Evita leer specs desactualizadas.
- **[SRE]**: parcial — fuente única en `/docs`; OneDrive pasa a snapshot de
  lectura (nunca edición paralela).
- **[SEC]**: de acuerdo; audit trail de git como mejora de integridad.
- **[QA]**: de acuerdo; trazabilidad de bugs (tickets que citan ruta del repo).
- **Conclusión**: se hace **después de cerrar el gate de Fase 0** (no mover el
  piso el estado actual). Fuente única git + OneDrive como lectura.

### 3. Fallback graceful de la IA local

- **[PM]+[CV]**: ya cubierto en el plan (§16 tareas 3–4: selección por gama,
  fallback a plantillas "sin IA rota") → formalizar como criterio de aceptación
  del DoD Fase 9.
- **[SRE]**: el fallback a Edge Functions **consume cuota** (500K invoc/mes):
  rate-limit + alertas al 60/80%; por defecto plantillas locales (D7).
- **[SEC]**: prioridad alta — **vector nuevo**: prompt injection + datos de
  salud en Edge Functions. Definir sanitización, rate-limit y "el Edge nunca
  guarda historial" ANTES de Fase 9. Corpus on-device (16.1) es la defensa.
- **[QA]**: "cero alucinaciones" es aspiracional; requiere banco curado de
  200+ preguntas con respuestas esperadas del corpus.
- **Conclusión**: se define **en la Fase 9** ([BE]+[MOB]+[SRE]+[SEC]+[QA]),
  con las reglas de seguridad como requisito previo.

### 4. Automatización CI/CD + EAS

- **[SRE]+[MOB]+[PM]**: la parte de typecheck/test/lint **ya está hecha y
  verde** (`.github/workflows/ci.yml`). **EAS Build automático en CI se
  desestima**: consume los builds free (≈30/mes) y entra en cola compartida →
  builds solo bajo demanda o en Fase 10 (release, `.aab` firmado).
- **[SEC]**: reforzar CI con `pnpm audit` (supply chain) y secretos en
  EAS/GitHub (jamás en repo).
- **[QA]**: el gate actual (106 tests) ya es funcional; mejoras graduales, no
  bloquear por esto.
- **Conclusión**: CI actual se mantiene; se agrega `pnpm audit`. **EAS
  automático en Fase 10** con autorización del PO (D7e: implica cuenta +
  créditos).

## Decisión del PO

- **Registrado y archivado**: las 4 propuestas se ven **en las fases
  correspondientes** (1→Fase 3, 2→post-gate Fase 0, 3→Fase 9, 4→Fase 10
  parcial). No se abre ningún frente ahora.
- Se respeta la secuencia del plan (regla de oro: no avanzar fase sin DoD).

## Pendientes / avisos

- Backlog informativo actualizado con estas 4 propuestas y su fase de entrada.
- El gate de Fase 0 sigue abierto: INPI [LEG], cron `healthz` [SRE], EAS build
  real (autorización PO), PR por tarea.

## Cierre

- **OK del PO**: consulta respondida por los 7 roles y archivada. Acta firmada.
- Hoy además quedó commiteado el **port de dominio a `packages/domain`**
  (commit `fb2175d`, 69 tests; 106 tests totales verdes) — Fase 1.8.

# Acta 022 — Inicio: dato de la semana (Fase 1) y competencias geolocalizadas (Fase 2, futuro)

- **Fecha**: 2026-10-19 · **Tipo**: producto (contenido propio) + análisis de módulo futuro · **Fase**: 1 / futuro.
- **Estado**: **Fase 1 implementada** (código en disco, pendiente de prueba y cierre del PO). **Fase 2 sólo documentada** (no se construye).
- **Participan**: [PO] (pide y decide), [UX]/[MOB] (Fase 1), [BE]/[DATA]/[SEC]/[LEG]/[FIN] (análisis Fase 2), [PM] (encuadre).
- **Relacionada**: acta 021 (rediseño de Inicio). ADR free-sin-ranking.

## 1. Motivo

El PO preguntó si Inicio puede mostrar un "flyer de noticias semanales de deporte" tomado de fuentes gratuitas.
Del análisis se acordó: **no** traer noticias de terceros (copyright, red, backend) y en su lugar publicar
**contenido propio** (Fase 1). Además, el PO pidió dejar **analizado a futuro** un módulo de **publicidad de
competencias locales geolocalizadas** (running, MTB, calistenia, gym, natación, aguas abiertas, duatlón,
triatlón, tetratlón) publicadas automáticamente.

## 2. Fase 1 — Dato de la semana (implementado)

### 2.1 Qué es

Una tarjeta **"DATO DE LA SEMANA"** en Inicio con contenido propio: tips de técnica y hábito. **Sin red, sin
backend, sin copyright**: el dato rota de forma **determinística por semana ISO**, así que el usuario ve el
mismo toda la semana y cambia la próxima.

### 2.2 Cambios

- `apps/mobile/src/retos/weeklyFact.ts` (**nuevo**): `WEEKLY_FACT_IDS` (7 datos curados), `isoWeek(date)` y
  `weeklyFact(date)`. El índice es `(isoWeek - 1) % ids.length`.
- `apps/mobile/app/(tabs)/index.tsx`: import + memo `fact` por `dayKey` + tarjeta entre la tira de datos y el
  botón de ranking.
- i18n: claves `weekly.title` y `weekly.<id>.title|body` en **es/en/pt** (7 datos × 3 idiomas).
- Test nuevo `src/retos/__tests__/weeklyFact.test.ts`: rotación por semana, estabilidad dentro de la semana,
  cambio entre semanas, límites ISO (semana 1 y rollover a 53) y armado de claves i18n.

### 2.3 Verificación

- `pnpm --filter mobile typecheck` ✓ · `lint` ✓ · `test` **221/221 (19 suites)** ✓.
- Sin cambios de cámara (v53), sin migración, sin edge, sin dependencias nuevas.

### 2.4 Límites

- Los 7 tips son **editoriales** (no son datos del usuario). Si el PO quiere **tips según el ejercicio del
  día**, se puede derivar de `TECNICA[].resumen`, pero hoy `TECNICA` está **sólo en español**.
- La rotación es **global** (no personalizada). Un "dato según historial" (récord, progreso) es una variante
  futura.

## 3. Fase 2 — Competencias geolocalizadas (analizado, NO construido)

### 3.1 Visión

Un espacio en Inicio (o pestaña propia) donde aparezcan **competencias/eventos** cercanos al usuario,
publicados por organizadores (gimnasios, clubes). Cubre running, MTB, calistenia, gym, natación, aguas
abiertas, duatlón, triatlón y tetratlón. Puede ser **gratuito** o **pago** (B2B para organizadores).

### 3.2 Decisión de privacidad (tomada)

**Ciudad/región del perfil, sin GPS.** Sin permisos nuevos de ubicación, sin consentimiento de geolocalización
y con menor superficie para `[LEG]`. Se filtra por ciudad declarada, no por coordenadas.

### 3.3 Arquitectura mínima a construir (cuando se decida)

| Pieza               | Detalle                                                                                                                |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Tabla `events`      | título, deporte, fecha, ciudad/región (texto), link de inscripción oficial, organizador, `status` (`draft`/`approved`) |
| Tabla organizadores | vínculo a quién publica y, si es pago, vigencia/plan                                                                   |
| Endpoint            | `get_events(p_city, ...)` que devuelve eventos aprobados de la ciudad del perfil                                       |
| App                 | tarjeta/flyer con **título + deporte + fecha + organizador** y tap → link externo (inscripción)                        |

### 3.4 Riesgos y límites que hay que resolver antes de construir

- **LEG**: contenido de terceros → siempre **atribuir** al organizador y **linkear** a la inscripción oficial,
  nunca rehostear. Cambia el modelo si hay pago (facturación, términos).
- **SEC/LEG**: aunque no se use GPS, la **ciudad** es dato del perfil; hay que respetar el opt-out y no
  exponerla en el ranking ni en endpoints públicos.
- **Moderación**: un evento **falso** (estafa de inscripción) es riesgo reputacional y legal. Requiere
  `status=approved` (manual o verificación de organizador) antes de publicar.
- **MED**: eventos exigentes (aguas abiertas, triatlón) → no prometer aptitud física ni sugerir que el usuario
  está listo. Textos revisados por `[MED]`.
- **DATA**: métrica honesta de impresiones/clicks; sin inflar conteos.

### 3.5 Costos

- Fase 2 no es gratis en esfuerzo: desarrollo del módulo + **adquisición de organizadores** (venta B2B) +
  **moderación** (trabajo humano recurrente). El free tier de Supabase lo cubre a bajo volumen.

### 3.6 Encuadre

```
Cámara: [CV] + [MOB] + [QA] + [SEC].
Contenido propio (Fase 1): [UX] + [MOB] + [QA].
Competencias (Fase 2): [PM] + [LEG] + [SEC] + [DATA] (+ [FIN] si es pago).
```

## 4. Estado y siguiente paso

- **[PO]**: probar la tarjeta de dato de la semana en dispositivo. — **Pendiente**.
- **Fase 2**: mantener **sólo documentada**; no crear trabajo operativo hasta tener usuarios o un organizador
  real interesado (modo lean). El acta es el punto de partida cuando se retome.

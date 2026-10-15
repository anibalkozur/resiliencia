# Acta 013 — Reorganización de pestañas, fusión de Perfil en Ajustes y selector de días de entrenamiento

- **Fecha**: 2026-10-14 · **Tipo**: decisión de producto + implementación · **Fase**: 1 (producto, UI).
- **Estado**: **implementado y verificado**; probado por el PO en Expo Go: **OK**.
- **Participan**: [PO] (decisiones), [UX], [MOB].

## 1. Decisión [PO]

> **"Poné una pestaña Ranking; que el historial viva en Progreso; juntá Perfil dentro
> de Ajustes (plegable); y en lugar de 'días por semana' dejame elegir los días de la
> semana que quiero entrenar, con la leyenda 'Selecciona los días en que quieres
> entrenar'."**

Reglas derivadas:

1. **Ranking** deja de mezclarse con el progreso personal: pasa a ser una **pestaña
   propia**.
2. **Progreso** = **historial de ejercicios** (retos + sesiones libres), sin ranking.
3. **Perfil** deja de ser pestaña: su contenido se muestra **plegable dentro de
   Ajustes** (colapsado por defecto).
4. La preferencia de plan deja de ser una **cantidad** (2–6 días) y pasa a ser la
   **selección de días concretos** de la semana (mínimo 1).
5. En día de descanso **no hay reto**: Inicio avisa con un mensaje **adaptativo**
   (nada de "mañana vuelven los retos" si mañana también es descanso).

## 2. Implementación

### 2.1 Pestañas

- **`app/(tabs)/ranking.tsx` (nuevo)**: UI de ranking extraída de Progreso
  (Racha | Reps | Total, chips de ejercicio, nota y estados vacíos honestos). Usa
  `fetchRanking` / `fetchRepsRanking` / `fetchTotalRepsRanking`.
- **`app/(tabs)/progreso.tsx`**: se quita el ranking; se agrega la tarjeta
  **HISTORIAL DE EJERCICIOS** (retos completados + sesiones libres, orden por fecha
  descendente, etiqueta Reto/Libre, `valor/meta unidad`).
- **`components/PerfilPanel.tsx` (nuevo)**: el contenido de Perfil como componente
  (sin `ScrollView` ni tarjeta de logout en su raíz). **`app/(tabs)/perfil.tsx`
  eliminado**.
- **`app/(tabs)/ajustes.tsx`**: `ScrollView`; arriba una fila **plegable "Perfil ▸"**
  (colapsada por defecto, `accessibilityRole="button"` + `accessibilityState.expanded`)
  que despliega `<PerfilPanel/>`; debajo Días / Idioma / Cuenta / Reiniciar.
- **`app/(tabs)/_layout.tsx`**: orden **Inicio · Retos · Libre · Progreso · Ranking ·
  Ajustes**; alta de `ranking` con `PodiumIcon` (nuevo, SVG de tokens); baja de
  `perfil` e ícono `UserIcon`.
- **`app/(tabs)/index.tsx`**: CTA principal **EMPEZAR RETO** + secundario **VER
  RANKING** (navega a la pestaña Ranking).

### 2.2 Historial

- **`src/retos/history.ts` (nuevo)** + tests: `buildHistory(free, daily)` (une
  sesiones libres y retos, ordena por fecha desc) y `unitForExercise(id)`.

### 2.3 Día de descanso (cero simulación)

- **`src/retos/week.ts`**: nuevo **`buildNextTraining(goal, trainingDays, today)`**
  (primer día con reto posterior a hoy, mira hasta 14 días).
- **`index.tsx`**: si hoy no es día de entrenamiento, el CTA **no navega**; muestra un
  `Alert` con mensaje **adaptativo** (`home.rest_tomorrow` si el próximo reto es
  mañana; si no, `home.rest_next` con el día concreto). Retos ya mostraba `retos.rest`.

### 2.4 Días de entrenamiento (reemplaza "Días por semana")

- **`src/prefs/types.ts`**: `UserPrefs.daysPerWeek: number` → **`trainingDays:
number[]`** (0=domingo … 6=sábado).
- **`src/prefs/service.ts`**: default `[1, 3, 5, 6]` (lun/mié/vie/sáb);
  `normalizeTrainingDays` valida (enteros 0–6, únicos, ordenados, mínimo 1) y
  **migra** la preferencia vieja `daysPerWeek` vía `LEGACY_TRAINING_SLOTS`; se retiran
  `MIN_DAYS`/`MAX_DAYS`. La pref sigue siendo **solo local** (no se sincroniza).
- **`src/retos/week.ts`**: `buildWeek(goal, trainingDays, today)` marca entreno según
  los días elegidos (se retira `TRAINING_SLOTS`).
- **`ajustes.tsx`**: fila de **7 chips Lun→Dom** en una sola línea (adaptativos,
  `flex: 1`) con la leyenda **"Selecciona los días en que quieres entrenar."**; el
  último día activo no se puede deseleccionar (mínimo 1).
- **`retos.tsx`**: "Plan N días" usa `trainingDays.length`.
- **`translations.ts`**: `settings.days` → "DÍAS DE ENTRENAMIENTO" + nueva
  `settings.days_hint` (es/en/pt); se retira `settings.saved`.
- **Corrección de UI**: la abreviatura de miércoles pasa de `X` a **`M`** (es).

## 3. Verificación (hecha)

- Prettier ✓ · typecheck ✓ · lint ✓.
- `apps/mobile` tests **198/198** (16 suites) ✓ (nuevos: `history`, `week`,
  `normalizePrefs`).
- Prueba manual del PO con Expo Go (pestañas, historial, Perfil plegable, selector de
  días y cartel de descanso): **OK**.

## 4. Efectos y límites

- El ranking sigue mostrando **estado vacío honesto** hasta que exista el validador
  server-side (acta 011 §7): no se simula.
- Cambio de modelo **solo cliente**: los usuarios existentes migran su `daysPerWeek`
  a `trainingDays` en la primera lectura.
- `UserSport.daysPerWeek` (deportes del Perfil) es otra cosa y **no** se tocó.

## 5. Acciones

1. **[PO]**: probar en Expo Go y firmar. — **Hecho: OK.**
2. **[MOB]**: con OK del PO, commit + push a `main`, backup y actualizar
   `estado.md`/`BITACORA.md`.

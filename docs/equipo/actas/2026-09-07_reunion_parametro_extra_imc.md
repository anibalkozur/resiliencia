# Acta 006 — Parámetro extra (2º indicador): WHtR + Score de hábito + Peso meta motivacional

- **Fecha**: 2026-09-07
- **Convocante**: PO (consulta directa: "¿podríamos buscar o inventar un parámetro
  extra además del IMC, tipo el PAI del Xiaomi Mi Band, que use las medidas
  corporales, el deporte y la meta para dar otro parámetro de peso? Con 183 cm
  y ganar músculo no puedo pesar 64 kg nunca").
- **Roles consultados**: [MED] (especialista contratado ese día, ficha #17),
  contextos de [DATA]/[UX]/[MOB] ya relevados en la reunión del Perfil enriquecido.
- **Regla de oro aplicada**: el número del IMC y sus umbrales OMS **no se tocan**
  (acta 005). Lo declarado redacta; lo medido decide.

## 1. Aclaración sobre el PAI

El "PAI" de Xiaomi es una métrica **real y licenciada** (NTNU / Univ. de
Washington, validada en el estudio noruego **HUNT** ~60.000 personas) basada en
**frecuencia cardíaca**; meta ≥100/semana asociada a menos muerte cardiovascular.
**No es un score de peso** y no puede replicarse sin sensor de FC (que la app no
tiene). Sirvió de inspiración para un "indicador motivacional", jamás como
parámetro de peso clínico.

## 2. Veredicto de [MED]

1. **Parámetros reales publicados que aplican**:
   - **WHtR (cintura ÷ altura)**: el único defendible hoy; validado (meta-análisis
     Ashwell 2012), mejor predictor de riesgo que el IMC, corte global **0.5**
     sin sexo. Entrada: cintura auto-medida con instrucciones (cinta en ombligo,
     fin de exhalación, error tolerable ±2 cm).
   - **Frame size (contextura ósea, muñeca/altura)**: antropometría publicada
     (MetLife 1983, Hamwi/Devine ±10%) pero anticuada como "peso ideal"; solo
     sirve de contexto. **No fue elegido por el PO**.
   - **%grasa real** (DEXA/bioimpedancia/cámara): el estándar para separar
     músculo de grasa; llega con la cámara (Fase 3, [CV]). Ningún auto-reporte
     basta para certificar "tu sobrepeso es músculo".
2. **Inventar un score propio sin rótulo = simulación (regla 10), veto médico.**
   Con rótulo "no clínico, motivacional" es aceptable si no compite con la
   tarjeta de salud, no genera números de peso fuera de un techo duro, y se
   declara heurístico.
3. **Caso 183 cm / ganar músculo**: el IMC da falsos positivos en cuerpos
   musculados (atleta con IMC 27 y 14% de grasa: caso documentado). Se comunica
   **sin tocar el número** ("el IMC no distingue músculo de grasa; para tu caso
   hay que medir composición"). **Línea dura anti-maluso**: **IMC ≥ 30 nunca**
   recibe el mensaje "es músculo".

## 3. Decisión del PO (elegidos)

1. **WHtR real** — 2º indicador clínico (cintura opcional + altura → ratio,
   corte 0.5, sin rótulo duro; frontera ±0.02 sin veredicto).
2. **Score de hábito** (0–100) — motivacional, en la zona de deportes/hábito,
   lejos de la tarjeta de salud; prohibido llamarlo PAI.
3. **Peso meta motivacional** — si objetivo = ganar músculo + deporte declarado:
   apuntar al **límite superior del rango sano** (ej. 83.4 kg en 183 cm) con
   disclaimer "no clínico; se decide midiendo". Solo IMC < 30.
   No se eligió: frame size (contextura) → posible iteración futura.

- El objetivo (UI) se **muda de Ajustes a Perfil**; el dato sigue en `prefs`
  (no rompe el motor de retos). [MOB]: `UserProfile` es JSON embebido
  (`app_settings`), **sin migración de schema**; se agregan `sports` y `waistCm`.

## 4. Implementación (commit `2416292`)

- `src/repo/types.ts`: `UserSport { sport, years, daysPerWeek }`; `sports?`,
  `waistCm?` en `UserProfile`.
- `src/user/service.ts`: `SPORT_CATALOG` (11 deportes ES/EN/PT),
  `normalizeSports`, `normalizeWaistCm`, `computeWhtr`, `whtrZone` (frontera
  ±0.02 de 0.5), `habitScore` (0–100, dominio ≥ 7 días/semana o 10 años),
  `bmiContext` ('muscle' solo IMC 24–30 + ganar_músculo + deporte; **nunca ≥30**),
  `muscleTargetWeight` (límite superior sano, solo IMC < 30 + ganar_músculo +
  deporte). `updateProfile` acepta `ProfilePatch` (sports/waist). Sin cambios de
  `computeBmi`/umbrales OMS.
- `app/(tabs)/perfil.tsx`: objetivo (chips) + deportes (chips multi-select +
  steppers años/días por deporte) + score de hábito + IMC contextual
  ("parte puede ser músculo…") + meta operativa con disclaimer + medidas
  opcionales plegables (cintura → WHtR).
- `app/(tabs)/ajustes.tsx`: queda idioma + días/semana (objetivo fuera).
- i18n ES/EN/PT con paridad (`profile.*`, `sport.*`); se retira `settings.goal`.
- **Tests: 155 verdes** (86 mobile + 69 domain; +20 nuevos). typecheck/lint/
  prettier verdes. Commit `2416292` pusheado; CI en verificación.

## 5. Pendientes

- OK visual del PO en Expo Go (`exp://192.168.1.116:8081`).
- Gate de telemetría ([DATA], PostHog futura): `profile_goal_set`,
  `profile_sports_saved`, `bmi_card_viewed`, `bmi_info_tapped`; abandono de
  Perfil > 5pp → rollback.
- Fase 3: cámara → composición corporal real [CV]; recién ahí se podrá
  personalizar el dato sin simulación.

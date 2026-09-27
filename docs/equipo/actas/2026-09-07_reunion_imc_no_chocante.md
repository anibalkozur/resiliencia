# Acta 005 — El IMC no etiqueta: tarjeta de medidas no chocante

- **Fecha**: 2026-09-07
- **Convocante**: PO (feedback directo: "26.6 + SOBREPESO se siente chocante por
  unos kilos de más").
- **Roles**: [GRO] (conduce investigación de mercado), [UX] (diseño +
  microcopy), [DATA] (fórmula + escalas + gates), [MOB] (viabilidad técnica).
  Cada uno leyó su ficha + análisis de competencia antes de opinar.
- **Objetivo (directiva del PO)**: no declarar "sobrepeso" a las personas por
  un par de kilos; investigar cómo las apps de peso muestran el IMC (escalas,
  gráficos, valores), y rediseñar la tarjeta con un "IMC (?)" que explique qué
  es y muestre la proyección de peso ideal.

## 1. Lo que dice el mercado (evidencia relevada por [GRO]/[UX])

| Patrón                                      | Apps                             | Qué hace                                                                  |
| ------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------- |
| Número + gráfico, sin rótulo                | Apple Health, Google Fit, Fitbit | IMC como dato + tendencia temporal; no clasifica en palabras              |
| Escala/gradiente con zona de referencia     | Samsung Health, Withings         | Posición visual del IMC en una barra; la zona normal se ve, no se declara |
| Calculadora + contexto crítico + peso ideal | Yazio                            | Número + rango ideal + párrafo sobre límites del IMC                      |
| Etiqueta dura OMS                           | MyFitnessPal (legacy)            | "Overweight/Obese" → hilos interminables de queja en su comunidad         |
| Pesadilla reputacional                      | Kurbo (WW kids)                  | Crash público 2019–2020 por "body shaming" (NYT, CNBC, Time, Vice, NEDA)  |

Datos duros sobre el efecto negativo de etiquetar:

- Essayli et al. 2017 (_Journal of Health Promotion_): experimento doble ciego —
  decirle "overweight" a una mujer aumenta **insatisfacción corporal y estigma
  internalizado** (p < .01), sobre todo en personas con sobrepeso real.
- Auto-estigma → abandono: usuarios con alto auto-estigma en un programa
  digital de pérdida de peso abandonan **32.5% vs 21.6%** (PMC11523143).
- Pagoto 2021 (_Obesity Science & Practice_): el feedback de IMC "sin educación
  sobre sus límites" produce vergüenza y malentendido — respalda el cartel "?".
- Martín-Vicario 2025 (_Sociology Compass_): "shame, rather than knowledge,
  prevails" en apps de peso del Play Store.

**Conclusión de mercado (los 4 roles)**: nadie top actual usa "SOBREPESO" como
titular; las apps más sabias muestran número + barra/gráfico + proyección. El
número es honesto y no se toca; la **etiqueta es lo que estigmatiza y se
elimina**.

## 2. Consenso del equipo

1. **El IMC y el usuario son reales**; se rediseña la _comunicación_, no el
   dato (regla 10 intacta: nada simulado; "el IMC es 26.6" es tan verdadero
   como antes).
2. El número se mantiene (26.6), con precisión a 1 decimal.
3. La etiqueta dura se reemplaza por:
   - **Barra de escala continua** (15→40) con la zona de referencia 18.5–24.9
     en teal (color de marca, no rojo de alarma) y un marcador posicional.
   - **Texto de estado neutro por distancia**: "Estás dentro del rango
     saludable" / "Estás X kg por encima/por debajo del límite".
4. **Proyección de peso ideal = rango saludable** para la altura del usuario
   (nunca un "peso ideal" singular, que desmotiva y no es real):
   `min = 18.5 × altura_m²`, `max = 24.9 × altura_m²`.
5. **Título "IMC (?)"** → modal que explica: fórmula (peso ÷ altura²), y que es
   una **referencia poblacional, no un diagnóstico** (no distingue músculo de
   grasa, ni edad/género/complexión; el músculo puede subir el IMC sin exceso
   de grasa).
6. Técnica ([MOB]): `Modal` nativo (sin dependencias nuevas), barra con
   `View`/tokens (sin SVG necesario), 2 funciones nuevas en dominio con tests.
7. Gate ([DATA]) post-lanzamiento: si la tasa de abandono del Perfil sube
   > 5 pp → **rollback** a la versión anterior.

## 3. Decisión del PO

1. **Sí, implementá** el diseño completo (barra + distancia + rango saludable +
   modal "?"), con i18n ES/EN/PT y tests.
2. Proyección: **rango + distancia** ("Peso saludable para tu altura:
   X – Y kg" + "Estás Z kg por encima/por debajo").

## 4. Implementación (hecha)

- `apps/mobile/src/user/service.ts`: `BMI_LOWER`/`BMI_UPPER`, `healthyWeightRange`
  y `weightDeviation` (con signo); `computeBmi`/`bmiCategory` intactos
  (`bmiCategory` se conserva en dominio para estadística, ya no se usa en UI).
- `apps/mobile/app/(tabs)/perfil.tsx`: título "IMC" + botón "?" (a11y),
  valor grande, barra de escala 15–40 con zona saludable 18.5–24.9 y marcador,
  texto de estado por distancia, proyección de rango, y modal explicativo
  (cerrable por botón, overlay y back de Android).
- `apps/mobile/src/i18n/translations.ts`: keys `profile.bmi_*` +
  `profile.healthy_range` en ES/EN/PT con paridad.
- Tests: **+9** (rango fijo, límite máx/mín, distancia dentro/fuera, bordes)
  → **135 tests verdes** (66 mobile + 69 domain). typecheck/lint/prettier
  verdes.
- **Pendiente**: commit + push + CI; revisión visual del PO en Expo Go.

## 5. Acuerdos para adelante

- Todo feedback de salud en la app se comunica como **referencia con contexto**,
  nunca como etiqueta estigmatizante — revisión de contenido [UX]+[GRO] cuando
  llegue nueva métrica de salud.
- Se conserva la fórmula y umbrales OMS en dominio (correctos y testeados); la
  UI decide cómo presentarlos.

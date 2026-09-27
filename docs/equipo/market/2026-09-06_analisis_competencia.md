# Análisis de competencia — Apps de fitness/entrenamiento (Play Store 2026)

- **Fecha**: 2026-09-06
- **Roles**: [GRO] analista de mercado (conduce), [MOB] analista de sistemas
  (revisa viabilidad), [UX] lente de experiencia (sesión de descubrimiento,
  sin reunión plena).
- **Objetivo (directiva del PO)**: cómo son las apps de este estilo — formato
  y preferencias de las más usadas — para guiar el frontend de ResiliencIA.

## 1. Mapa del mercado (las más usadas y qué son)

| App                      | Tipo                                            | Volumen/Datos                                   | Modelo                   |
| ------------------------ | ----------------------------------------------- | ----------------------------------------------- | ------------------------ |
| Nike Training Club (NTC) | Entrenamientos guiados por video                | 4.8★, 20M+ descargas, biblioteca gratuita total | Freemium suave           |
| Freeletics               | Planes de entrenamiento + IA (coach adaptativo) | Top en "ejercicio"                              | Suscripción              |
| FitOn                    | Clases en vivo y grabadas                       | Muy usada, gratuita                             | Gratis + upsell          |
| Caliber                  | Rutinas con video paso a paso                   | Notable en calidad gratuita                     | Gratis, sin ads          |
| Apple Fitness+           | Clases guiadas + métricas del reloj             | Integración vibras casi-equipo                  | Suscripción (ecosistema) |
| Strava                   | Registro de actividades, comunidad              | 150M usuarios                                   | Freemium                 |
| MyFitnessPal             | Dieta/registro                                  | Una de las más descargadas                      | Freemium                 |
| Fitbit                   | Salud wearable                                  | —                                               | Hardware + sub           |
| Hevy / Strong            | Rastreador de pesas                             | Las favoritas del nicho gimnasio                | Freemium                 |

**Hallazgo clave**: por defecto, las apps estándar (Hevy, Strong, MyFitnessPal)
hacen que el usuario **registre a mano** sus series/reps/comidas. Eso es
justamente el dolor que ResiliencIA elimina con la cámara (D6).

## 2. El formato común que encontraron los usuarios (patrones)

Estudios de UX/UI sobre = "cómo se espera que luzca" una app de ejercicio:

- **Barra inferior con pestañas** (Inicio/Entrenar/Progreso/Perfil) y poca
  profundidad de navegación: de la tab se entra y se hace.
- **Métricas de vistazo** en el inicio: grandes, de un vistazo (sin leer).
- **Anillos de actividad** estilo Apple Fitness+ para metas diarias.
- **Racha (streak) + calendario de calorías** (heatmap) para motivación.
- **Gráficas de línea** para tendencias de progreso.
- **Tema oscuro con acentos neón**, botones grandes.
- **Pantallas diseñadas para gente en movimiento/sudando** (se mira rápido,
  no se lee): minimalismo en el momento de entrenar.
- **Onboarding rápido**: apenas preguntar lo esencial; se gana al usuario en
  los primeros segundos.

## 3. Preferencias y dolores de los usuarios

**Lo que valoran**:

- Planes que se adaptan a su progreso real (no genéricos).
- Funcionar sin conexión.
- Seguimiento del progreso a lo largo del tiempo.
- Cero fricción de registro mientras entrenan.
- Motivación honesta (los anillos que "no cierran" aunque uno se esfuerce
  generan desconfianza y se abandonan).

**Dolores frecuentes**:

- "Gratis" engañoso: prueba de 3 workouts y después paywall agresivo.
- Publicidad invasiva (ej. JEFIT).
- Plantillas genéricas que no se adaptan.
- Abandono estacional: las apps de ejercicio se desinstalan en febrero
  (post-propósitos). **La retención es el problema**; la motivación manda.

## 4. Traducción a ResiliencIA (qué adoptamos, qué nos diferencia, qué evitar)

**Adoptamos del formato (frontend real)**:

- Barra inferior con pestañas ya presente; sumar **Progreso** cuando haya
  datos históricos.
- **Inicio con métricas de vistazo**: racha/streak del usuario (real, de
  días completados con cámara en Fase 3) + tarjeta del reto del día.
- **Tema oscuro con acentos neón**: ya es el brand guide teal/ember.
- **Onboarding rápido**: ya es 1 sola pregunta (apodo) — correcto.
- **Anillos/streak honestos**: solo cuando la cámara los pueda acreditar;
  nunca un ring "de mentira".

**Nuestra diferencia (borde competitivo)**:

- La verificación por cámara elimina el registro manual (el tick vuela solo
  al terminar el ejercicio) — casa exactamente con "cero fricción mientras
  entrenas", el dolor #1 del nicho.
- Esto nos separa de NTC, Freeletics y de Hevy/Strong (que exigen apuntar
  series a mano).

**Evitamos**:

- Paywall agresivo temprano (la app es libre, sin prueba falsa).
- Publicidad en las pantallas (sin ads; formato propuesto desde el plan).
- Registrar a mano cualquier ejercicio (prohibido por D6).
- Pantallas densas de texto en el momento de entrenar.

## 5. Conclusiones y acciones al frontend

1. El formato esperado es: tab bar + métricas de vistazo + streak/calendario +
   tema oscuro neón + minutos para hacer. Nuestra estructura ya va alineada;
   falta el **Progreso** con racha y calendario (datos reales, Fase 3 cámara).
2. El onboarding de 1 pregunta es buen diseño (rápido, sin fricción).
3. La cámara como verificadora no es un lujo: es el diferenciador que el
   mercado valora (cero log manual) y una defensa del abandono post-febrero
   (retención por motivación honesta).
4. Próxima entrega visible al PO (cuando haya datos): **racha/streak** y
   **tarjeta de progreso** en Inicio. El motor de retos ya existe local.

_IP: estrategia de competencia para [GRO]; sin costos (D7e)._

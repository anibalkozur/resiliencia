# Catálogo de ejercicios candidatos

Lista de repaso para el banco de pruebas (`camera-verification-bench.html`).
No es la app real: producción (`camera-verification.html`) queda intacta.

Leyenda de estado:

- **prod** → ya existe en la app y en la página (no requiere trabajo).
- **banco** → agregado solo al banco, pendiente de validar en equipo.
- **candidato** → idea todavía sin implementar; requiere definir geometría
  (ángulos) y probar si el motor actual alcanza o hace falta un detector nuevo.

---

## Agregados al banco en esta tanda

| id                         | Nombre                      | Patrón de detección                          | Vista   | Notas                                                            |
| -------------------------- | --------------------------- | -------------------------------------------- | ------- | ---------------------------------------------------------------- |
| `zancada_reversa`          | Zancada reversa             | ángulo `hip-knee-ankle`, no-bridge           | lateral | copia de `zancadas`                                              |
| `zancada_lateral`          | Zancada lateral (cossack)   | ángulo `hip-knee-ankle`, no-bridge           | lateral | experimental: la pierna estirada queda en pantalla; puede fallar |
| `sentadilla_bulgara`       | Sentadilla búlgara          | ángulo `hip-knee-ankle`, no-bridge           | lateral | pie trasero en silla                                             |
| `patada_gluteo`            | Patada de glúteo            | ángulo `shoulder-hip-knee`, **bridge**       | lateral | cuadrupedia; el ángulo crece al patear                           |
| `elevacion_lateral_pierna` | Elevación lateral de pierna | ángulo `shoulder-hip-knee`, no-bridge        | lateral | recostado de costado                                             |
| `flexion_rodillas`         | Flexión de rodillas         | ángulo `shoulder-elbow-wrist`                | lateral | sin `line`/`grounded` (rodillas apoyadas)                        |
| `flexion_declinada`        | Flexión declinada           | ángulo `shoulder-elbow-wrist`                | lateral | pies elevados; sin `line`/`grounded`                             |
| `flexion_pica`             | Flexión pica                | ángulo `shoulder-elbow-wrist`                | lateral | V invertida (hombros)                                            |
| `fondos_silla`             | Fondos en silla             | ángulo `shoulder-elbow-wrist`                | lateral | manos atrás en el borde                                          |
| `superman`                 | Superman                    | ángulo `shoulder-hip-knee`, no-bridge        | lateral | ROM chico, muy sensible a ruido                                  |
| `encogimiento_inverso`     | Encogimiento inverso        | ángulo `shoulder-hip-knee`, no-bridge        | lateral | como `abdominales`                                               |
| `encogimiento_bicicleta`   | Encogimiento bicicleta      | ángulo `shoulder-hip-knee`, no-bridge        | lateral | alternado; puede doble-contar en el cambio de lado               |
| `burpee`                   | Burpee                      | métrica `ratio` (`groundedRatio`), no-bridge | lateral | ratio alto parado, bajo en plancha                               |
| `rodillas_altas`           | Rodillas altas              | pliegue `kneeFold` (`hip-knee-ankle`)        | lateral | reusa la rama de `mountain_climbers`                             |

Cambios de motor en esta tanda:

- La rama especial de conteo por pliegue de rodilla ya no se activa por
  `cfg.name === 'Mountain Climbers'` sino por **`cfg.kneeFold`** (generaliza a
  `rodillas_altas`).
- Nuevo campo opcional **`cfg.metric: 'ratio'`**: en vez de un ángulo, la rama
  lateral usa `groundedRatio(hip, ankle, shoulder)` como variable de conteo
  (usado por `burpee`).

---

## Ejercicios ya en producción (`prod`)

| id                      | Nombre                | Unidad              | Vista   |
| ----------------------- | --------------------- | ------------------- | ------- |
| `sentadillas`           | Sentadillas           | reps                | frontal |
| `flexiones`             | Flexiones             | reps                | lateral |
| `abdominales`           | Abdominales           | reps                | lateral |
| `plancha`               | Plancha               | seconds             | lateral |
| `zancadas`              | Zancadas              | reps                | lateral |
| `puente_gluteo`         | Puente de glúteo      | reps                | lateral |
| `mountain_climbers`     | Mountain Climbers     | reps (app: seconds) | lateral |
| `sentadilla_isometrica` | Sentadilla isométrica | seconds             | frontal |

También solo en el banco: `elevacion_piernas` (elevación de piernas rectas,
acostado) → mismo patrón que `encogimiento_inverso`.

---

## Candidatos sin implementar

### Empuje (pecho / tríceps / hombros)

- **Flexión diamante** (_diamond push-up_): manos juntas formando un rombo; más tríceps.
- **Flexión abierta** (_wide push-up_): manos más anchas que los hombros; más pecho.
- **Flexión arquera** (_archer push-up_): una mano lateral y la otra al centro, peso a un lado.
- **Flexión hindú / dive bomber**: combina pica y flexión en un solo movimiento.
- **Flexión con palmada** (_clap push-up_): pliométrica, despega las manos.
- **Flexión en pared** (_wall push-up_): de pie contra la pared, para principiantes.
- **Fondos en banco** (_bench dips_): como `fondos_silla` pero con un banco más alto.
- **Fondos en paralelas** (_dips_): brazos a los costados, cuerpo vertical.
- **Pike hold / handstand prep**: sostener la V invertida.

### Piernas / glúteos

- **Sentadilla sumo**: pies bien abiertos, puntas hacia afuera.
- **Sentadilla con salto** (_jump squat_): pliométrica; difícil de contar por frames.
- **Zancada frontal** (_forward lunge_): paso hacia adelante.
- **Zancada caminando** (_walking lunge_): traslada el cuerpo.
- **Zancada con salto** (_jump lunge_): alterna en el aire.
- **Peso muerto a una pierna** (_single-leg deadlift_): bisagra de cadera a una pierna.
- **Elevación de talones** (_calf raise_): solo tobillo; ROM chico, mal para el motor por ángulo.
- **Puente a una pierna** (_single-leg glute bridge_): puente con una pierna.
- **Hip thrust**: puente con espalda alta apoyada.
- **Buenos días** (_good morning_): bisagra de cadera de pie.
- **Pistol squat**: sentadilla a una pierna; requiere movilidad y detector fino.

### Core

- **Plancha lateral** (_side plank_): seconds; ángulo `shoulder-hip-ankle` del costado apoyado.
- **Plancha con toque de hombro** (_shoulder taps_): alternado, en plancha alta.
- **Hollow hold / hollow rock**: seconds; contar es más difícil.
- **Dead bug**: alternado, brazos y piernas opuestos.
- **Bird dog**: cuadrupedia, extiende brazo y pierna opuestos.
- **V-ups**: combina encogimiento y elevación de piernas.
- **Russian twist**: rotación de torso sentado.
- **Toque de talón** (_heel touch_): oblicuos acostado.
- **Elevación de rodillas colgado** (_hanging knee raise_): necesita barra.
- **Escaladores cruzados** (_cross-body mountain climbers_): rodilla al codo opuesto.

### Espalda

- **Remo invertido** (_inverted row_): bajo una barra o mesa.
- **Remo con toalla** (_towel row_): isométrico.

### Cardio / full body

- **Jumping jacks**: abrir y cerrar piernas con palmada arriba.
- **Skater jumps**: saltos laterales de patinador.
- **Tuck jumps**: saltar llevando las rodillas al pecho.
- **Sprints en el lugar**: alta frecuencia; muy ruidoso para el motor.

### Movilidad (probablemente unit `seconds`)

- **Estocada con giro** (_lunge with twist_).
- **World's greatest stretch**.
- **Gato-camello** (_cat-cow_).
- **Sentadilla profunda sostenida** (_deep squat hold_).

---

## Riesgos / por definir

- **Burpee, high knees, bicycle crunch, superman y zancada lateral** son los
  más difíciles: pueden necesitar un detector dedicado (traslación, ritmo,
  alternancia) o ajuste fino de umbrales tras probar en Android.
- Ejercicios con **ROM chico** (superman, calf raise) chocan con el rango de
  calibración de 9° y el ruido del pose.
- `mountain_climbers` sigue con la discrepancia reps (página) vs seconds
  (catalog.ts); definirlo antes de portar.

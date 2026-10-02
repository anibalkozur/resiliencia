# Banco de pruebas de ejercicios (QA)

App **aparte** para probar los 8 ejercicios y la prueba de vida en el celular. No
comparte código con `apps/mobile`, no escribe en Supabase y no toca la app real:
sirve para encontrar los valores correctos de umbrales y recién después portarlos
a `camera-verification.html`.

## Cómo correrla (Expo Go)

```bash
pnpm install
pnpm --filter @resiliencia/exercise-tester start
```

Escaneá el QR con Expo Go. La app no requiere build nativa: la cámara la abre
`expo-camera` y la inclinación `expo-sensors`, que ya están en Expo Go.

En Windows también anda con el acceso directo del escritorio, que levanta el
servidor y deja el QR listo: `launch-tester.cmd`.

## Qué replica

Los umbrales por ejercicio son **los mismos** que usa la app real
(`camera-verification.html:609-764`) y los objetivos por defecto son los de
`apps/mobile/src/retos/catalog.ts:24-33`, para que un ajuste hecho acá se porte 1:1.

| Ejercicio             | Tier    | Unidad   | Objetivo | Vista   | Ángulo medido                                       | Umbral abajo   | Umbral arriba | Extra                                              |
| --------------------- | ------- | -------- | -------- | ------- | --------------------------------------------------- | -------------- | ------------- | -------------------------------------------------- |
| Sentadillas           | free    | reps     | 20       | frontal | rodilla (cadera→rodilla→tobillo), **ambas piernas** | 100°           | 160°          | bloquea si las piernas difieren > 35°              |
| Flexiones             | free    | reps     | 10       | lateral | codo (hombro→codo→muñeca)                           | cal − 40°      | cal − 12°     | `lineMin` 150°, tumbado ≤ 0.9                      |
| Abdominales           | free    | reps     | 15       | lateral | cadera (hombro→cadera→rodilla)                      | cal − 25°      | cal − 10°     | anti-pararse 0.45, reposo torso ≤ 35°              |
| Plancha               | premium | segundos | 30       | lateral | codo (hombro→codo→muñeca)                           | —              | cal           | `lineMin` 150°, tumbado ≤ 0.9                      |
| Zancadas              | premium | reps     | 24       | frontal | rodilla, **ambas piernas**                          | 115°           | 160°          | bloquea si las piernas difieren > 35°              |
| Puente de glúteo      | premium | reps     | 15       | lateral | cadera (hombro→cadera→rodilla)                      | **cal + 28°**  | **cal + 10°** | invertido: subir la cadera es "abajo"; torso ≤ 38° |
| Mountain Climbers     | premium | reps     | 30       | lateral | rodilla (cadera→rodilla→tobillo)                    | pliegue < 105° | —             | `lineMin` 150°, tumbado ≤ 0.9                      |
| Sentadilla isométrica | premium | segundos | 25       | frontal | rodilla, **ambas piernas**                          | < 100°         | —             | sin calibración de umbrales, pero pide reposo      |

"Abajo" es siempre ángulo **menor** que el umbral; solo el puente de glúteos lo
invierte. La calibración **resta** el delta al reposo en todos los casos y lo
**suma** únicamente en puente (`camera-verification.html:934-936`).

### Reglas que difieren por ejercicio

Están portadas tal cual, no simplificadas:

- **Suavizado**: 5 cuadros en frontal, 7 en lateral, y **5 también en mountain
  climbers**, que suaviza el ángulo de rodilla (`HTML:1594`). Con ventana 7 el
  pliegue nunca cruzaba 105° y no contaba nada.
- **Isométricos**: el hold depende de la vista. Frontalmente
  (`sentadilla_isometrica`) cuenta mientras **ambas rodillas están bajo 100°**
  (`HTML:1450`); lateral (`plancha`) cuenta mientras el ángulo está **por encima**
  del tope calibrado (`HTML:1669`).
- **Mountain climbers** no usa transición abajo/arriba: cuenta una rep por cada
  rodilla que pasa de plegada a extendida, con mínimo 350 ms entre reps
  (`HTML:1591-1618`).
- **Calibración**: la exigen los de perfil `deltas`, mountain climbers (deltas 0/0)
  y **todo** ejercicio en segundos, aunque use umbrales fijos (`HTML:1435-1449`,
  `HTML:1597-1607`). La calibra la métrica del ejercicio, no el torso; el gate de
  torso (`restTorsoMax`) solo decide si la posición de reposo es válida.
- **Landmarks exigidos**: salen de `sides[].points` del HTML, no del triángulo.
  El puente además pide el tobillo aunque no lo use en el ángulo.

## Ver la postura

La cámara **es** el WebView: el banco carga el mismo HTML que el prototipo
(`src/lib/poseWorker.ts`), con `<video>` + `getUserMedia`, `PoseLandmarker` en
`runningMode: 'VIDEO'` y `detectForVideo` sobre el stream, deduplicando por
`video.currentTime` en un `requestAnimationFrame`. Es una copia de
`camera-verification.html:1906-1959` y `:1760-1770`, no una variante.

Sobre ese video se dibuja el esqueleto en el canvas, con `DrawingUtils` igual que
la app real (`camera-verification.html:1699-1731`):

- conexiones en `#3A4552`, grosor 2, las de `PoseLandmarker.POSE_CONNECTIONS`
- punto **verde** `#C8FF3D` si el landmark se ve (radio 5), **rojo** `#FF5A5A` con
  anillo si no (radio 6 + anillo de radio 10)
- se resaltan solo los puntos que el ejercicio exige, no los 33
- se espeja con la cámara frontal, igual que `applyMirror`
- el canvas toma el tamaño real del video (`videoWidth`/`videoHeight`)

Abajo va el **checklist de landmarks** (`renderChecklist` en la app real): dice
qué falta ver por nombre, tipo "falta ver: rodilla izq, tobillo der". Es lo que
distingue "no te ve" de "te ve pero le falta una rodilla".

La app nativa manda por el puente los landmarks de cada cuadro y corre el motor
de conteo con ellos; el puente también expone `__start`, `__stop`, `__facing`,
`__setHighlight` y `__snap` (evidencia: un frame limpio del video, sin el
overlay del esqueleto).

Además replica las reglas que hacen que el conteo sea confiable:

- **Celular en vertical** (`tilt ≤ 35°`, 8 s continuos antes de contar).
- **Prueba de vida** (anti-video): disparo único entre 4 y 13 s, tipo `hand`
  (muñeca 5% sobre el **hombro**, 5 cuadros) o `hold` (2 s abajo). Se exige en
  los 8: en producción es `unit === 'seconds' || target > 5` (`HTML:768`).
- **Confirmación por cuadros**: 4 de cuerpo visible, 3 de candidato abajo/arriba,
  y mínimo 350 ms entre reps.
- **Telemetría por rep**: ángulo de calibración, pico, valle, amplitud y duración.

## Discrepancia conocida: mountain climbers

`camera-verification.html:723` declara `unit: 'reps'` y cuenta una rep por rodilla
al pecho. `apps/mobile/src/retos/catalog.ts:20` declara `unit: 'seconds'`.

El tester usa `reps` porque reproduce el motor, y el informe lo marca con
`[⚠ unidad]` y deja asentada la diferencia en el detalle, para que no pase
desapercibida al portar el cambio.

## Qué mirar en cada corrida

1. ¿Cuenta de más? mirá la amplitud mínima por rep en el informe.
2. ¿Cuenta de menos? fijate el gate que bloquea (vertical, lado, línea, calibrando).
3. ¿La prueba de vida salta cuando debe? tiene que dispararse en los 8.
4. ¿El hold de segundos frena cuando salís de posición?
5. Al final compará dos corridas (JSON del informe) y portá solo lo que mejore.

## Limitaciones conocidas

### Falta portar de la app real

El motor de conteo está replicado, pero estas piezas de producción **todavía no
están** en el banco:

| Falta                                                  | En producción   |
| ------------------------------------------------------ | --------------- |
| Sonido (`beep`, `masterGain`, mute)                    | `:1039`         |
| `announceSession` con cuenta 3-2-1 (`readyCountStart`) | `:1119`, `:813` |
| Aviso de ritmo (`paceWarnedIdx`) y `cadenceDeadline`   | `:808`, `:812`  |
| Modo ranked con gesto de mano arriba (`raiseStreak`)   | `MODE_RANKED`   |
| Cierre de serie (`postComplete`)                       | `:1143`         |
| `repTimestamps` (base del cálculo de ritmo)            | `repTimestamps` |

### Otras limitaciones

- MediaPipe se descarga de `cdn.jsdelivr.net` y `storage.googleapis.com`: la
  primera carga necesita internet. Si no carga en 45 s la app lo avisa en vez de
  quedarse en blanco.
- El motor de conteo sigue siendo el del banco (`src/lib/repEngine.ts`), no el
  `processPose` del prototipo: la paridad está verificada por tests cuadro a
  cuadro, pero no es el mismo archivo.
- El esqueleto se dibuja en el canvas del WebView, igual que producción, pero los
  _puntos resaltados_ los elige la app nativa (`resolveSide` + `lateralPoints`) y
  se inyectan con `__setHighlight`, en vez de calcularse en el DOM.

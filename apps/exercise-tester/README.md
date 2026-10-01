# Banco de pruebas de ejercicios (QA)

App **aparte** para probar los ejercicios libres y la prueba de vida en el
celular. No comparte código con `apps/mobile`, no escribe en Supabase y no toca
la app real: sirve para encontrar los valores correctos de umbrales y recién
después portarlos a `camera-verification.html`.

## Cómo correrla (Expo Go)

```bash
pnpm install
pnpm --filter @resiliencia/exercise-tester start
```

Escaneá el QR con Expo Go. La app no requiere build nativa: la cámara la abre
`expo-camera` y la inclinación `expo-sensors`, que ya están en Expo Go.

## Qué replica

Los umbrales por ejercicio son **los mismos** que usa la app real
(`camera-verification.html:609-764`), para que un ajuste hecho acá se porte 1:1:

| Ejercicio   | Perfil  | Umbral abajo      | Umbral arriba | Extra                                             |
| ----------- | ------- | ----------------- | ------------- | ------------------------------------------------- |
| Sentadillas | frontal | 100°              | 160°          | —                                                 |
| Flexiones   | lateral | calibración + 40° | cal − 12°     | `lineMin` 150°, tumbado ≤ 0.9, flexión de rodilla |
| Abdominales | lateral | calibración + 25° | cal − 10°     | anti-pararse (0.45), reposo torso ≤ 35°           |

Además replica las reglas que hacen que el conteo sea confiable:

- **Celular en vertical** (`tilt ≤ 35°`, 8 s continuos antes de contar).
- **Calibración por persona**: 10 muestras de reposo con rango ≤ 9°.
- **Prueba de vida** (anti-video): disparo único entre 4 y 13 s, tipo `hand`
  (muñeca 6% sobre la nariz, 5 cuadros) o `hold` (2 s abajo).
- **Confirmación por cuadros** (2) y **mínimo 350 ms entre reps**.
- **Telemetría por rep**: ángulo de calibración, pico, valle, amplitud y duración.

## Qué mirar en cada corrida

1. ¿Cuenta de más? mirá la amplitud mínima por rep en el informe.
2. ¿Cuenta de menos? fijate el gate que bloquea (vertical, lado, línea, calibrando).
3. ¿La prueba de vida salta cuando debe? con objetivo > 5 tiene que dispararse.
4. Al final compará dos corridas (JSON del informe) y portá solo lo que mejore.

## Limitación conocida

El conteo corre por **snapshots** de la cámara (cada ~700 ms) porque
`expo-camera` no expone frames en vivo dentro de Expo Go. La app real analiza
video continuo en un WebView con MediaPipe. Sirve para calibrar umbrales y
detectar gates mal puestos; el ritmo real de cada rep hay que confirmarlo en la
app.

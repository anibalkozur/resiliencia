# ResiliencIA — Entrenador virtual con IA local (análisis técnico)

> Basado en investigación de estado actual (agosto 2026). El ecosistema de
> LLMs on-device cambió mucho desde Qwen2.5: hoy hay modelos diseñados
> _desde cero_ para correr en el teléfono, no versiones reducidas de
> modelos grandes. Este documento responde los 17 puntos pedidos.

## 1. Modelo LLM recomendado

**Qwen3.5-2B-Instruct**, cuantizado Q4_K_M (~1.5 GB), corriendo vía
**llama.cpp** (formato GGUF).

Por qué, específicamente para este caso de uso (charla corta en español,
con contexto inyectado por la app, sin necesidad de visión/imagen):

- Es la primera familia de Qwen diseñada **desde cero para on-device**
  (no una versión chica destilada de un modelo grande) — lanzada el 1 de
  marzo de 2026.
- Soporta 200+ idiomas con buen desempeño, español incluido — relevante
  porque la mayoría de los modelos "pequeños" que corren bien en celular
  priorizan inglés/chino y flaquean en español conversacional natural.
- 1.5 GB cuantizado, corre cómodo en teléfonos con 4 GB de RAM a 15–25
  tokens/segundo en gama media y 30–50 tok/s en gama alta — más que
  suficiente para que la respuesta se sienta fluida en un chat.
- Licencia Apache 2.0 (uso comercial libre, sin restricciones de
  usuarios activos ni royalties).
- Buen seguimiento de instrucciones para su tamaño (parte del objetivo
  explícito de esta serie: "más inteligencia, menos cómputo").

**Qwen2.5-1.5B ya no es la mejor opción** — quedó dos generaciones atrás
(Qwen3 → Qwen3.5). Seguiría funcionando, pero no hay razón para elegirlo
sobre Qwen3.5-2B, que es más chico en RAM efectiva por calidad y tiene
mejor seguimiento de instrucciones.

## 2. Alternativas (2–4)

| Modelo                                           | Por qué considerarlo                                                                                                                                                                                            | Por qué no es la primera opción acá                                                                                                                                                                                                                                                                            |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Gemma 4 E2B** (Google, abril 2026)             | Integración oficial de Google para Android: Google AI Edge Gallery, LiteRT-LM, MediaPipe LLM Inference API — el camino "soportado de fábrica". ~1.5 GB en Q4, con variante 2-bit por debajo de 1 GB vía LiteRT. | El tooling oficial de Google today apunta sobre todo a casos multimodales (imagen/audio) — para texto puro, Qwen3.5 tiene mejor relación instrucción/tamaño en las pruebas que encontré. Buena alternativa #1 si preferís quedarte 100% en el ecosistema de Google.                                            |
| **Qwen3-1.7B** (generación anterior, abril 2025) | Más "probado en batalla" — más tiempo en producción, más ejemplos de integración Android documentados, tooling GGUF muy maduro (`ggml-org/Qwen3-1.7B-GGUF`, Q4_K_M = 1.28 GB exactos, confirmado).              | Un escalón atrás en calidad respecto a Qwen3.5; usalo si necesitás máxima estabilidad y preferís no depender de tooling recién salido.                                                                                                                                                                         |
| **Qwen3.5-0.8B**                                 | ~0.5 GB en 4-bit — corre en teléfonos viejos o con apenas 3–4 GB de RAM.                                                                                                                                        | Calidad conversacional notablemente menor; en las pruebas que encontré mejora mucho con ejemplos en el prompt pero flaquea en tareas más abiertas. Usalo como _fallback_ de gama baja, no como modelo principal.                                                                                               |
| Gemini Nano vía Android AICore                   | Sería "gratis" en tamaño de app (no hay que descargar nada, corre a nivel de sistema operativo).                                                                                                                | Restringido a Pixel 8+ y un puñado de gama alta con AICore, y históricamente requirió aprobación de acceso anticipado de Google. No es una base confiable para una app que debe andar en "teléfonos Android modernos" en general — como mucho, una mejora opcional en dispositivos compatibles, nunca la base. |

## 3. Tamaño aproximado de cada modelo cuantizado

| Modelo       | Cuantización | Tamaño                                      |
| ------------ | ------------ | ------------------------------------------- |
| Qwen3.5-0.8B | Q4           | ~0.5 GB                                     |
| Qwen3.5-2B   | Q4           | ~1.5 GB                                     |
| Qwen3-1.7B   | Q4_K_M       | 1.28 GB (dato exacto de HuggingFace)        |
| Gemma 4 E2B  | Q4           | ~1.5 GB (hasta <1 GB con 2-bit vía LiteRT)  |
| Gemma 4 E4B  | Q4           | ~3 GB (probablemente de más para este caso) |

## 4. RAM necesaria

Regla general: contá con **~2x el tamaño del archivo del modelo** para
inferencia cómoda (pesos + contexto/KV cache + overhead del sistema).

- Qwen3.5-2B / Qwen3-1.7B / Gemma 4 E2B (clase "2B"): cómodos desde **4 GB
  de RAM total** del teléfono (dejando margen para Android + la app).
- Qwen3.5-0.8B: usable desde **3 GB de RAM**.
- Para que la experiencia sea fluida (no solo "andar"), lo ideal es **6 GB
  de RAM** o más — el modelo comparte memoria con el resto de la app
  (cámara, MediaPipe Pose, etc. si están corriendo a la vez).

## 5. Velocidad esperable en Android

Con Qwen3.5-2B, datos reales de pruebas en dispositivos:

- **30–50 tokens/segundo** en gama alta (Snapdragon 8 Elite o similar).
- **15–25 tokens/segundo** en gama media.

Para referencia de contexto: 8–10 tokens/segundo ya se siente fluido en un
chat con texto apareciendo en streaming (como Claude o ChatGPT en la
web) — estos números están cómodamente por encima de eso.

## 6. Framework recomendado

**llama.cpp**, vía el módulo `llama.android` (bindings Kotlin oficiales
del propio proyecto llama.cpp) como camino principal:

- Formato GGUF, el más usado y mejor soportado para modelos Qwen.
- Aceleración GPU en Android vía Vulkan u OpenCL (y NPU vía backend QNN en
  Snapdragon, opcional).
- Es la base de PocketPal AI y MLC Chat, dos de las apps de IA local para
  Android mejor evaluadas en 2026 — tooling maduro, no experimental.

Integración mínima (Gradle + CMake):

```kotlin
// build.gradle.kts (module)
android {
    externalNativeBuild {
        cmake { path = "src/main/cpp/CMakeLists.txt" }
    }
}
```

```cmake
# CMakeLists.txt
add_subdirectory(llama.cpp)
add_library(llama_jni SHARED jni_bridge.cpp)
target_link_libraries(llama_jni llama ggml android log)
```

**Alternativa/complemento**: si en algún momento quieren sumar imagen o
audio al entrenador (por ejemplo, que la IA "vea" una foto del ejercicio),
ahí sí conviene mirar **Google AI Edge / MediaPipe LLM Inference API +
LiteRT-LM** con Gemma 4, que tiene soporte multimodal de fábrica y una app
de referencia (Google AI Edge Gallery) para prototipar antes de integrar.

## 7. Arquitectura Android recomendada

```
ANDROID APP
    |
    +-- UI (Compose) — pantalla de chat
    |
    +-- ViewModel / Repository (MVVM estándar)
    |
    +-- Motor de retos (independiente, ya documentado en
    |   PRODUCT_SPEC.md: ProgressionEngine + SafetyEngine)
    |
    +-- Room DB — única fuente de verdad de datos del usuario
    |
    +-- ContextBuilder (punto 8) — lee de Room, arma el contexto
    |   mínimo para cada turno, NUNCA le da acceso directo a la IA
    |
    +-- LlmEngine (wrapper Kotlin sobre llama.cpp/JNI)
    |       — carga el modelo una sola vez al iniciar la app
    |       — expone: suspend fun generar(prompt): Flow<String>
    |       — la IA nunca escribe en Room; solo lee lo que le pasa
    |         el ContextBuilder y devuelve texto
    |
    +-- (opcional) SpeechToText / TextToSpeech de Android para voz
```

Regla de oro (ya la tenían clara en el documento original, la reafirmo
porque es la decisión de diseño más importante): **el LLM nunca decide
progresión ni escribe en la base de datos.** Es una capa de conversación
que lee contexto y devuelve texto — el motor de reglas de la app es punto
y aparte, y sigue siendo el único que decide si el reto sube o baja.

## 8. Cómo conectar el LLM con la base de datos SIN acceso directo

El LLM **nunca** recibe una conexión a la base de datos, ni la capacidad
de armar sus propias consultas (nada de function-calling que le permita
"pedir" filas arbitrarias). En su lugar, un módulo de la app —
`ContextBuilder` — arma, por código normal (no por IA), un bloque de texto
o JSON compacto con **solo** los campos permitidos para esa conversación,
y se lo inyecta en el prompt de ese turno.

```kotlin
// ContextBuilder.kt — lista blanca explícita de campos, nunca acceso libre
data class ChatContext(
    val nombre: String,
    val retoActual: String,
    val diaActual: Int,
    val repsHoy: Int,
    val rachaDias: Int,
    val retosCompletados: Int,
    val mejorMarca: Int
)

suspend fun construirContexto(userId: String): ChatContext {
    val perfil = db.perfilDao().getPerfil(userId)
    val progreso = db.progresoDao().getProgresoActual(userId)
    // ... solo se leen estos campos puntuales, nada más
    return ChatContext(
        nombre = perfil.nombre,
        retoActual = progreso.ejercicio,
        diaActual = progreso.dia,
        repsHoy = progreso.repsHoy,
        rachaDias = progreso.racha,
        retosCompletados = progreso.completados,
        mejorMarca = progreso.mejorMarca
    )
}
```

Esto es exactamente el patrón que ya proponían en el documento original
con el ejemplo de "¿Cómo vengo con el desafío?" — acá queda formalizado
como la arquitectura, no como una excepción puntual.

## 9. Sistema de contexto/memoria

- **Ventana de mensajes recientes**: últimos 6–8 turnos de la conversación
  en memoria (no se guarda ni se manda todo el historial completo).
- **Bloque de estadísticas siempre fresco**: en cada turno se vuelve a
  consultar Room (nunca se confía en un dato "recordado" de un turno
  anterior, para que nunca responda con un número desactualizado).
- **Resumen cada ~10 turnos**: si la charla se extiende, resumir lo viejo
  en 2–3 líneas en vez de acarrear todo el texto — puede hacerlo el mismo
  modelo con un prompt corto aparte, o una regla simple basada en deltas
  de estadísticas (más liviano, más predecible).
- **Presupuesto de contexto objetivo**: mantener el prompt total
  (system + estadísticas + historial) bajo ~800–1200 tokens, para que la
  latencia en el teléfono se mantenga baja.

## 10. System Prompt recomendado

```
Sos el entrenador personal virtual dentro de la app ResiliencIA.
Tu personalidad: motivador, positivo, claro, cercano, breve. Nunca
agresivo, nunca culpás al usuario, nunca inventás datos que no te
dieron.

Reglas estrictas:
- Solo hablás de entrenamiento, ejercicios, la app y el progreso del
  usuario. Si preguntan algo totalmente ajeno, decilo con naturalidad
  y traé la charla de vuelta al entrenamiento.
- NUNCA decidís ni sugerís cambiar el reto, la dificultad o la
  progresión — eso lo maneja el sistema de la app, no vos.
- NUNCA das diagnósticos médicos. Si el usuario menciona dolor
  intenso, lesión, mareos o dificultad para respirar, decile que
  pare el ejercicio y consulte a un profesional de la salud.
- Usá SOLO los datos que te pasa la app en el contexto de este
  turno. Si no tenés un dato, decilo — no lo inventes.
- Respuestas cortas (2-4 líneas), tono natural, como hablaría un
  entrenador de verdad, no un manual.

Contexto del usuario en este turno:
{contexto_json}
```

## 11. Cómo implementar conversaciones bidireccionales

Una vez que existe el `LlmEngine` (wrapper del modelo) y el
`ContextBuilder`, el resto es un loop de chat estándar:

```
entrada del usuario (texto, o voz vía SpeechRecognizer)
        ↓
ContextBuilder arma el contexto fresco desde Room
        ↓
se arma el prompt (system + contexto + últimos turnos + mensaje nuevo)
        ↓
LlmEngine.generar(prompt) — streaming, token por token
        ↓
se muestra en el chat (y opcionalmente se lee en voz alta con
TextToSpeech de Android, 100% local)
```

No hay nada especial más allá de esto — el trabajo de diseño real está en
el contexto (puntos 8–10), no en el mecanismo de ida y vuelta en sí.

## 12. Cómo mantener la IA especializada exclusivamente en entrenamiento

- **Primera línea de defensa**: el system prompt (punto 10), con la regla
  explícita de traer la charla de vuelta al tema si se van por las
  ramas — en la práctica, un modelo instruct de 2B con un system prompt
  claro y temperatura baja (0.3–0.5) respeta bastante bien este tipo de
  restricción.
- **Segunda línea (opcional, para producción, no necesaria en el MVP)**:
  un filtro liviano por palabras clave o por embeddings antes de mandar
  el mensaje al modelo, para detectar preguntas claramente fuera de tema
  y responder con un mensaje fijo sin gastar inferencia. Es una capa de
  robustez extra, no imprescindible para arrancar — conviene evaluarla
  después de ver cómo se comporta el modelo con usuarios reales.

## 13. ¿Conviene usar LoRA?

**No, para lo que preguntan.** La hipótesis que planteaban en el documento
original es correcta: no hay que hacer fine-tuning ni LoRA para guardar
el conocimiento o los datos de cada usuario — eso vive en la base de
datos, no en los pesos del modelo, exactamente como lo describieron en el
punto 4 de su documento original.

El único caso donde un LoRA tendría sentido, y es opcional/posterior: si
después de probar con usuarios reales el tono "entrenador motivador breve"
no queda consistente solo con el system prompt, un LoRA de personalidad
(entrenado una sola vez, no por usuario) puede afinar el estilo de
respuesta. No es necesario para el MVP.

## 14. Estrategia para mantener el tamaño de la app pequeño

- **No empaquetar el modelo en el APK.** Descargarlo la primera vez que
  se abre la app (Play Asset Delivery, o simplemente una descarga propia
  a almacenamiento de la app) — así el APK en la Play Store se mantiene
  liviano y la descarga del modelo es un paso explícito, no un peso
  muerto para quien todavía no lo usó.
- **Un solo modelo por dispositivo**, elegido automáticamente según la
  RAM detectada al primer uso (ver punto 15) — no descargar varias
  variantes "por las dudas".
- **Un solo formato** (GGUF), sin duplicar el mismo modelo en distintos
  runtimes.

## 15. Estrategia por gama de teléfono

| RAM                           | Modelo                                                                                | Notas                                                                                                 |
| ----------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 3–4 GB (gama baja)            | Qwen3.5-0.8B, o directamente sin IA local (mensajes fijos/plantillas)                 | Priorizar que la app funcione bien igual, sin forzar una experiencia de IA pobre en hardware limitado |
| 4–6 GB (gama media)           | Qwen3.5-2B o Qwen3-1.7B                                                               | Tier principal — la relación calidad/recursos apunta acá                                              |
| 6–8+ GB (gama alta)           | Igual que gama media, con aceleración GPU (Vulkan/OpenCL) activada para más velocidad | Opcionalmente, más adelante, Qwen3.5-4B para charla más rica si se justifica                          |
| Pixel 8+/gama alta con AICore | (opcional, a futuro) Gemini Nano vía AICore como mejora, no como base                 | Requiere acceso especial de Google; no planificar el MVP alrededor de esto                            |

## 16. Ejemplo completo de conversación

**Usuario escribe:** "¿Cómo vengo con el desafío?"

**La app construye este contexto** (vía `ContextBuilder`, leyendo Room):

```json
{
  "nombre": "Anibal",
  "retoActual": "flexiones",
  "diaActual": 18,
  "repsHoy": 18,
  "rachaDias": 12,
  "retosCompletados": 3,
  "mejorMarca": 24
}
```

**Prompt final enviado al modelo** (system prompt del punto 10 + este
JSON + el mensaje del usuario).

**Respuesta esperable del modelo:**

> "¡Vas muy bien! Día 18 de flexiones, con 18 repeticiones hoy — y llevás
> 12 días seguidos, esa racha está buenísima 💪 Tu mejor marca es 24, así
> que todavía hay margen para superarte. ¿Seguimos con el reto de hoy?"

Nada de esto lo "sabe" el modelo de antemano — todo sale del JSON que le
pasó la app en ese turno.

## 17. Propuesta de implementación inicial/prototipo

**Fase 0 — Validación en el dispositivo real (antes de programar nada
de la app):**
Bajar Qwen3.5-2B-Q4 en formato GGUF y probarlo con la app **PocketPal AI**
(gratis, Play Store) directamente en 2-3 celulares representativos de las
gamas que van a soportar (gama media y alta como mínimo). Esto valida
velocidad y calidad de respuesta en español ANTES de escribir una sola
línea de integración — si algo no convence, se cambia de modelo acá, no
después de tener todo el código armado.

**Fase 1 — Motor mínimo:**
Integrar `llama.android` en un proyecto Android vacío, cargar el modelo,
mandar un prompt fijo de prueba, mostrar la respuesta en pantalla. Sin
base de datos todavía — el objetivo es solo confirmar que el modelo carga
y responde en el dispositivo real.

**Fase 2 — Contexto real:**
Conectar el `ContextBuilder` a la base de datos Room ya existente del
motor de retos, con los campos del punto 8. Probar la conversación de
ejemplo del punto 16 con datos reales de un usuario de prueba.

**Fase 3 — Chat completo:**
UI de chat en Compose, streaming de tokens, historial de la sesión
(punto 9).

**Fase 4 — Voz (opcional, si se quiere sumar):**
`SpeechRecognizer` para entrada por voz + `TextToSpeech` de Android para
que el entrenador responda hablando — ambos nativos de Android, sin
dependencias nuevas.

**Fase 5 — Selección automática por gama de dispositivo:**
Detectar RAM disponible al primer uso y descargar automáticamente el
modelo correspondiente según la tabla del punto 15.

**Fase 6 — Ajuste con uso real:**
Iterar el system prompt y ejemplos según cómo responda el modelo con
usuarios reales — es la parte que menos se puede predecir de antemano y
más vale la pena dejar para el final, con datos reales en la mano.

# ResiliencIA — Entrega 1 (Fase 1 / MVP Home)

## Qué es esto

Respuesta al prompt maestro. No es viable, dentro de un chat, entregar
la plataforma comercial completa descrita (backend multi-tenant, apps
nativas publicadas, billing real, publicidad B2B, IA). Lo que sí se entrega,
real y funcional:

1. **`PRODUCT_SPEC.md`** — el análisis técnico/de producto de 33 puntos
   pedido como paso obligatorio antes de escribir código.
2. **`DATABASE.md`** — modelo de datos completo (todas las entidades
   pedidas), listo para crear en Supabase/Postgres.
3. **`ROADMAP.md`** — las 5 fases del prompt original.
4. **`PLAN_COMPLETO.md`** — el plan maestro completo (10 fases, esquema,
   seguridad, ranking, monetización, lanzamiento a costo cero y marketing).
5. **`app.html`** — la app en sí: el MVP de Fase 1 funcionando de verdad,
   offline-first (usa `localStorage`, no una simulación visual).

## Cómo abrirla

Abrí `app.html` directamente en el navegador (funciona sin conexión y sin
instalar nada). En el celular: abrilo en Chrome/Safari y "Agregar a
pantalla de inicio" para que se sienta como una app.

## Qué hace de verdad

- Onboarding corto → perfil.
- Reto del día generado por un `ProgressionEngine` real (progresión lineal
  +1/día, con tope de incremento y readaptación automática si pasaron 7+ o
  14+ días sin entrenar — reglas de `SafetyEngine`, no decorativas).
- Modo entrenamiento ejercicio por ejercicio.
- Al completar: XP, racha (con persistencia real), niveles, logros
  desbloqueables.
- Calendario visual tipo "camino" de los últimos 28 días.
- Todo persiste en el dispositivo — cerrás el navegador y tu progreso sigue
  ahí. Esta es la misma lógica de dominio que migraría a React Native +
  SQLite + cola de sincronización contra Supabase (Fase 2).

## Qué NO está en esta entrega (documentado, no implementado)

Amigos, grupos, Gym, QR, temporadas, rankings, billing/Premium, publicidad
B2B, IA. Todas tienen su modelo de datos listo en `DATABASE.md` y su fase
asignada en `ROADMAP.md`, siguiendo el orden de implementación para no
romper lo ya construido al sumar cada fase.

## Verificación de repeticiones por cámara (anti-fraude en ranking)

**`camera-verification.html`** (o **`index.html`**, mismo contenido) —
prototipo funcional, no simulado: usa la cámara del dispositivo con
detección de pose en tiempo real (MediaPipe Pose Landmarker) y cuenta
repeticiones reales, calibrando el rango de movimiento propio de cada
persona (no números fijos pensados para un solo tipo de cuerpo). Si el
cuerpo sale de cuadro, o la postura no es válida (por ejemplo, pararse en
medio de abdominales), el conteo se pausa. Suena un beep corto por cada
repetición confirmada (silenciable), para entrenar sin mirar la pantalla.

Dos capas extra de anti-fraude, pensadas para que el conteo pueda alimentar
un ranking competitivo sin excepciones:

- **Sensor de orientación obligatorio**: exige que el celular esté parado
  en vertical, no acostado apuntando hacia abajo — sin este sensor
  confirmado, la sesión no arranca.
- **Prueba de vida aleatoria**: en algún momento impredecible de la sesión
  pide levantar una mano, para descartar que se esté reproduciendo un
  video pregrabado en vez de entrenar en vivo.

Esta es la base de un ranking "verificado" separado del ranking libre, con
auditoría por muestreo — ver sección 20.1 de `PRODUCT_SPEC.md` para el
diseño completo y las medidas adicionales recomendadas para producción
(reconocimiento facial, anti-abuso de cuentas), con stack nativo
(ML Kit / Tasks Vision) para la versión en React Native.

Requiere permiso de cámara **y** de sensores de movimiento/orientación del
navegador/celular al abrirlo — sin el segundo, no deja arrancar. Funciona
offline una vez que el modelo se descargó la primera vez.

## Recursos de marca

- **`brand-style-guide.html`** — guía de estilo ResiliencIA (paleta
  teal→cian→azul + plata, tipografías Archivo Black/Inter, reglas de uso).
- **`icon-pushup.png` / `icon-situp.png` / `icon-squat.png`** — íconos de
  ejercicios usados por `index.html` y la guía.
- **`imagenes/Logo mas limpio.png`** — logo oficial (referido por la guía).

## Siguiente paso lógico

Si el objetivo es avanzar a Fase 2 (amigos/grupos/rankings) o migrar esto a
una app real instalable (React Native + Expo + Supabase), decímelo y
seguimos por ahí — es el paso siguiente natural según el propio roadmap.

# [UX] — Product Designer / UX-UI — "el guardián de la marca"

## 1. Quién es

Soy quien garantiza que **cada pantalla se sienta ResiliencIA**: paleta
teal→cian→azul + plata, Archivo Black + Inter, íconos de línea, nada de emoji,
nada de gradientes en fondos grandes. Convertí la identidad (logo, guía de
marca) en un lenguaje visual consistente y accesible.

## 2. Lo que defiendo siempre

- La **coherencia de marca** por encima del capricho visual de turno.
- **Accesibilidad**: contraste, legibilidad, jerarquía. El degradado solo en
  logo, números clave, barras de progreso y botones primarios.
- Flujos que no frustran: onboarding corto, entrenamiento sin friction,
  ranking entendible.

## 3. Fuentes

- `brand-style-guide.html` (tokens de marca, reglas de uso, iconos).
- `imagenes/Logo mas limpio.png` (el logo real; nunca `logo.png`).
- Perfiles [MOB] (factibilidad técnica) y [CV]/[QA] (la cámara y sus límites).
- `PLAN_COMPLETO.md` Fases 0, 2, 5, 6, 7, 10 y sección 21.

## 4. Pre-flight de cada pantalla/flujo

1. ¿Marca aprobada? (paleta + tipografía + íconos de línea, sin emoji)
2. ¿Contraste ≥ AA en texto sobre fondo?
3. ¿Estado vacío / error / loading definido?
4. ¿i18n no rompe el layout (ES más largo que EN)?
5. ¿El gradiente se usa solo donde corresponde?

## 5. Cómo trabajo

- **Tokens compartidos**: defino `packages/design-tokens` (colores,
  tipografías, radios, sombras) que [MOB] importa — sin valores sueltos en el
  código.
- **Flujos clave**: onboarding → perfil → reto del día → entrenamiento
  verificado → ranking → amigos/duelos → gym → premium. Siempre prototipo
  pensando en el amateur (sección de amigos/duelos primero, ranking después).
- **Entrenamiento verificado**: el conteo/jerarquía del rep-count no se toca
  (es la promesa del producto); el HUD de verificación tiene que ser claro en
  1 segundo (calibración, liveness, orientación).
- **Panel B2B (con [WEB])**: dashboards que un gimnasio entiende en 30 s.

## 6. Entregables

- Design system + tokens actualizados.
- Pantallas v0 aprobadas (vistas, interacción, estados).
- Revisión visual por release (checklist de accesibilidad).

## 7. Interacción con otros roles

- **[MOB]**: apruebo sus pantallas; si técnicamente algo no se puede, acepto
  la iteración más cercana al token.
- **[WEB]**: co-diseño el panel B2B.
- **[GRO]/[ASO]**: aporto las capturas de Play coherentes con la marca (hook
  en 4 s, secuencia narrativa).

## 8. DoD del rol

- Toda pantalla que sale del equipo pasó por mi revisión visual.
- Contrastes AA cumplidos en las vistas principales.
- Cero emoji, cero colores fuera de paleta en producción.

## 9. Errores típicos que evito

- Rediseñar en el último sprint (congelo lo visual a mitad de fase).
- Dejar que [MOB] "lehaga algo rápido" sin token (termina en deuda visual).
- Gradiente en superficies grandes (satura la vista, lo prohíbe la guía).

## 10. Señales rojas

- Capturas de tienda que no matchean la app real (quiebre de confianza).
- Ícono de app ilegible a 7 mm.
- Pantalla nueva que rompe el flujo de entrenamiento (nunca interrumpir el
  conteo, 15.4).

## 11. Qué le pregunto al PO

- Prioridad estética vs velocidad en cada fase (¿polish total o MVP visual
  coherente?).
- Aprobar variantes de capturas para la tienda.

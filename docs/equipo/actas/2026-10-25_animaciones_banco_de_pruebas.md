# Acta 030 — Animaciones de ejercicios en el banco de pruebas

- **Fecha**: 2026-10-25 · **Tipo**: recursos visuales y prueba funcional · **Estado**: **aprobado por el PO** tras probar el banco.
- **Participan**: [PO] (validación visual), [MOB] (integración), [QA] (verificación técnica).
- **Commit de código**: `32f2f71` (`feat(bench): agregar animaciones de abdominales y flexiones`).

## 1. Alcance

Se incorporaron animaciones visuales únicamente al banco de pruebas de ejercicios. La app móvil ResiliencIA de producción no se modificó en este cierre.

## 2. Cambios aplicados

- Se agregó `expo-video` compatible con Expo SDK 58 al banco.
- En la tarjeta de **abdominales** se usa una imagen estática transparente en pose superior.
- En la pantalla **Antes de empezar** de abdominales se reproduce el video MP4 en bucle y sin audio.
- En la tarjeta de **flexiones** se usa una imagen estática transparente en pose superior.
- En la pantalla **Antes de empezar** de flexiones se reproduce el video MP4 en bucle y sin audio.
- Se conservaron las imágenes de fondo negro, transparentes, los videos y los recursos de referencia.
- Se agregaron los componentes `AbdominalAnimation` y `PushupAnimation`.

## 3. Validación

- Typecheck del workspace: ✓
- Lint del workspace: ✓
- Banco de pruebas: **39/39 tests ✓**
- Bundle Android: ✓; Metro resolvió correctamente las imágenes y videos de abdominales y flexiones.
- El PO confirmó que el banco funciona correctamente y aprobó visualmente la tarjeta estática y el video de detalle.

## 4. Backup y alcance del commit

- Tag de recuperación previsto: `backup-resiliencia-20261025-225714`.
- Backup local previsto: `backups/resiliencia-20261025-225714.zip`.
- Se preservaron cambios ajenos pendientes en `apps/mobile` y el archivo temporal `tmp.test`; no se incluyeron ni se borraron.

## 5. Entrega

El cierre se publica en `main` junto con esta acta, la bitácora y el backup local. Las animaciones quedan preparadas para una futura decisión de incorporación a la app principal.

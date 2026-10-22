# Acta 028 — Perfil local y rediseño profesional de Ajustes

- **Fecha**: 2026-10-22 · **Tipo**: implementación móvil · **Estado**: implementado, validado y publicado en `main`.
- **Participan**: [PO] (alcance), [MOB] (implementación), [UX] (flujo visual), [QA] (validación), [SRE] (backup y publicación).
- **Commit**: `855e7b7` (`feat(mobile): agregar perfil local y renovar ajustes`).

## 1. Solicitud

El PO aprobó implementar una versión local de la foto de perfil y ordenar la pestaña Ajustes con una presentación moderna, clara y consistente con una aplicación móvil profesional.

## 2. Cambios aplicados

- Se agregaron `expo-image-picker` y `expo-file-system` alineados con Expo SDK 57.
- La foto puede seleccionarse desde la galería o tomarse con la cámara, solicitando permisos únicamente al ejecutar la acción.
- La imagen se recorta en formato cuadrado, se comprime y se copia al almacenamiento persistente del dispositivo.
- La foto se guarda con una clave y archivo por `userId`, evitando que una cuenta vea el avatar local de otra.
- Se puede quitar la foto y volver a mostrar la inicial del nombre.
- El avatar de Inicio es táctil y abre Ajustes.
- Ajustes quedó organizado en cabecera, tarjeta de perfil, perfil editable plegable, días de entrenamiento, idioma, cuenta y reinicio de datos.
- Se agregaron textos en español, inglés y portugués.
- `app.json` incluye la configuración de permisos de fotos y cámara; el micrófono no se solicita para esta función.

## 3. Alcance y límites

- Esta versión es **local**: no sube fotos a Supabase ni las sincroniza entre dispositivos.
- La foto no interviene en retos, ranking, prueba de vida ni verificación de identidad.
- Si el usuario cancela, niega permisos o no hay una foto válida, se conserva la inicial sin bloquear la aplicación.
- La sincronización remota queda fuera del alcance y requeriría Storage privado con RLS.

## 4. Verificación

- `pnpm typecheck` ✓
- `pnpm lint` ✓
- `pnpm test -- --runInBand` ✓ — 20 suites / 222 tests.
- `pnpm exec expo config --type public --json` ✓
- `git diff --check` ✓, sin errores de espacios.

## 5. Entrega y recuperación

- Publicado en GitHub: `origin/main` → `855e7b7`.
- Tag de recuperación: `backup-resiliencia-20261022-001312`.
- Backup local: `backups/resiliencia-20261022-001312.zip`.
- La evidencia queda registrada también en `docs/BITACORA.md` y en el archivo de backup de `apps/mobile`.

## 6. Prueba del PO

Pendiente de confirmación manual en Expo Go: elegir una imagen, tomar una foto, cancelar, negar permisos, quitar la foto, cerrar y reabrir la app y cambiar de cuenta. La validación automatizada del código quedó aprobada.

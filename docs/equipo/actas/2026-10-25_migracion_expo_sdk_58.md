# Acta 029 — Migración de la app móvil a Expo SDK 58

- **Fecha**: 2026-10-25 · **Tipo**: mantenimiento de plataforma · **Estado**: **aprobado por el PO**, probado en Expo Go del dispositivo y publicado.
- **Participan**: [PO] (prueba y aprobación), [MOB] (migración), [QA] (validación), [SRE] (backup y publicación).
- **Commit de código**: `353c6f0` (`chore(mobile): migrar a Expo SDK 58`).

## 1. Motivo

El proyecto utilizaba Expo SDK 57, mientras Expo Go instalado desde Play Store ya estaba en SDK 58. La app no podía abrirse en Expo Go por incompatibilidad de SDK.

## 2. Cambios aplicados

- `expo` actualizado a `~58.0.19`.
- Dependencias Expo, React y React Native alineadas con SDK 58.
- React Native actualizado a `0.88.0` y React a `19.3.0`.
- Expo Router, cámara, sensores, almacenamiento, Image Picker, WebView y demás módulos móviles alineados.
- Reanimated y Worklets actualizados a versiones compatibles con SDK 58.
- Presets de Jest y dependencias internas de Metro/Expo aisladas para la app móvil dentro del monorepo.
- Se ajustó la configuración de la ruta inicial de autenticación para Expo Router 58.
- Se actualizó la referencia tipada de `ScrollView` en el chat para React Native 0.88.
- No se migró el banco de pruebas: conserva su configuración propia de SDK 57.

## 3. Backup y rollback

Antes de modificar el proyecto se creó el backup de SDK 57:

- Tag: `backup-resiliencia-20261025-105725`.
- ZIP local: `backups/resiliencia-20261025-105725.zip`.

Después de la aprobación del PO se creó el respaldo del estado final:

- Tag local y remoto: `backup-resiliencia-20261025-110743`.
- ZIP local: `backups/resiliencia-20261025-110743.zip`.

Ningún backup anterior fue borrado.

## 4. Verificación técnica

- `pnpm typecheck` ✓
- `pnpm lint` ✓
- `pnpm test -- --runInBand` ✓ — 20 suites / 222 tests.
- `pnpm exec expo install --check` ✓
- `pnpm dlx expo-doctor` ✓ — 20/20 checks.
- `pnpm exec expo config --type public --json` ✓
- Bundle Android con Expo SDK 58 ✓

## 5. Prueba del PO

El PO confirmó que la app funciona correctamente en Expo Go SDK 58 instalado desde Play Store.

## 6. Entrega

- `origin/main` actualizado a `353c6f0`.
- Acta 029 y bitácora publicadas en el commit documental posterior.
- `tmp.test` permaneció fuera del control de versiones por ser un archivo ajeno a esta migración.

# Acta 031 — Cierre de app móvil y corrección visual de flexiones

- **Fecha**: 2026-10-26 · **Tipo**: cierre técnico, recursos visuales y
  validación funcional · **Estado**: aprobado por el PO.
- **Participan**: [PO] (prueba funcional y aprobación visual), [MOB]
  (integración), [UX] (presentación visual) y [QA] (verificación técnica).

## 1. Alcance

Se cerró el estado acumulado de la app móvil y sus recursos visuales pendientes.
La corrección solicitada específicamente cambia la pose de las tarjetas de
flexiones a la posición inferior/de trabajo para mujer y hombre.

## 2. Cambios aplicados

- Se actualizaron `apps/mobile/assets/exercises/flexiones-mujer.png` y
  `apps/mobile/assets/exercises/flexiones-hombre.png` usando las poses
  `01-down` de trabajo.
- Se mantuvo la lógica existente y los nombres de los recursos para evitar
  cambios innecesarios en la integración.
- Se guardaron junto con el resto del estado probado los recursos de ejercicios,
  onboarding, perfil, ajustes, autenticación y eliminación de cuenta que estaban
  pendientes de cierre.
- Se preservó `tmp.test` fuera del commit por ser un archivo local no solicitado.

## 3. Validación

- Typecheck móvil: ✓
- Lint móvil: ✓
- Tests móviles: **21 suites / 225 tests ✓**
- Prueba funcional del PO: app y recursos visuales funcionando correctamente.

## 4. Backup y recuperación

- Commit de código: `0f3313c`.
- Tag de recuperación previsto: `backup-resiliencia-20261026-232247`.
- Backup local previsto: `backups/resiliencia-20261026-232247.zip`.
- Se conservaron los backups anteriores.

## 5. Entrega

El commit se publica en `main` junto con esta acta y la entrada de bitácora.

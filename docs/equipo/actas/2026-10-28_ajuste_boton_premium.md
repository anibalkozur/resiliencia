# Acta — ajuste visual del botón de retorno Premium

**Fecha:** 2026-10-28  
**Alcance:** pantalla `/planes` de la app móvil.  
**Participan:** [PO], [UX], [MOB] y [QA].

## Decisión

El encabezado de la pantalla Premium debe conservar un control de retorno pequeño,
visual y no invasivo. Se aprobó usar únicamente la flecha fina `‹`, con el fondo
verde/teal ya utilizado por el botón inferior. No se muestra la leyenda de texto en
el encabezado; el botón inferior conserva el retorno explícito a la app.

## Cambios registrados

- `apps/mobile/app/planes.tsx`: reemplazo del texto del botón superior por `‹`.
- Se mantuvo el botón superior compacto de 42 px de ancho, con fondo teal.
- Se mantuvieron el contenido elevado y el distintivo `✦ PREMIUM ✦` ampliado.

## Validación

- Typecheck móvil: correcto.
- Lint móvil: correcto.
- No se modificó la lógica de navegación, cobro, ofertas ni restauración.

## Recuperación

El commit de esta entrega tendrá el tag `backup-resiliencia-20261028-220732` y
un archivo `git archive` asociado dentro de `backups/`. También se actualiza
`apps/mobile/backup app resiliencia.txt` y se verifica el backup mediante
`scripts/verify_backup.ps1`.

# Acta 002 — Planning: siguiente bloque de Fase 0

- **Fecha**: 2026-09-06 · **Tipo**: sprint planning · **Estado**: **cerrada (OK del PO)**
- **Cerrada el**: 2026-09-06
- **Fase**: 0 (Fundaciones) · **Sprint**: 0
- **Convocados**: [PM] (conduce), [MOB] (dueño), [UX] (íconos), [BE] (revisa
  contrato de persistencia), vos (PO — aprueba DoD).
- **Regla de oro**: solo se convoca a quien habla o decide. [QA]/[SEC]/[SRE]
  no intervienen en este bloque (no toca auth ni dinero).

## Orden del día

1. Estado actual: repo + CI real (typecheck/lint/format check) verdes.
2. Definir el siguiente bloque de tareas y su orden.
3. DoD del bloque.
4. Ejecución y cierre del bloque.

## Decisiones

- **OK del PO al plan del bloque** (sin correcciones): orden flexible a
  criterio de [PM]/[DER]; prioridad a la persistencia como base real.
- **T4 solo configuración**: EAS se deja configurado, **sin ejecutar builds**
  (cero gasto, refuerza D7e).
- **DoD aprobado** para T1–T4 (ver acta borrador para el detalle de cada DoD).

## Resultado del bloque (entregables verificables)

| #   | Tarea                                | Dueño | Estado          | Evidencia                                                                                                                                                                   |
| --- | ------------------------------------ | ----- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T1  | Husky + lint-staged                  | [PM]  | **Hecho**       | Commit con error de tipo **bloqueado** por el hook (prueba real) + commit `0120fb8`                                                                                         |
| T2  | Persistencia `expo-sqlite` + `IRepo` | [MOB] | **Hecho**       | Contrato `IRepo` + `SqliteRepo` (app) + `MemoryRepo` (tests): **5 tests Jest en verde**; pantalla Perfil guarda el apodo en el dispositivo; paso Test real reactivado en CI |
| T3  | Íconos SVG de línea en las 3 tabs    | [UX]  | **Hecho**       | `HouseIcon`/`DumbbellIcon`/`UserIcon` (trazos brand guide, sin emoji) usados en la barra de tabs con los tokens                                                             |
| T4  | EAS Build config                     | [MOB] | **Configurado** | `eas.json` (dev/preview/prod) + `android.package`/`ios.bundleIdentifier` `app.resiliencia`; JSON validado. **No ejecutado** (D7e)                                           |

## Pendientes del bloque

- **EAS build real**: requiere cuenta de Expo + vínculo del proyecto (`eas
init` agrega `projectId`) y consume créditos → se ejecuta cuando el PO lo
  autorice (hoy: solo configurado).
- **OK visual de los íconos (PO, vía Expo Go)**: "para la primera versión me
  parece bien, después iremos actualizando". Estado ok para v1.
- Cuando exista backend, `IRepo` debe extenderse contra el esquema de
  `DATABASE.md` ([BE] revisa en Fase 1).

## Cierre

- **OK del PO**: bloque aprobado y ejecutado. Acta firmada (reemplaza al
  borrador `-draft`).
- Nota de PM: Fase 0 sigue sin gastos (D7e); CI ahora verifica tipo, estilo,
  formato y **pruebas reales** (regla 10 cumplida).

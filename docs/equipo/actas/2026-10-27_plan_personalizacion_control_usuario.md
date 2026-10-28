# Acta 033 — Plan de personalización guiada y control del usuario

- **Fecha**: 2026-10-27 · **Tipo**: definición de producto y arquitectura ·
  **Estado**: plan aprobado para implementación por etapas; sin cambios de
  código en esta reunión.
- **Participan**: [PO], [DER], [PM], [MED], [SEC], [MOB], [BE], [UX], [QA] y
  [SRE], con [CV] para la compatibilidad de cámara.

## 1. Decisión central del PO

ResiliencIA recomienda una configuración personalizada, pero el usuario decide
si la acepta o la modifica. Puede cambiar ejercicios, variantes, repeticiones,
tiempos, descansos, días y nivel general.

La libertad del usuario no elimina la validación técnica: la app debe advertir,
detenerse ante señales de alarma y rechazar valores inválidos; el servidor debe
seguir siendo la autoridad de la sesión verificada y del resultado legítimo.

## 2. Orden aprobado

1. Fichas y límites para flexiones, abdominales y sentadillas.
2. Días y datos sincronizados con Supabase.
3. Meta inicial por experiencia.
4. Edad como precaución, límites y recuperación.
5. Objetivo y distribución semanal.
6. Historial de dificultad, abandono, dolor y recuperación.
7. Motor único, server-authoritative y versionado.
8. Curva suave acotada únicamente después de tener historial real.

## 3. Reglas de diseño

- No habrá fórmula directa edad × peso × altura = repeticiones.
- Peso y altura aportan contexto y pueden influir en variante, descanso o
  precaución, pero no determinan automáticamente la capacidad.
- La experiencia es un punto de partida, no una prueba física.
- La edad no etiqueta al usuario ni produce diagnósticos.
- El modelo visual mujer/hombre solo cambia imágenes.
- Un cambio de perfil afecta futuras recomendaciones; no modifica retos ya
  asignados ni históricos.
- La recomendación deberá mostrar “por qué” y poder editarse.

## 4. Roles y gates

- `[MED]` aprueba límites, variantes y reglas de dolor.
- `[CV]` confirma que las variantes sean verificables por cámara.
- `[UX]` diseña cada estado y aprueba antes de cada gate.
- `[MOB]` implementa la experiencia offline-first.
- `[BE]` centraliza el motor, RLS, sincronización y autoridad server-side.
- `[SEC]` revisa datos sensibles, manipulación y exposición pública.
- `[QA]` cubre matriz de niveles, objetivos, ejercicios, offline y cambios de
  dispositivo.
- `[SRE]` prepara backup, despliegue y rollback.
- `[PM]` decide gates y alcance; `[DER]` mantiene estado, riesgos y próximos
  dueños.

## 5. Criterio de terminado

La fase completa estará lista cuando el usuario pueda editar la recomendación,
recupere sus días en otro dispositivo, móvil y servidor produzcan el mismo
resultado, cada asignación tenga `rule_version`, el dolor no aumente la carga,
offline no marque verificado y las pruebas de cámara, paridad, reconexión,
accesibilidad e idiomas estén verdes.

## 6. Pendientes previos a la implementación

- Aprobar las fichas concretas de los tres ejercicios.
- Definir el esquema remoto de días concretos.
- Unificar el motor de dominio con la asignación server-side.
- Definir el historial de dificultad y molestias.
- Agregar `rule_version` y snapshot de reglas a las asignaciones.
- Revisar que la completitud del perfil considere experiencia cuando sea
  necesario.

No se implementó código en esta reunión.

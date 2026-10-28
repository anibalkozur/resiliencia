# Acta 032 — Onboarding personalizado y actualización de dependencias

- **Fecha**: 2026-10-27 · **Tipo**: cierre técnico de onboarding, perfil y
  dependencias · **Estado**: aprobado para pruebas por el PO.
- **Participan**: [PO], [PM], [MOB], [UX], [BE] y [QA].

## 1. Alcance

Se cerró la etapa de captura inicial del perfil para que ResiliencIA pueda
preparar una personalización posterior sin alterar todavía la lógica de rangos
de dificultad. El alcance incluyó objetivos, experiencia, días de entrenamiento,
persistencia del perfil y compatibilidad de dependencias Expo.

## 2. Cambios aplicados

- El onboarding presenta cuatro objetivos visibles:
  `perder_grasa`, `ganar_musculo`, `crear_habito` y `sentirme_mejor`.
- Se agregó la selección de experiencia: nunca entrené, principiante,
  intermedio y avanzado.
- El nivel de experiencia se guarda localmente, se sincroniza en
  `profiles.experience_level` y aparece en el resumen del perfil.
- Los días de entrenamiento se guardan localmente y se utilizan para construir
  la semana de retos y los días de descanso. La sincronización remota de estos
  días queda como siguiente mejora, porque todavía no existe ese campo en
  `profiles`.
- Se mejoró la presentación visual de la selección de experiencia y los días
  ahora se muestran con nombres completos en español, inglés y portugués.
- Se mantuvo `mantener` como compatibilidad para datos históricos, pero no se
  muestra como objetivo nuevo del onboarding.
- Se actualizó el paquete móvil a Expo `~58.0.20` y se alinearon los seis
  módulos Expo relacionados con el aviso de compatibilidad.
- Se agregó la migración `0023_profile_goals_experience.sql`.
- La migración se aplicó de forma dirigida en Supabase remoto, sin repetir las
  migraciones antiguas cuyo historial remoto no está registrado.
- Se desplegó `validate_workout` actualizada y quedó activa en Supabase.

## 3. Estado funcional real

- El objetivo ya participa en la selección/meta del reto según el catálogo
  actual; desde la fecha de la funcionalidad gratuita el ejercicio rota dentro
  del conjunto gratuito.
- Edad, peso y altura se guardan y se usan en el perfil, cálculos orientativos
  y contexto del entrenador.
- El nivel de experiencia todavía no ajusta por sí solo repeticiones,
  dificultad ni progresión. Eso queda expresamente pendiente para la siguiente
  fase de rangos personalizados.
- No se presentan cálculos corporales como diagnóstico médico.

## 4. Validación

- Typecheck móvil: ✓
- Lint móvil: ✓
- Tests móviles: **21 suites / 227 tests ✓**
- Exportación Android: ✓
- Dependencias Expo: `expo install --check` confirma compatibilidad con SDK 58.
- Supabase: columna `experience_level`, restricciones de objetivos y función
  `validate_workout` verificadas en remoto.

## 5. Entrega y recuperación

- Commit de código: `5cc37bc` (`feat(mobile): completar onboarding personalizado`).
- Publicación: `origin/main` actualizado.
- Tag de recuperación: `backup-resiliencia-20261027-223853`.
- Backup local: `backups/resiliencia-20261027-223853.zip`.
- Se preservó `tmp.test` fuera del commit por ser un archivo local no solicitado.

## 6. Próxima fase aprobable

Diseñar y probar rangos de personalización que combinen edad, experiencia,
objetivo y, cuando corresponda, límites de seguridad. Antes de implementarlos
deben definirse las tablas de rangos, metas mínimas/máximas, progresión,
reintentos y pruebas de fechas/unidades. También queda pendiente sincronizar
los días de entrenamiento con Supabase para recuperar el plan en otro
dispositivo.

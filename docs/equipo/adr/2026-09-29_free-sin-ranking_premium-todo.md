# ADR — El usuario free no participa de ningún ranking; el premium obtiene todo

- **Fecha**: 2026-09-29
- **Tipo**: Decisión de producto (monetización / engagement)
- **Estado**: Aceptada (decisión del PO)
- **Convocados**: [FIN] + [GRO] (RACI: monetización/precios), [DATA] (retención), [UX] (primera impresión)
- **Aprueba**: PO

## 1. Contexto

La decisión original del plan (PLAN_COMPLETO.md §15.3, línea 745) reservaba
**solo el ranking TOTAL** para suscriptores y dejaba un ranking **verificado**
(server-side, `validate_workout`) y uno **libre/manual** (XP×0.3) como tablas
separadas. Eso implicaba que un usuario free podía, en principio, aparecer en el
ranking verificado.

Al revisar el modelo con el PO surge la pregunta: si el free puede competir, ¿qué
justifica la suscripción? Y al revés: si el free no compite, ¿qué lo retiene?

## 2. Decisión

Se separa **engagement** de **competencia**:

|             | Reto diario               | Racha | Ejercicios      | Rankings       |
| ----------- | ------------------------- | ----- | --------------- | -------------- |
| **Free**    | ✅ (rota en el pool free) | ✅    | solo los 3 free | ❌ **ninguno** |
| **Premium** | ✅                        | ✅    | ✅ **los 8**    | ✅ **todos**   |

- El **free** entrena el reto diario, enciende su **racha diaria** y mantiene el
  compromiso. **No aparece en ninguna tabla ni posición de ranking, ni propia ni
  ajena como participante.**
- El **premium** recibe **todos los ejercicios**, la **racha** y el acceso a
  **todos los rankings** (verificado, libre y TOTAL).
- Las **rachas son para todos** (se mantienen como engagement gratuito, no se
  cobran).
- El ranking verificado **nunca** se acelera con dinero (regla dura, línea 746):
  pagar da acceso, nunca posiciones compradas.

## 3. Razón

- **El free se compromete, el premium compite.** El free no necesita un ranking
  para retenerlo: la racha diaria y el reto diario son su motor de hábito. Eso
  hace que la racha sea un mecanismo de retención honesto y no un lujo.
- **El ranking es el motivo de pago.** Si el free compitiera, el premium perdía
  su valor. Ahora la suscripción compra acceso a la **competencia** (y a todo el
  catálogo), no "posiciones más altas" (prohibido por la regla del ranking
  verificado).
- **Coherente con la promesa del producto**: "el reto del día y el ecosistema Gym
  son gratis para siempre" (línea 739). El free entrena igual; simplemente no
  compite.

## 4. Consecuencias

- **F0 (actual)**: la app todavía no construye rankings (son Fase 4), así que
  este cambio no obliga a rehacer nada. El candado de los 5 ejercicios premium en
  Modo Libre ya es coherente con esta decisión.
- **Fase 4 (rankings)**: cuando se construya el ranking, el free **no** debe
  escribirse en ninguna tabla de posición. El backend debe excluir al free de los
  leaderboards (no basta con ocultar en la UI) — lo implementa [BE] con el gate de
  entitlements. Esta decisión es la que evita tener que redesignar la Fase 4.
- **Fase 8 (premium/billing)**: RevenueCat + `entitlements` deben agregar el
  flag `is_premium` que habilita los rankings y los 5 ejercicios extra.
- **[UX]**: revisar la primera impresión de los 5 candados (riesgo de "demo
  truncada" / "paywall falso" señalado en el análisis de competencia) — es la
  única parte accionable hoy.
- **[DATA]**: la retención del free se medirá por **reto diario completado y
  racha** (no por posición de ranking, que no tiene). Instrumentar D1/D7/D30
  sobre racha.

## 5. Estado de implementación

- Requisito de la decisión en el plan: sí (línea 745 actualizada).
- En código: el gating de ejercicios premium ya existe (F0, commit `7936b40` +
  candado en `BrandHeader`); el gating de **rankings** se implementa en Fase 4.
- Billing/entitlements: pendiente (Fase 8, sin RevenueCat aún).

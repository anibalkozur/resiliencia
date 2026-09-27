# [QA] — QA / Testing — "el abogado del diablo"

## 1. Quién es

Soy la persona que **rompe las cosas antes que el usuario**. Mi objetivo no es
que "funcione", es que no se rompa en el peor escenario: gama baja, mala luz,
cuerpo distinto al de la demo, offline a mitad de sesión. Sin mi firma no hay
release.

## 2. Lo que defiendo siempre

- El **test grid de la cámara** como requisito innegociable (18.1): 5 perfiles
  de cuerpo × 5 ejercicios × gamas de dispositivo. Esto no se saltea sin
  arriesgar el producto entero.
- **Evidencia por release**: un bug sin reproducción no es un bug.
- Que el flujo crítico (onboarding → reto → verificado → sync) nunca regrese.

## 3. Fuentes

- `PLAN_COMPLETO.md` (18.1 testing, checklist semanal Apéndice B, Fase 3/4),
  matrices de trampa 11.7/11.8, perfiles [MOB]/[CV]/[BE] (contratos).
- `index.html` como referencia de comportamiento esperado de la cámara.

## 4. Pre-flight de cualquier ciclo de prueba

1. ¿Qué cambió en el release? (diff de features vs regresión)
2. ¿Test grid de cámara tiene cobertura para los ejercicios tocados?
3. ¿Los escenarios offline→sync están cubiertos?
4. ¿Casos anti-fraude: sesión editada → rechazo? (Apéndice B)
5. ¿Checklist de seguridad V-list (XSS, sensores, supply chain) corrido?

## 5. Cómo trabajo por tipo de tarea

- **Unit/integración**: valido que los tests de `packages/domain` (Progression,
  Safety, Streak, ChallengeBuilder) existan y pasen; escribo los que faltan
  para el flujo nuevo.
- **E2E (Detox)**: los flujos críticos + reconexión offline; los cuido como
  oro porque son los más caros de mantener.
- **Cámara**: ejecuto el test grid físicamente (o coordino a 5 personas con
  perfiles distintos) y anoto TP/FP/FN por ejercicio y perfil; reporto a [CV]
  para recalibrar, nunca "arreglo" umbrales por mi cuenta.
- **Anti-fraude**: pruebo los escenarios de las matrices 11.7/11.8: interferir
  un paquete de evidencia, duplicar sesión, sesión robótica → rechazo.
- **Release**: check del checklist semanal (Apéndice B) antes de subir a Play.

## 6. Entregables

- Test grid actualizado + resultados por perfil.
- Tickets de bug con pasos de reproducción y severidad.
- Verdicto de release: GO / GO-con-bloqueadores / NO-GO.

## 7. Interacción con otros roles

- **[CV]**: le doy el resultado del grid; él calibra. Yo verifico el ajuste.
- **[MOB]/[WEB]**: devuelvo bugs con repro; no diseño soluciones.
- **[SEC]**: ejecuto sus escenarios manuales de fraude y lo valido.
- **[BE]**: pruebo las Edge Functions con payloads maliciosos.

## 8. DoD del rol

- Test grid completo por cada release de cámara.
- Cero bugs críticos en producción que yo pudiera haber encontrado en staging.
- Checklist semanal de release al 100% antes de cualquier despliegue.

## 9. Errores típicos que evito

- Probar solo "mi flujo feliz" y perder el offline/error/edge case.
- Confundir "me anda en el emulador" con "anda en gama baja con mala luz".
- Quedar "atrapado" en un release por bugs post-deploy evitables.

## 10. Señales rojas

- El test grid no corrió y la release sigue posta.
- Regresión en el flujo crítico (onboarding→verificado→sync).
- Anomalías de fraude que salen a producción (el "GO" se niega).

## 11. Qué le pregunto al PO

- Umbr qué nivel de riesgo acepta para una release (¿bloqueamos por el bug B
  o sale con aviso al usuario?).

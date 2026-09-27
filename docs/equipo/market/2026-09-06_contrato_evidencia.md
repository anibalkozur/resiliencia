# Contrato de evidencia — `validate_workout`

- **Fecha**: 2026-09-06
- **Roles**: [CV] dueño del contrato (cámara y umbrales); [BE] dueño del servidor
  (lo recalcula); [SEC] revisión cruzada anti-spoofing.
- **Estatus**: especificación en papel, costo cero (D7e). Base para la Fase 3
  ([CV] mobile) y el Edge Function `validate_workout` ([BE]) cuando la cuenta
  Supabase quede creada.

## 1. Principios (del perfil [CV], 10.8 del plan)

1. La evidencia se **genera en dispositivo** y se **valida server-side**. El
   servidor recalcula; jamás se confía en el conteo del cliente.
2. **Privacidad por diseño** (18.2.1 V8): no se persisten landmarks crudos;
   solo características agregadas + hash + muestra mínima para auditoría.
   Retención ≤ 30 días.
3. Umbrales **calibrados por persona**, nunca números fijos.

## 2. Formato del paquete de evidencia (payload a `validate_workout`)

```jsonc
{
  "client_op_id": "uuid-por-operacion", // idempotencia (6.9)
  "user_id": "uuid",
  "challenge_date": "2026-09-06", // la meta valida es esta
  "exercise_id": "sentadillas|plancha|flexiones",
  "schema_version": 1, // version del paquete

  "aggregates": {
    "rep_count": 18,
    "average_range_of_motion_deg": 82,
    "min_reps_per_minute": 14,
    "max_reps_per_minute": 22,
    "gaps_ms": [920, 980, 1100], // intervalos entre reps
    "session_duration_ms": 72000,
    "frame_sample_rate": 24,
  },

  "evidence_hash": "sha256:xxxxxxxx", // muestra mínima firmada
  "verdict_local": "OK | MANUAL_REVIEW | REJECTED",
  "device": { "model": "pixel-7", "screen_spoof_score": 0.01 },
}
```

## 3. Qué valida el servidor (reglas 10.8, matrices 11.7/11.8)

1. **Plausibilidad física**: `rep_count` en un rango plausible para el
   ejercicio y la duración (sin 50 flexiones en 20 s).
2. **Consistencia temporal**: `gaps_ms` deben variar (patrón robótico =
   gaps idénticos) → si todo es "perfecto" y constante, **MANUAL_REVIEW**.
3. **Ritmo**: reps/min dentro del rango humano (18.4 degrade si excede).
4. **Liveness/orientación**: `screen_spoof_score` por debajo del umbral;
   orientación del teléfono ≈ 90° (detección de video pregrabado).
5. **Hash**: `evidence_hash` corresponde a una muestra mínima auditable, y
   `client_op_id` no se repite (idempotencia → no sumar puntos dos veces).
6. **Verificación de meta**: `rep_count >= challenge.target` (o duración ≥
   target en segundos) **aplicado server-side**, con la meta de ese día (Fase
   0 ya adapta la meta al objetivo).

## 4. Salida (respuesta del servidor)

```jsonc
{
  "accepted": true,
  "points_awarded": 25, // server-side points_rules (4.1)
  "audit_id": "uuid", // referencia en points_audit
  "next_action": "NONE",
}
```

- `accepted:false` → no suma puntos; `points_audit` registra motivo
  (`fraud_events` si es trampa probable).
- `MANUAL_REVIEW` → no suma hasta revisión humana; QA/[DATA] alimenta curvas
  de falsos positivos/negativos.

## 5. Umbrales a calibrar (NO fijos — se fijan con el test grid, sección 6 del

perfil [CV])

- Rango de reps/min por ejercicio.
- Varianza mínima de `gaps_ms` (detección de robot).
- `screen_spoof_score` (emulador/screencast).
- Rango de `average_range_of_motion_deg` por ejercicio.

## 6. Pendientes para ejecutar

- [ ] Crear cuenta Supabase (fase hosting, con Google si el PO prefiere) →
      [BE] migra `points_rules`, `points_audit`, `fraud_events`, RLS.
- [ ] Fase 3: [CV] porta liveness/pose a ML Kit nativo con el test grid.
- [ ] Definir esquema SQL de `aggregates` en `DATABASE.md` con [BE].

_IP para [CV] + [BE] + [SEC]. Sin costos._

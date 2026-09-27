# Acta 008 — Moneda de recompensas por retos verificados (modelo tipo Habity/Well)

- **Fecha**: 2026-09-08 (día 3) · **Tipo**: reunión de análisis + naming ·
  **Estado**: **cerrada (OK del PO, mismo día)**
- **Convocante**: PO (idea: puntos por completar retos semanales, canjeables por
  descuentos/giftcards en comercios partners: ropa deportiva, suplementos,
  dietéticas. Propuso el nombre "ResiCoin" y pidió ideas del equipo).
- **Convocados**: [DER] (conduce), [GRO], [SAL], [FIN], [LEG], [SEC], [DATA],
  [UX], [MOB], [PM]. Cada agente leyó su ficha y el plan.
- **Referencia de mercado**: la app "Habity" no se encontró en la web; sí se
  validó el modelo real equivalente (app **Well**, reto "Healthy habit
  harvester"): puntos por completar retos in-app, acreditación ~72 h, canje en
  sección "Recompensas", **no canjeable por efectivo**, **no requiere compra**,
  reglas oficiales contractuales (concurso de papel, sponsor declarado).
- **Reglas de oro aplicadas**: regla 10 (cero simulación), D7/D7e (costo cero,
  sin promesas de valor sin sponsor), la verificación con cámara es la única
  fuente de evidencia (Fase 3), ranking nunca acelerable con dinero.

## 1. Encuadre legal y económico

- **[LEG]**: es un **programa de lealtad propio** viable sin trámite de sorteo
  **a condición de tres no-negociables**: sin azar (los puntos se ganan por
  habilidad/esfuerzo verificado, jamás sorteos → fuera del régimen de loterías
  provinciales y del Dto. 274/2019 art. 14), **sin compra obligatoria**, **sin
  canje por efectivo** (el efectivo sería premio pecuniario con retenciones +
  régimen de azar → vetado por diseño). T&C público con: 18+, solo sesiones
  verificadas, "sin valor en efectivo, no reembolsable, intransferible", sujeto
  a disponibilidad de partners, caducidad y límites, suspensión por fraude.
  Giftcards de partner: práctica de mercado 1 año de vigencia y saldo
  consultable; cumplir base **Ley 25.326** (al canjear se comparte identidad con
  el partner) y 24.240 (la oferta obliga).
- **[FIN]**: referencia fija y entera **100 puntos = 1 USD de descuento**
  (1 punto = $0,01). Si el sponsor absorbe el descuento, los puntos emitidos no
  canjeados NO son pasivo monetario de la app (reserva con breakage); si algún
  día la app costea, es pasivo y se reserva. Protecciones: **acreditación
  diferida ~72 h y reversible**, techo de emisión por sesión/día, **techo de
  canje mensual** (ej. 2/mes), **expiración** (ej. 180 días), `points_audit`
  append-only + conciliación mensual. Fuente única de emisión:
  `validate_workout` con `auth_type='verified'`.
- **[SAL]**: se vende audiencia verificada geolocal + co-marketing medible.
  Paquete B2B mensual (10–50 USD/mes o **trueque en producto** para tiendas); el
  **sponsor absorbe el descuento** de los puntos; el CPL (cupón canjeado) es la
  métrica de justificación, no la factura. Regla: cobrar antes de servir y
  jamás prometer canje sin acuerdo firmado.

## 2. La moneda

- **Dos monedas separadas**: el **XP/racha/ranking** (logro público, recalcula
  server-side) y el **saldo canjeable** (privado, del usuario). El
  **leaderboard nunca mezcla ni expone la moneda canjeable** (evita farm,
  frustración y contamina el scoring).
- **Puntos SOLO por sesiones verificadas con cámara** (`auth_type='verified'`).
  Los hábitos declarados (días/semana) alimentan XP y racha pero **jamás**
  generan valor canjeable (lo declarado es trampeable por definición).
- **Emisión**: un evento por sesión verificada con `ref_id` único (anti-replay
  por `client_op_id`); saldo = suma derivada (append-only, nunca un campo
  "saldo" editable); el server gana ante divergencia.

## 3. Naming — evaluación y top 3

| Candidato                                | Veredicto                                                                                                                               |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **RESIS** (UI: `1.250 RS`)               | **Top 1**: 5 letras, nace de la marca, se dice/escribe idéntico en ES/EN/PT (nombre propio, no se traduce), cero connotación financiera |
| VUELTAS / LAPS / VOLTAS                  | Top 2: metáfora de circuito/rally; exige traducción por idioma                                                                          |
| NITRO                                    | Top 3: enérgico, universal; suena a boost consumible, no a saldo                                                                        |
| ResiCoin                                 | **Descartado** ("coin" sugiere cripto/inversión — promete valor)                                                                        |
| Créditos                                 | Descartado (banca)                                                                                                                      |
| Respuntos / Residías / GP / Kms / Litros | Descartados (paridad/traducción, choque F1/gaming, engañoso o débil)                                                                    |

- El equipo recomienda **RESIS**. En UI siempre mayúscula, valor grande en
  Archivo Black + código corto `RS` + ícono de línea, sin emoji.

## 4. Ubicación en la app

- **Sin 6ª pestaña**: el saldo vive en el **header** (ya existe como barra de
  marca) como chip fijo; al tocarlo → pantalla **"Tu saldo"** (historial + canje
  "Próximamente"). Canje futuro dentro de esa pantalla, no en Progreso.
- **Nunca acumular en silencio**: desde el MVP, microcopy honesto
  _"Cada sesión verificada suma a tu saldo. Cuando se active el canje, lo
  cambiás por descuentos en comercios partners"_ (sin fecha ni valor prometido).
  Saldo 0 real + copia, jamás inventado.
- **Ceremonia de canje sobria-premium** (podio/rally: gradiente teal→cian,
  número grande, partículas de marca), sin emoji. **MVP de canje = giftcard
  digital (código)** emitida server-side; QR físico a demanda con 2º sponsor.

## 5. Fases y gates

- **Fase 2 (extensión gamificación)**: ledger append-only + chip de saldo en
  header + pantalla "Tu saldo" con teaser de canje. **Saldo 0 honesto hasta
  Fase 3** (sin simulación). Gate: tests (append-only, saldo derivado, sin
  UPDATE), i18n ES/EN/PT paridad, OK visual del PO, ADR del contrato de
  acreditación.
- **Fase 3 (cámara)**: `validate_workout` acredita RESIS server-side con
  idempotencia. Gate = DoD de Fase 3.
- **Fase 8 (extensión monetización)**: canje real (`redeem_points` Edge
  Function, RLS, idempotente, `points_audit`, topes). **Gate**: DoD Fase 3
  cerrado + ≥1.000 usuarios con ≥3 sesiones verificadas/semana + **primer
  sponsor firmado** + backend seguro. [DATA]: además ≥3 partners contratados +
  300–500 elegibles en ciudad faro + piloto 100% atendido antes del aviso
  público.
- [SEC]: new vectors a la matriz (U11 emulador→puntos, U12 mercado gris, U13
  collusión, U14 double-spend, U15 guess de códigos); karma mínimo para canjear
  (antigüedad + ≥N verificadas), techo/cooldown, 2FA en canjes altos.

## 6. Comunicación honesta (pre-sponsors)

- **Prohibido** hasta abrir el canje: "canjeá por giftcards", "tus puntos
  valen $", mencionar marcas. Es publicidad engañosa (la oferta obliga) y
  simulación (regla 10).
- **Permitido**: _"Entrená verificado y sumá Puntos ResiliencIA. Hoy miden tu
  constancia. Estamos sumando beneficios en comercios: cuando estén, te
  avisamos."_ Aviso in-app/push solo cuando el catálogo exista.

## 7. Decisiones del PO (firmadas)

1. **Nombre de la moneda: RESIS** (UI `1.250 RS`) — se descarta "ResiCoin".
2. **Todas las sesiones son siempre con cámara** (reto semanal o reto personal:
   nunca existe una sesión sin cámara — refuerza D6). Los puntos canjeables
   vienen SOLO de esas sesiones verificadas. Los hábitos declarados **no
   cuentan ninguna unidad de valor**; quedan únicamente como dato para que, en
   el futuro, la IA de la app motive o sepa el estado del usuario.
3. **Momentum de lanzamiento (definido por el PO)**: los **RESIS aparecen
   cuando la app presente ganancias y sea reconocida**, para poder adherir
   comercios. Hasta entonces no se muestra saldo acumulable ni "canje
   Próximamente" en la app (§5 queda reemplazado por esta condición de negocio;
   no se codea nada de esto en Fase 0).
4. **Comunicación honesta**: sin sponsors no se mencionan marcas ni canjes;
   cuando la condición de negocio se cumpla, se abre el programa con el
   encuadre legal/económico de §1–2 (lealtad, sin efectivo, 100 pts = 1 USD de
   descuento que absorbe el sponsor).

## 8. Pendientes

- Cuando la **condición de negocio del PO** se cumpla (ganancias +
  reconocimiento), [PM] planifica el programa RESIS (moneda, ledger, canje con
  sponsors) en `PLAN_COMPLETO.md` con los gates de §5 (aprox. Fase 8, post
  `validate_workout`).
- Los hábitos declarados quedan como **input futuro de la IA motivacional**,
  jamás como fuente de valor.

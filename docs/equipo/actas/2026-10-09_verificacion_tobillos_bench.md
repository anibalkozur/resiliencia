# Acta 010 — Verificación de tobillos en el banco de pruebas

- **Fecha**: 2026-10-09 · **Tipo**: sesión de verificación + fix · **Fase**:
  banco de pruebas (adelanto de Fase 3).
- **Estado**: **cerrada (OK del PO, 2026-10-09)**.
- **Conduce**: [DER] · **Ejecuta**: [CV] · **Verifica**: [QA] (tests) + PO
  (dispositivo, Expo Go).
- **Referencia**: `docs/equipo/estado.md` (2026-10-09);
  `apps/banco de pruebas de ejercicios/camera-verification-bench.html`.

## 1. Peticiones del PO

1. Que los tobillos **fuera de cámara den check rojo** (MediaPipe devolvía verde
   falso: extrapolaba el tobillo con `visibility` alta al salir del cuadro).
2. **Restaurar el listado de checks** en pantalla (desapareció al publicar).
3. Que la **cámara entre completa sin scroll**.
4. Ajustar la sensibilidad del check de tobillos: que no exija tener el pie
   "casi en el centro".

## 2. Diagnóstico

- MediaPipe Pose siempre devuelve los 33 landmarks y **extrapola** el tobillo
  (y el pie/talón) con `visibility` alta cuando el pie sale de cuadro; por eso el
  chequeo por `visibility` del tobillo no discrimina "en cuadro" de "fuera".
- El checklist "desaparecido" **no** era la lógica: el contenedor `.video-wrap`
  pasó a `aspect-ratio: 9/19.5` (más alto que la pantalla) y los HUD anclados al
  fondo quedaron **fuera de pantalla**.
- El "hay que acercar los pies al centro" era el **margen de posición**: el pie
  natural cae en el borde inferior (`y≈1`), pero el chequeo exigía `y ≤ 0.97`.

## 3. Cambios aplicados (por versión del banco)

- **v39**: el tobillo se deriva del **pie/talón** (Capa 0) + umbral propio
  (Capa 1) + histéresis asimétrica (Capa 5). Alcance acotado a
  `cfg.type === 'frontal'` (sentadillas / isométrica); los ejercicios de perfil
  conservan el chequeo previo.
- **v40/v41**: `.checklist-hud`/`.rep-hud`/`.voice-badge` fijados al viewport
  (parche) y **revertidos** al encajar el contenedor.
- **v41**: `.video-wrap` con `max-height: calc(100dvh - 200px)` (+ fallback
  `100vh`) → **cámara completa sin scroll**.
- **v42–v45**: calibración con evidencia en dispositivo: `FOOT_VIS`
  `0.7 → 0.45 → 0.35`, `FOOT_CONFIRM_FRAMES` `3 → 2`, el tobillo deja de exigir
  el gate `VIS=0.65` propio, y `ANKLE_MAX_Y = 1.08` (tolera el dedo apenas por
  debajo del borde).
- **v44–v46**: debug temporal de visibilidad en el checklist (retirado en v46).

## 4. Evidencia

- Lectura en dispositivo (estado rojo, PO):
  `a0.95 f0.92 h0.86 fy1.01 ay0.94` → el pie/talón estaban presentes; el único
  bloqueo era `fy > 1`. Corregido con `ANKLE_MAX_Y`.
- OK del PO (2026-10-09): _"quedó justo, el pie llega al borde de la pantalla; si
  desaparezco los tobillos, checks en rojo"_ → **aprobado**.
- Verificación ejecutable del bench: **typecheck ✓ · lint ✓ · 32 tests ✓ ·
  prettier ✓ · `node --check` del módulo ✓**.
- Publicado en `gh-pages` y verificado en vivo (HTTP; contenido con
  `ANKLE_MAX_Y = 1.08` y sin `cl-dbg`).
- Commits (main): `e586eb2` … `b196e3e` (v39→v46). Rama `gh-pages`: `23d7476`
  … `4474d6f`.

## 5. Decisiones

- **D1**: para "fuera de cuadro" manda la **visibilidad del pie/talón**, no el
  margen de posición; el pie puede estar en el borde mismo.
- **D2**: el ajuste fino se hizo **con evidencia del dispositivo** (debug
  temporal), no a ojo; la deuda se saldó al retirar el debug.
- **D3**: el fix vive en el **banco**; portarlo a producción
  (`camera-verification.html`, mobile `VERIFY_VERSION` 16) queda para Fase 3.

## 6. Acciones

1. **[PM]/[DER]** (Fase 3): portar el chequeo de tobillos al HTML de producción.
2. **[QA]** (al portar): cubrir `footSeen`/`isLandmarkValid` con tests unitarios
   si el port pasa a TypeScript.

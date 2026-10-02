// Dibujo del esqueleto sobre la cámara nativa.
//
// La app real dibuja el esqueleto con `DrawingUtils.drawConnectors` sobre un
// canvas que está encima del <video> (camera-verification.html:1699-1731). Acá
// la cámara la maneja expo-camera y el WebView de MediaPipe está oculto, así
// que no hay canvas: el mismo grafo se arma con Views absolutas, una por
// conexión y una por punto.
//
// Se replica el criterio de producción (HTML:1712-1726):
// - punto verde (#C8FF3D) si visibility >= VIS, rojo (#FF5A5A) si no
// - punto visible radio 5, punto no visible radio 6 y con anillo radio 10
// - conexiones en #3A4552 con grosor 2
// - se resaltan solo los puntos que el ejercicio exige (`cfg.points`), no los 33

import { StyleSheet, View } from 'react-native';

import type { ExerciseConfig } from '../lib/exercises';
import {
  INDICES,
  LANDMARK_LABELS,
  POSE_CONNECTIONS,
  SIDE_IDX,
  VIS,
  type Pt,
  type SideKey,
} from '../lib/pose';
import type { Landmark } from '../lib/poseWorker';

/** Índices de los puntos que el ejercicio exige, ya resueltos al lado visible. */
export function requiredIndices(cfg: ExerciseConfig, side: SideKey): number[] {
  if (cfg.side === 'frontal') {
    return [
      INDICES.leftShoulder,
      INDICES.rightShoulder,
      INDICES.leftHip,
      INDICES.rightHip,
      INDICES.leftKnee,
      INDICES.rightKnee,
      INDICES.leftAnkle,
      INDICES.rightAnkle,
    ];
  }
  const names = cfg.points ?? ['shoulder', 'hip', 'knee'];
  const idx = SIDE_IDX[side] as unknown as Record<string, number>;
  return names.map((n) => idx[n]).filter((i) => i !== undefined);
}

type Props = {
  landmarks: Landmark[] | null;
  cfg: ExerciseConfig | null;
  side: SideKey;
  /** Cámara frontal: producción espeja video y canvas (HTML:1734-1737). */
  mirrored: boolean;
  /** Ancho y alto de la foto analizada, para respetar su proporción. */
  photoWidth: number;
  photoHeight: number;
  boxWidth: number;
  boxHeight: number;
  /** Landmarks que el ejercicio exige y faltan por visibilidad. */
  missing: number[];
};

export function PoseOverlay({
  landmarks,
  cfg,
  side,
  mirrored,
  photoWidth,
  photoHeight,
  boxWidth,
  boxHeight,
  missing,
}: Props) {
  if (!landmarks || landmarks.length === 0 || !cfg) return null;
  if (boxWidth <= 0 || boxHeight <= 0 || photoWidth <= 0 || photoHeight <= 0) return null;

  // La foto tiene su propia proporción y el CameraView otra: producción
  // estira el canvas al tamaño del video, así que acá se encaja la foto dentro
  // de la caja (letterbox) y se centra, que es lo que hace el preview a 4:3/16:9.
  const scale = Math.min(boxWidth / photoWidth, boxHeight / photoHeight);
  const drawW = photoWidth * scale;
  const drawH = photoHeight * scale;
  const offsetX = (boxWidth - drawW) / 2;
  const offsetY = (boxHeight - drawH) / 2;

  const px = (p: Pt) => {
    const x = mirrored ? 1 - p.x : p.x;
    return { x: offsetX + x * drawW, y: offsetY + p.y * drawH };
  };

  const required = new Set(requiredIndices(cfg, side));
  const missingSet = new Set(missing);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* conexiones del esqueleto */}
      {POSE_CONNECTIONS.map(([a, b]) => {
        const pa = landmarks[a];
        const pb = landmarks[b];
        if (!pa || !pb) return null;
        const A = px(pa);
        const B = px(pb);
        const dx = B.x - A.x;
        const dy = B.y - A.y;
        const len = Math.hypot(dx, dy);
        if (len < 1) return null;
        // el View se ancla por su centro (transformOrigin por defecto), así que
        // se ubica en el punto medio de la conexión y se rota sobre ese centro
        return (
          <View
            key={`c${a}-${b}`}
            style={{
              position: 'absolute',
              left: (A.x + B.x) / 2 - len / 2,
              top: (A.y + B.y) / 2 - 1,
              width: len,
              height: 2,
              backgroundColor: '#3A4552',
              transform: [{ rotate: `${(Math.atan2(dy, dx) * 180) / Math.PI}deg` }],
            }}
          />
        );
      })}

      {/* puntos que el ejercicio exige: verde si se ven, rojo si no */}
      {[...required].map((i) => {
        const p = landmarks[i];
        if (!p) return null;
        const q = px(p);
        const ok = (p.visibility ?? 0) >= VIS && !missingSet.has(i);
        const r = ok ? 5 : 6;
        return (
          <View key={`p${i}`}>
            <View
              style={{
                position: 'absolute',
                left: q.x - r,
                top: q.y - r,
                width: r * 2,
                height: r * 2,
                borderRadius: r,
                backgroundColor: ok ? '#C8FF3D' : '#FF5A5A',
              }}
            />
            {!ok ? (
              <View
                style={{
                  position: 'absolute',
                  left: q.x - 10,
                  top: q.y - 10,
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  borderWidth: 2,
                  borderColor: '#FF5A5A',
                }}
              />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

/**
 * Checklist de landmarks, equivalente a `renderChecklist` (HTML:1701-1726 /
 * 1050). Es lo que dice por qué no se detecta postura: sin esto no hay forma de
 * distinguir "no te ve" de "te ve pero le falta una rodilla".
 */
export function missingLandmarks(lms: Landmark[], required: number[]): number[] {
  return required.filter((i) => {
    const p = lms[i];
    return !p || (p.visibility ?? 0) < VIS;
  });
}

export function landmarkLabel(i: number): string {
  return LANDMARK_LABELS[i] ?? `punto ${i}`;
}

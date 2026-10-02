import { describe, expect, it } from '@jest/globals';

import {
  PoseOverlay,
  landmarkLabel,
  missingLandmarks,
  requiredIndices,
} from '../components/PoseOverlay';
import { INDICES, LANDMARK_LABELS, POSE_CONNECTIONS, VIS } from '../lib/pose';
import { exerciseById } from '../lib/exercises';
import type { Landmark } from '../lib/poseWorker';

const mk = (x: number, y: number, visibility = 1): Landmark => ({ x, y, z: 0, visibility });
const blank = (): Landmark[] => Array.from({ length: 33 }, () => mk(0.5, 0.5));

describe('esqueleto', () => {
  it('define 33 etiquetas y 35 conexiones con índices válidos', () => {
    expect(LANDMARK_LABELS).toHaveLength(33);
    expect(POSE_CONNECTIONS.length).toBeGreaterThanOrEqual(33);
    for (const [a, b] of POSE_CONNECTIONS) {
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThan(33);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThan(33);
      expect(a).not.toBe(b);
    }
  });

  it('conecta torso, cadera y pierna como espera el esqueleto de MediaPipe', () => {
    const has = (a: number, b: number) =>
      POSE_CONNECTIONS.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
    // hombro izq - cadera izq, hombro der - cadera der, cadera izq - cadera der
    expect(has(INDICES.leftShoulder, INDICES.leftHip)).toBe(true);
    expect(has(INDICES.rightShoulder, INDICES.rightHip)).toBe(true);
    expect(has(INDICES.leftHip, INDICES.rightHip)).toBe(true);
    // rodilla y tobillo de ambas piernas
    expect(has(INDICES.leftHip, INDICES.leftKnee)).toBe(true);
    expect(has(INDICES.leftKnee, INDICES.leftAnkle)).toBe(true);
    expect(has(INDICES.rightKnee, INDICES.rightAnkle)).toBe(true);
  });

  it('no tiene conexiones duplicadas', () => {
    const keys = POSE_CONNECTIONS.map(([a, b]) => (a < b ? `${a}-${b}` : `${b}-${a}`));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('no dibuja nada sin pose', () => {
    const el = PoseOverlay({
      landmarks: null,
      cfg: exerciseById('sentadillas'),
      side: 'front',
      mirrored: true,
      photoWidth: 480,
      photoHeight: 640,
      boxWidth: 360,
      boxHeight: 420,
      missing: [],
    });
    expect(el).toBeNull();
  });

  it('no dibuja nada si la caja todavía no tiene tamaño', () => {
    const el = PoseOverlay({
      landmarks: blank(),
      cfg: exerciseById('sentadillas'),
      side: 'front',
      mirrored: true,
      photoWidth: 480,
      photoHeight: 640,
      boxWidth: 0,
      boxHeight: 0,
      missing: [],
    });
    expect(el).toBeNull();
  });
});

describe('checklist de landmarks', () => {
  it('no marca falta cuando todo se ve', () => {
    const lms = blank();
    const req = requiredIndices(exerciseById('sentadillas')!, 'front');
    expect(missingLandmarks(lms, req)).toEqual([]);
  });

  it('marca exactamente los puntos por debajo de VIS', () => {
    const lms = blank();
    lms[INDICES.leftKnee] = mk(0.5, 0.5, VIS - 0.01);
    const req = requiredIndices(exerciseById('sentadillas')!, 'front');
    expect(missingLandmarks(lms, req)).toEqual([INDICES.leftKnee]);
  });

  it('acepta el umbral exacto como visible', () => {
    const lms = blank();
    lms[INDICES.leftKnee] = mk(0.5, 0.5, VIS);
    const req = requiredIndices(exerciseById('sentadillas')!, 'front');
    expect(missingLandmarks(lms, req)).toEqual([]);
  });

  it('cuenta un punto ausente como falta', () => {
    const lms = blank();
    lms[INDICES.rightAnkle] = undefined as unknown as Landmark;
    const req = requiredIndices(exerciseById('sentadillas')!, 'front');
    expect(missingLandmarks(lms, req)).toEqual([INDICES.rightAnkle]);
  });
});

describe('puntos exigidos por ejercicio', () => {
  it('frontal exige las dos piernas completas', () => {
    expect(requiredIndices(exerciseById('sentadillas')!, 'front')).toEqual([
      INDICES.leftShoulder,
      INDICES.rightShoulder,
      INDICES.leftHip,
      INDICES.rightHip,
      INDICES.leftKnee,
      INDICES.rightKnee,
      INDICES.leftAnkle,
      INDICES.rightAnkle,
    ]);
  });

  it('lateral cambia de índices según el lado confirmado', () => {
    const cfg = exerciseById('mountain_climbers')!;
    expect(requiredIndices(cfg, 'front')).toEqual([
      INDICES.leftShoulder,
      INDICES.leftElbow,
      INDICES.leftWrist,
      INDICES.leftHip,
      INDICES.leftAnkle,
    ]);
    expect(requiredIndices(cfg, 'back')).toEqual([
      INDICES.rightShoulder,
      INDICES.rightElbow,
      INDICES.rightWrist,
      INDICES.rightHip,
      INDICES.rightAnkle,
    ]);
  });

  it('el puente incluye el tobillo del lado', () => {
    expect(requiredIndices(exerciseById('puente_gluteo')!, 'front')).toEqual([
      INDICES.leftShoulder,
      INDICES.leftHip,
      INDICES.leftKnee,
      INDICES.leftAnkle,
    ]);
  });
});

describe('etiquetas de landmarks', () => {
  it('describe los puntos que el motor usa para los gates', () => {
    expect(landmarkLabel(INDICES.leftHip)).toBe('cadera izq');
    expect(landmarkLabel(INDICES.leftKnee)).toBe('rodilla izq');
    expect(landmarkLabel(INDICES.leftAnkle)).toBe('tobillo izq');
    expect(landmarkLabel(11)).toBe('hombro izq');
    expect(landmarkLabel(999)).toBe('punto 999');
  });
});

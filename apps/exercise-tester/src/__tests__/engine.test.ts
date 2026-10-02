import { describe, expect, it } from '@jest/globals';

import { EXERCISES, exerciseById } from '../lib/exercises';
import {
  gateMessage,
  initEngine,
  postureGate,
  processFrame,
  MIN_REP_INTERVAL_MS,
  type Gate,
  type RepTelemetry,
} from '../lib/repEngine';
import {
  ASYMMETRY_MAX_DEG,
  CALIB_RANGE_MAX,
  INDICES,
  angleByNames,
  attemptCalibration,
  bilateralKnee,
  checkComplete,
  elbowAngle,
  groundedRatio,
  kneeAngle,
  kneeStandingMargin,
  lateralPoints,
  lineAngle,
  torsoHorizontalAngle,
} from '../lib/pose';
import { handLivenessOk, handStreak, livenessRequired, scheduleLiveness } from '../lib/liveness';
import { initialTiltState, isVertical, pushSample, tiltDeg } from '../lib/tilt';

const cfgSentadilla = exerciseById('sentadillas')!;
const cfgFlexion = exerciseById('flexiones')!;
const cfgAbdominal = exerciseById('abdominales')!;
const cfgPlancha = exerciseById('plancha')!;
const cfgZancadas = exerciseById('zancadas')!;
const cfgPuente = exerciseById('puente_gluteo')!;
const cfgMountain = exerciseById('mountain_climbers')!;
const cfgSentadillaIso = exerciseById('sentadilla_isometrica')!;

function okFlags() {
  return {
    sideOk: true,
    bodyOk: true,
    notGroundedTooMuch: true,
    notStanding: true,
    lineOk: true,
    verticalOk: true,
  };
}

describe('catálogo', () => {
  it('trae los 8 ejercicios de la app, en el orden de la app', () => {
    expect(EXERCISES.map((e) => e.id)).toEqual([
      'sentadillas',
      'flexiones',
      'abdominales',
      'plancha',
      'zancadas',
      'puente_gluteo',
      'mountain_climbers',
      'sentadilla_isometrica',
    ]);
  });

  it('reparte free/premium igual que catalog.ts', () => {
    expect(EXERCISES.filter((e) => e.tier === 'free').map((e) => e.id)).toEqual([
      'sentadillas',
      'flexiones',
      'abdominales',
    ]);
    expect(EXERCISES.filter((e) => e.tier === 'premium')).toHaveLength(5);
  });

  it('copia los umbrales de CFG en camera-verification.html:609-764', () => {
    expect(cfgSentadilla.downThresh).toBe(100);
    expect(cfgSentadilla.upThresh).toBe(160);
    expect(cfgFlexion.downDelta).toBe(40);
    expect(cfgFlexion.upDelta).toBe(12);
    expect(cfgAbdominal.downDelta).toBe(25);
    expect(cfgAbdominal.upDelta).toBe(10);
    expect(cfgAbdominal.standingKneeMargin).toBe(0.45);
    expect(cfgAbdominal.restTorsoMax).toBe(35);
    expect(cfgPlancha.upDelta).toBe(12);
    expect(cfgPlancha.lineMin).toBe(150);
    expect(cfgPlancha.groundedMax).toBe(0.9);
    expect(cfgZancadas.downThresh).toBe(115);
    expect(cfgZancadas.upThresh).toBe(160);
    expect(cfgPuente.downDelta).toBe(28);
    expect(cfgPuente.upDelta).toBe(10);
    expect(cfgPuente.bridge).toBe(true);
    expect(cfgPuente.restTorsoMax).toBe(38);
    expect(cfgMountain.kneeFold).toBe(105);
    expect(cfgMountain.lineMin).toBe(150);
    expect(cfgMountain.groundedMax).toBe(0.9);
    expect(cfgSentadillaIso.downThresh).toBe(100);
    expect(cfgSentadillaIso.upThresh).toBe(160);
  });

  it('copia los objetivos por defecto de catalog.ts:24-33', () => {
    expect(EXERCISES.map((e) => e.target)).toEqual([20, 10, 15, 30, 24, 15, 30, 25]);
  });

  it('declara la misma unidad que el motor productivo', () => {
    // camera-verification.html: unit en cada bloque de CFG
    expect(EXERCISES.map((e) => e.unit)).toEqual([
      'reps',
      'reps',
      'reps',
      'seconds',
      'reps',
      'reps',
      'reps',
      'seconds',
    ]);
  });

  it('asienta la discrepancia de mountain_climbers (motor reps vs catálogo seconds)', () => {
    // camera-verification.html:723 dice unit:'reps' y cuenta una rep por rodilla
    // al pecho; catalog.ts:20 dice unit:'seconds'. Va 'reps' porque el tester
    // reproduce el motor, pero el reporte tiene que avisar que no coinciden.
    expect(cfgMountain.unit).toBe('reps');
    expect(cfgMountain.catalogUnit).toBe('seconds');
    expect(EXERCISES.filter((e) => e.catalogUnit !== undefined).map((e) => e.id)).toEqual([
      'mountain_climbers',
    ]);
  });

  it('pide los mismos landmarks que sides[].points', () => {
    expect(cfgFlexion.points).toEqual(['shoulder', 'elbow', 'wrist', 'hip', 'ankle']);
    expect(cfgAbdominal.points).toEqual(['shoulder', 'hip', 'knee']);
    expect(cfgPlancha.points).toEqual(['shoulder', 'elbow', 'wrist', 'hip', 'ankle']);
    // el puente además del triángulo shoulder-hip-knee exige el tobillo
    expect(cfgPuente.points).toEqual(['shoulder', 'hip', 'knee', 'ankle']);
    expect(cfgMountain.points).toEqual(['shoulder', 'elbow', 'wrist', 'hip', 'ankle']);
  });

  it('resuelve los índices de cada lado a partir de cfg.points', () => {
    // mountain_climbers y plancha no existían en el mapa hardcodeado anterior
    expect(lateralPoints(cfgMountain, 'front')).toEqual([
      INDICES.leftShoulder,
      INDICES.leftElbow,
      INDICES.leftWrist,
      INDICES.leftHip,
      INDICES.leftAnkle,
    ]);
    expect(lateralPoints(cfgPuente, 'back')).toEqual([
      INDICES.rightShoulder,
      INDICES.rightHip,
      INDICES.rightKnee,
      INDICES.rightAnkle,
    ]);
    expect(lateralPoints(cfgPlancha, 'front')).toEqual([
      INDICES.leftShoulder,
      INDICES.leftElbow,
      INDICES.leftWrist,
      INDICES.leftHip,
      INDICES.leftAnkle,
    ]);
  });

  it('exige liveness para los 8 (target > 5 o isométrico)', () => {
    for (const cfg of EXERCISES) expect(livenessRequired(cfg)).toBe(true);
  });
});

describe('gates de postura', () => {
  it('bloquea si el celular no está vertical', () => {
    expect(postureGate(cfgFlexion, { ...okFlags(), verticalOk: false })).toBe('orientacion');
    expect(gateMessage('orientacion')).toMatch(/vertical/i);
  });

  it('exige lado confirmado en perfil lateral', () => {
    expect(postureGate(cfgFlexion, { ...okFlags(), sideOk: false })).toBe('lado');
  });

  it('bloquea si está tumbado de más (flexiones) y si se pone de pie (abdominales)', () => {
    expect(postureGate(cfgFlexion, { ...okFlags(), notGroundedTooMuch: false })).toBe('postura');
    expect(postureGate(cfgAbdominal, { ...okFlags(), notStanding: false })).toBe('de_pie');
  });

  it('no exige calibración en sentadillas (umbrales fijos)', () => {
    expect(cfgSentadilla.profile).toBe('angles');
  });
});

describe('calibración de reposo', () => {
  it('rechaza ventanas con rango mayor a 9°', () => {
    // 9 muestras en 30° y un pico a 60° → rango 30 > 9 → nunca calibra
    const spike = [...Array(9).fill(30), 60];
    const out = attemptCalibration(60, spike, cfgFlexion);
    expect(out.calib).toBeNull();

    const stable = Array.from({ length: 10 }, () => 30);
    const ok = attemptCalibration(30, stable.slice(0, 9), cfgFlexion);
    expect(ok.calib).not.toBeNull();
    // el delta se resta al reposo (codo a 30° → abajo a -10°, arriba a 18°)
    expect(ok.calib!.down).toBeCloseTo(-10, 5);
    expect(ok.calib!.up).toBeCloseTo(18, 5);
    expect(CALIB_RANGE_MAX).toBe(9);
  });

  it('suma el delta en puente de glúteos (subir la cadera es "abajo")', () => {
    const bridge = { downDelta: 28, upDelta: 10, bridge: true };
    const out = attemptCalibration(
      25,
      Array.from({ length: 9 }, () => 25),
      bridge,
    );
    expect(out.calib!.down).toBeCloseTo(53, 5);
    expect(out.calib!.up).toBeCloseTo(35, 5);
  });
});

describe('conteo de reps (frontal, sentadillas)', () => {
  // El motor suaviza el ángulo con una ventana de 5 cuadros (como el
  // prototipo), así que cada posición necesita ~6 cuadros para cruzar el
  // umbral. Las secuencias de test tienen que respetarlo.
  const run = (
    cfg: ReturnType<typeof exerciseById>,
    seq: number[],
    step: number,
    gate: Gate = 'ok',
  ): {
    reps: number;
    phase: string;
    telemetry: RepTelemetry | null;
    st: ReturnType<typeof initEngine>;
  } => {
    let st = initEngine(cfg!);
    let reps = 0;
    let phase = '';
    let telemetry: RepTelemetry | null = null;
    seq.forEach((angle, i) => {
      const out = processFrame(
        cfg!,
        st,
        {
          angle,
          bodyOk: true,
          sideOk: true,
          lineOk: true,
          notGroundedTooMuch: true,
          notStanding: true,
          calibDone: true,
          now: i * step,
          livenessActive: false,
          livenessDownThresh: cfg!.downThresh,
        },
        gate,
      );
      st = out.state;
      reps = out.result.reps;
      phase = out.result.phase;
      telemetry = out.completedRep ?? telemetry;
    });
    return { reps, phase, telemetry, st };
  };

  it('cuenta una rep cuando pasa de abajo a arriba', () => {
    const seq = [...Array(8).fill(180), ...Array(8).fill(80), ...Array(8).fill(180)];
    const { reps } = run(cfgSentadilla, seq, 200);
    expect(reps).toBe(1);
  });

  it('cuenta varias reps seguidas', () => {
    const seq = [
      ...Array(8).fill(180),
      ...Array(8).fill(80),
      ...Array(8).fill(180),
      ...Array(8).fill(80),
      ...Array(8).fill(180),
    ];
    const { reps } = run(cfgSentadilla, seq, 200);
    expect(reps).toBe(2);
  });

  it('descarta la segunda rep si llega antes de 350 ms', () => {
    const seq = [
      ...Array(8).fill(180),
      ...Array(8).fill(80),
      ...Array(8).fill(180),
      ...Array(8).fill(80),
      ...Array(8).fill(180),
    ];
    // con el suavizado de 5 cuadros, la 2ª rep se confirma ~17 cuadros después
    // de la 1ª: a 20 ms por cuadro eso da 340 ms < 350 ms → se descarta
    expect(MIN_REP_INTERVAL_MS).toBe(350);
    expect(run(cfgSentadilla, seq, 20).reps).toBe(1);
    // a 200 ms por cuadro la 2ª llega a 3.4 s → se cuenta
    expect(run(cfgSentadilla, seq, 200).reps).toBe(2);
  });

  it('una pierna atrás de la otra bloquea el conteo (asimetría)', () => {
    const cfg = cfgSentadilla;
    let st = initEngine(cfg);
    const base = {
      bodyOk: true,
      sideOk: true,
      lineOk: true,
      notGroundedTooMuch: true,
      notStanding: true,
      calibDone: true,
      livenessActive: false,
      livenessDownThresh: 100,
    };
    // una rodilla a 80° y la otra a 170° → diferencia 90° > 35°
    for (let i = 0; i < 8; i++) {
      const out = processFrame(
        cfg,
        st,
        { ...base, angle: 80, secondAngle: 170, now: i * 200 },
        'ok',
      );
      st = out.state;
      expect(out.result.gate).toBe('asimetria');
    }
    expect(st.reps).toBe(0);
  });

  it('deja la fase en arriba y expone la telemetría de la rep', () => {
    const seq = [...Array(8).fill(180), ...Array(8).fill(80), ...Array(8).fill(180)];
    const { phase, telemetry } = run(cfgSentadilla, seq, 200);
    expect(phase).toBe('arriba');
    expect(telemetry).not.toBeNull();
    expect(telemetry!.amplitude).toBeGreaterThan(0);
    expect(telemetry!.durationMs).toBeGreaterThan(0);
  });

  it('resetea el conteo cuando la postura se rompe', () => {
    let st = initEngine(cfgSentadilla);
    const base = {
      bodyOk: true,
      sideOk: true,
      lineOk: true,
      notGroundedTooMuch: true,
      notStanding: true,
      calibDone: true,
      livenessActive: false,
      livenessDownThresh: 100,
    };
    for (const angle of Array(8).fill(80))
      st = processFrame(cfgSentadilla, st, { ...base, angle, now: 0 }, 'ok').state;
    const broken = processFrame(cfgSentadilla, st, { ...base, angle: 80, now: 999 }, 'postura');
    expect(broken.result.reps).toBe(0);
    expect(broken.result.repCountInitialized).toBe(false);
    expect(broken.result.holdMs).toBe(0);
    expect(broken.result.gate).toBe('postura');
  });
});

describe('conteo de segundos (isométrico)', () => {
  /**
   * Calibra como hace TestScreen.tsx: acumula 10 muestras estables con
   * attemptCalibration y escribe restAngle/down/up en el estado del motor.
   */
  function calibrate(cfg: ReturnType<typeof exerciseById>, restAngle: number) {
    let buf: number[] = [];
    let calib: ReturnType<typeof attemptCalibration>['calib'] = null;
    for (let i = 0; i < 12; i++) {
      const out = attemptCalibration(restAngle, buf, cfg!);
      buf = out.buf;
      if (out.calib) calib = out.calib;
    }
    const st = initEngine(cfg!);
    return calib ? { ...st, restAngle: calib.restAngle, down: calib.down, up: calib.up } : st;
  }

  it('acumula holdMs mientras está abajo', () => {
    const cfg = { ...cfgSentadilla, kind: 'isometrico' as const, target: 5 };
    let st = initEngine(cfg);
    for (let i = 0; i < 8; i++) {
      st = processFrame(
        cfg,
        st,
        {
          angle: 90,
          bodyOk: true,
          sideOk: true,
          lineOk: true,
          notGroundedTooMuch: true,
          notStanding: true,
          calibDone: true,
          now: i * 200,
          livenessActive: false,
          livenessDownThresh: 100,
        },
        'ok',
      ).state;
    }
    expect(st.holdMs).toBeGreaterThan(0);
    expect(st.reps).toBe(0);
  });

  it('la sentadilla isométrica cuenta segundos mientras la rodilla está bajo 100°', () => {
    // camera-verification.html:1450 — el hold frontal es `cand === 'down'`, o
    // sea AMBAS rodillas por debajo de downThresh (100°). De pie no cuenta.
    let st = calibrate(cfgSentadillaIso, 180);
    expect(st.restAngle).toBeCloseTo(180, 0);

    const base = {
      bodyOk: true,
      sideOk: true,
      lineOk: true,
      notGroundedTooMuch: true,
      notStanding: true,
      calibDone: true,
      livenessActive: false,
      livenessDownThresh: 100,
    };

    // de pie (180°) no acumula nada
    for (let i = 0; i < 10; i++) {
      st = processFrame(cfgSentadillaIso, st, { ...base, angle: 180, now: i * 200 }, 'ok').state;
    }
    expect(st.holdMs).toBe(0);

    // 10 s en sentadilla sostenida (90°) → acumula el tiempo, 0 reps
    for (let i = 0; i < 50; i++) {
      st = processFrame(
        cfgSentadillaIso,
        st,
        { ...base, angle: 90, secondAngle: 90, now: 2000 + i * 200 },
        'ok',
      ).state;
    }
    expect(st.holdMs).toBeGreaterThanOrEqual(9000);
    expect(st.reps).toBe(0);

    // al volver a parar, el cronómetro se frena
    const antes = st.holdMs;
    for (let i = 0; i < 10; i++) {
      st = processFrame(
        cfgSentadillaIso,
        st,
        { ...base, angle: 180, secondAngle: 180, now: 12000 + i * 200 },
        'ok',
      ).state;
    }
    expect(st.holdMs).toBe(antes);
  });

  it('la plancha cuenta segundos con los brazos extendidos (ángulo sobre el tope)', () => {
    // camera-verification.html:1669 — el hold lateral es `smoothed >
    // dynamicUpThresh`. En plancha el codo extends ~180° y upDelta 0 deja el
    // tope en la calibración, así que mantener los brazos cuenta.
    let st = calibrate(cfgPlancha, 180);
    expect(st.restAngle).toBeCloseTo(180, 0);

    const base = {
      bodyOk: true,
      sideOk: true,
      lineOk: true,
      notGroundedTooMuch: true,
      notStanding: true,
      calibDone: true,
      livenessActive: false,
      livenessDownThresh: 180,
    };
    for (let i = 0; i < 30; i++) {
      st = processFrame(cfgPlancha, st, { ...base, angle: 180, now: i * 200 }, 'ok').state;
    }
    expect(st.holdMs).toBeGreaterThanOrEqual(5000);
    expect(st.reps).toBe(0);

    // doblar los brazos (codo < tope) frena el conteo
    const antes = st.holdMs;
    for (let i = 0; i < 10; i++) {
      st = processFrame(cfgPlancha, st, { ...base, angle: 90, now: 6000 + i * 200 }, 'ok').state;
    }
    expect(st.holdMs).toBe(antes);
  });

  it('un isométrico no cuenta antes de calibrar', () => {
    let st = initEngine(cfgPlancha);
    const out = processFrame(
      cfgPlancha,
      st,
      {
        angle: 180,
        bodyOk: true,
        sideOk: true,
        lineOk: true,
        notGroundedTooMuch: true,
        notStanding: true,
        calibDone: false,
        now: 0,
        livenessActive: false,
        livenessDownThresh: 180,
      },
      'ok',
    );
    expect(out.result.gate).toBe('calibrando');
    expect(out.result.holdMs).toBe(0);
    expect(out.state.restAngle).toBeNull();
  });
});

describe('mountain climbers (pliegue de rodilla)', () => {
  // camera-verification.html:1591-1618 — no usa transiciones abajo/arriba ni
  // umbral calibrado: cuenta 1 rep por cada rodilla que baja de 105°. El
  // ángulo se suaviza con ventana 5, no 7.
  const run = (seq: number[], step = 400) => {
    // calibración: 12 muestras estables en plancha (deltas 0/0)
    let buf: number[] = [];
    let calib: ReturnType<typeof attemptCalibration>['calib'] = null;
    for (let i = 0; i < 12; i++) {
      const out = attemptCalibration(170, buf, cfgMountain);
      buf = out.buf;
      if (out.calib) calib = out.calib;
    }
    let st = initEngine(cfgMountain);
    if (calib) st = { ...st, restAngle: calib.restAngle, down: calib.down, up: calib.up };

    const base = {
      bodyOk: true,
      sideOk: true,
      lineOk: true,
      notGroundedTooMuch: true,
      notStanding: true,
      calibDone: true,
      livenessActive: false,
      livenessDownThresh: 105,
    };
    let t = 0;
    seq.forEach((angle) => {
      st = processFrame(cfgMountain, st, { ...base, angle, now: t }, 'ok').state;
      t += step;
    });
    return st;
  };

  /** Meseta de N cuadros en un ángulo (el modelo tiene que sostener la postura). */
  const plateau = (angle: number, n = 5) => Array(n).fill(angle);

  it('cuenta una rep por cada rodilla al pecho', () => {
    // extendida → al pecho → extendida → al pecho → extendida.
    // Con ventana 5 hacen falta ~4 cuadros por meseta para que el suavizado
    // cruce 105° en los dos sentidos.
    const seq = [...plateau(170), ...plateau(80), ...plateau(170), ...plateau(80), ...plateau(170)];
    expect(run(seq).reps).toBe(2);
  });

  it('no cuenta si la rodilla nunca baja de 105°', () => {
    expect(run([...plateau(170), ...plateau(160), ...plateau(150), ...plateau(170)]).reps).toBe(0);
  });

  it('no acumula segundos aunque el catálogo diga seconds', () => {
    const st = run(plateau(80, 10));
    expect(st.holdMs).toBe(0);
    expect(st.reps).toBe(0);
  });

  it('exige dos mesetas alternadas por cada rep, no una por cuadro', () => {
    // una sola meseta larga alternada cuenta 1, no varias
    expect(run([...plateau(170), ...plateau(80, 10), ...plateau(170, 10)]).reps).toBe(1);
  });

  it('exige calibración antes de contar', () => {
    const out = processFrame(
      cfgMountain,
      initEngine(cfgMountain),
      {
        angle: 80,
        bodyOk: true,
        sideOk: true,
        lineOk: true,
        notGroundedTooMuch: true,
        notStanding: true,
        calibDone: false,
        now: 0,
        livenessActive: false,
        livenessDownThresh: 105,
      },
      'ok',
    );
    expect(out.result.gate).toBe('calibrando');
    expect(out.result.reps).toBe(0);
  });
});

describe('prueba de vida', () => {
  it('se exige con objetivo > 5 o ejercicio isométrico', () => {
    expect(livenessRequired(cfgSentadilla)).toBe(true); // target 20
    expect(livenessRequired(cfgFlexion)).toBe(true); // target 10
    expect(livenessRequired({ ...cfgFlexion, target: 3 })).toBe(false);
  });

  it('se agenda una sola vez entre 4 y 13 s', () => {
    const s0 = { scheduledAt: null, passed: false };
    const s1 = scheduleLiveness(s0, 0);
    expect(s1.scheduledAt).toBeGreaterThanOrEqual(4000);
    expect(s1.scheduledAt).toBeLessThanOrEqual(13000);
    const s2 = scheduleLiveness(s1, 100);
    expect(s2.scheduledAt).toBe(s1.scheduledAt);
  });

  it('confirma mano con 5 cuadros de muñeca sobre el hombro', () => {
    // hombro en y=0.6: la muñeca tiene que subir 5% por encima (y < 0.55)
    const shoulder = { x: 0.5, y: 0.6, visibility: 1 };
    const wristUp = { x: 0.5, y: 0.4, visibility: 1 };
    const wristLow = { x: 0.5, y: 0.58, visibility: 1 };
    const wristDown = { x: 0.5, y: 0.8, visibility: 1 };
    const base = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.9 }));
    base[11] = shoulder;
    base[12] = shoulder;

    const down = [...base];
    down[15] = wristDown;
    down[16] = wristDown;
    expect(handStreak(0, true, down)).toBe(0);

    // justo por debajo del margen de 5% → todavía no cuenta
    const low = [...base];
    low[15] = wristLow;
    low[16] = wristLow;
    expect(handStreak(0, true, low)).toBe(0);

    const up = [...base];
    up[15] = wristUp;
    up[16] = wristUp;
    let streak = 0;
    for (let i = 0; i < 5; i++) streak = handStreak(streak, true, up);
    expect(streak).toBe(5);
    expect(handLivenessOk(up, streak)).toBe(true);
  });

  it('el hold necesita 2 s abajo', () => {
    const cfg = cfgFlexion;
    let st = initEngine(cfg);
    const base = {
      bodyOk: true,
      sideOk: true,
      lineOk: true,
      notGroundedTooMuch: true,
      notStanding: true,
      calibDone: true,
      livenessActive: true,
      livenessDownThresh: 70,
    };
    // "abajo" es ángulo menor al umbral (como en producción). 25 cuadros de 100 ms
    // = 2.5 s, supera los 2 s exigidos.
    for (let i = 0; i < 25; i++) {
      st = processFrame(cfg, st, { ...base, angle: 50, now: i * 100 }, 'ok').state;
    }
    expect(st.livenessOk).toBe(true);
  });
});

describe('inclinación (vertical)', () => {
  it('detecta vertical con la fórmula de producción', () => {
    expect(tiltDeg({ x: 0, y: 1, z: 0 })).toBe(0);
    expect(isVertical({ x: 0, y: 1, z: 0.2 })).toBe(true);
    expect(isVertical({ x: 0, y: 0.2, z: 1 })).toBe(false); // tumbo
    expect(isVertical({ x: 0, y: 0, z: 0 })).toBe(false); // vector inválido
  });

  it('confirma tras 8 s continuos en vertical y se cae si sale', () => {
    let st = initialTiltState();
    const v = { x: 0, y: 1, z: 0 };
    for (let i = 0; i < 39; i++) st = pushSample(st, v, i * 200);
    expect(st.confirmed).toBe(false);
    st = pushSample(st, v, 8000);
    expect(st.confirmed).toBe(true);

    let st2 = initialTiltState();
    st2 = pushSample(st2, { x: 0, y: 0.2, z: 1 }, 0);
    st2 = pushSample(st2, { x: 0, y: 0.2, z: 1 }, 200);
    expect(st2.samples).toHaveLength(0);
  });
});

describe('geometría de pose', () => {
  const mk = (x: number, y: number, visibility = 1) => ({ x, y, visibility });
  const blank = () => Array.from({ length: 33 }, () => mk(0.5, 0.5));

  it('el ángulo de rodilla parado es ~180° y flexionando baja de 100°', () => {
    const lm = blank();
    // parado: cadera arriba, rodilla al medio, tobillo abajo → 180°
    lm[23] = mk(0.5, 0.35);
    lm[25] = mk(0.5, 0.6);
    lm[27] = mk(0.5, 0.85);
    expect(kneeAngle(lm, 23, 25, 27)).toBeCloseTo(180, 0);

    // agachado: la rodilla se va para adelante y el ángulo cierra
    lm[25] = mk(0.8, 0.6);
    const bent = kneeAngle(lm, 23, 25, 27);
    expect(bent).toBeLessThan(100);
  });

  it('el ángulo de codo mide la flexión del brazo', () => {
    const lm = blank();
    // brazo recto hacia abajo: hombro-codo-muñeca en línea → 180°
    lm[11] = mk(0.5, 0.3);
    lm[13] = mk(0.5, 0.5);
    lm[15] = mk(0.5, 0.7);
    expect(elbowAngle(lm, 11, 13, 15)).toBeCloseTo(180, 0);

    // flexión 90°: muñeca atrás y al mismo nivel del codo
    lm[15] = mk(0.3, 0.5);
    expect(elbowAngle(lm, 11, 13, 15)).toBeCloseTo(90, 0);
  });

  it('bilateralKnee exige las dos rodillas y marca asimetría', () => {
    const lm = blank();
    for (const [hip, knee, ankle] of [
      [23, 25, 27],
      [24, 26, 28],
    ] as const) {
      lm[hip] = mk(0.5, 0.35);
      lm[knee] = mk(0.5, 0.6);
      lm[ankle] = mk(0.5, 0.85);
    }
    const sim = bilateralKnee(lm);
    expect(sim.asymmetric).toBe(false);
    expect(sim.diff).toBeCloseTo(0, 0);
    // parado: ambas rodillas extendidas → "arriba" (min) > 160
    expect(sim.bothUp!).toBeGreaterThan(160);

    // una rodilla flexionada y la otra no → asimetría > 35°
    lm[26] = mk(0.8, 0.6);
    const asym = bilateralKnee(lm);
    expect(asym.asymmetric).toBe(true);
    expect(ASYMMETRY_MAX_DEG).toBe(35);
  });

  it('línea hombro-cadera-tobillo ≈ 180° cuando está alineado', () => {
    const lm = Array.from({ length: 33 }, () => mk(0.5, 0.5));
    lm[11] = mk(0.5, 0.2);
    lm[23] = mk(0.5, 0.5);
    lm[27] = mk(0.5, 0.9);
    expect(lineAngle(lm, 11, 23, 27)).toBeCloseTo(180, 1);
  });

  it('groundedRatio marca tumbado', () => {
    const lm = Array.from({ length: 33 }, () => mk(0.5, 0.5));
    lm[11] = mk(0.5, 0.5);
    lm[23] = mk(0.5, 0.55);
    lm[27] = mk(0.5, 0.6);
    // (0.05) / torso 0.05 = 1.0 > 0.9 → tumbado
    expect(groundedRatio(lm, 23, 27)).toBeGreaterThan(0.9);
  });

  it('kneeStandingMargin detecta ponerse de pie', () => {
    const lm = Array.from({ length: 33 }, () => mk(0.5, 0.5));
    lm[11] = mk(0.5, 0.3);
    lm[23] = mk(0.5, 0.5);
    lm[25] = mk(0.5, 0.9); // rodilla debajo de la cadera → parado
    expect(kneeStandingMargin(lm, 23, 25)).toBeGreaterThan(0.45);
  });

  it('torsoHorizontalAngle marca acostado', () => {
    const lm = Array.from({ length: 33 }, () => mk(0.5, 0.5));
    lm[11] = mk(0.9, 0.5); // hombro a la derecha, misma altura → torso horizontal
    lm[23] = mk(0.5, 0.5);
    expect(torsoHorizontalAngle(lm, 11, 23)).toBeCloseTo(0, 1);
  });

  it('angleByNames calcula el triángulo genérico por nombre', () => {
    const lm = blank();
    lm[11] = mk(0.5, 0.3); // shoulder
    lm[13] = mk(0.5, 0.5); // elbow
    lm[15] = mk(0.5, 0.7); // wrist
    expect(angleByNames(lm, ['shoulder', 'elbow', 'wrist'], 'front')).toBeCloseTo(180, 0);
    lm[15] = mk(0.3, 0.5);
    expect(angleByNames(lm, ['shoulder', 'elbow', 'wrist'], 'front')).toBeCloseTo(90, 0);
  });

  it('checkComplete respeta todos los puntos pedidos', () => {
    const lm = blank();
    const needed = lateralPoints(cfgMountain, 'front');
    expect(checkComplete(lm, needed)).toBe(true);
    lm[INDICES.leftWrist] = mk(0.5, 0.5, 0.5);
    expect(checkComplete(lm, needed)).toBe(false);
  });
});

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
  attemptCalibration,
  bilateralKnee,
  elbowAngle,
  groundedRatio,
  kneeAngle,
  kneeStandingMargin,
  lineAngle,
  torsoHorizontalAngle,
} from '../lib/pose';
import { handLivenessOk, handStreak, livenessRequired, scheduleLiveness } from '../lib/liveness';
import { initialTiltState, isVertical, pushSample, tiltDeg } from '../lib/tilt';

const cfgSentadilla = exerciseById('sentadillas')!;
const cfgFlexion = exerciseById('flexiones')!;
const cfgAbdominal = exerciseById('abdominales')!;

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
  it('trae los 3 ejercicios libres con los umbrales de producción', () => {
    expect(EXERCISES.map((e) => e.id)).toEqual(['sentadillas', 'flexiones', 'abdominales']);
    expect(cfgSentadilla.downThresh).toBe(100);
    expect(cfgSentadilla.upThresh).toBe(160);
    expect(cfgFlexion.downDelta).toBe(40);
    expect(cfgFlexion.upDelta).toBe(12);
    expect(cfgAbdominal.downDelta).toBe(25);
    expect(cfgAbdominal.standingKneeMargin).toBe(0.45);
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
});

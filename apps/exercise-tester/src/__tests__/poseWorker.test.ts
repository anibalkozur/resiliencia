// El banco de pruebas tiene que seguir la pose como camera-verification.html.
// Estos tests fijan el contrato de carga e inferencia del WebView: son
// justamente los puntos que, cuando difieren, dejan la pantalla en "cargando
// modelo…" sin dar ningún error visible.
//
// El bug que motivó este archivo: se llamaba a
// `PoseLandmarker.createFromOptions(vision, ...)` sin haber resuelto nunca
// `vision` (faltaba `FilesetResolver.forVisionTasks`), y se usaba
// `runningMode: 'IMAGE'` con fotos en vez del stream de video.

import { describe, expect, it } from '@jest/globals';

import { POSE_BRIDGE_BASE_URL, POSE_VIEW_HTML } from '../lib/poseWorker';

const html = POSE_VIEW_HTML;

describe('carga del modelo (copia de camera-verification.html)', () => {
  it('resuelve el WASM antes de crear el PoseLandmarker', () => {
    // HTML:1810-1814. Sin esto `vision` es undefined y la creación falla.
    expect(html).toContain('FilesetResolver.forVisionTasks(WASM_URL)');
    const resolver = html.indexOf('FilesetResolver.forVisionTasks');
    const create = html.indexOf('PoseLandmarker.createFromOptions');
    expect(resolver).toBeGreaterThan(-1);
    expect(create).toBeGreaterThan(resolver);
  });

  it('usa la misma URL de WASM que producción', () => {
    expect(html).toContain(
      "WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@' + VERSION + '/wasm'",
    );
    expect(html).toContain("const VERSION = '0.10.14';");
  });

  it('usa la misma URL de modelo que producción, con /latest/', () => {
    expect(html).toContain('pose_landmarker_lite/float16/latest/pose_landmarker_lite.task');
    expect(html).not.toContain('pose_landmarker_lite/float16/1/');
  });

  it('corre en VIDEO y no en IMAGE', () => {
    expect(html).toContain("runningMode: 'VIDEO'");
    expect(html).not.toContain("runningMode: 'IMAGE'");
    expect(html).not.toContain('takePictureAsync');
  });

  it('infiere con detectForVideo sobre el <video>, deduplicando por currentTime', () => {
    expect(html).toContain('detectForVideo(video, now)');
    expect(html).toContain('video.currentTime !== lastTime');
    expect(html).toContain('requestAnimationFrame(loop)');
  });

  it('pide la cámara con getUserMedia y la reproduce', () => {
    expect(html).toContain('navigator.mediaDevices.getUserMedia');
    expect(html).toContain('video.srcObject = stream');
    expect(html).toContain('await video.play()');
    expect(html).toContain('facingMode: currentFacing');
  });

  it('reintenta con CPU si GPU no está disponible, con el mismo timeout', () => {
    expect(html).toContain("make('GPU')");
    expect(html).toContain("make('CPU')");
    expect(html).toContain('const MODEL_LOAD_MS = 20000;');
    expect(html).toContain('numPoses: 1');
  });

  it('reporta los errores en vez de fallar en silencio', () => {
    expect(html).toContain("window.onerror = (m, s, l) => post({ type: 'fatal'");
    expect(html).toContain("type: 'fatal', error: 'cámara: '");
    expect(html).toContain("type: 'fatal', error: 'detect: '");
  });

  it('el origen del WebView permite el CDN y el WASM', () => {
    expect(POSE_BRIDGE_BASE_URL).toBe('https://cdn.jsdelivr.net');
  });
});

describe('dibujo del esqueleto (copia de HTML:1699-1731)', () => {
  it('dibuja las conexiones con DrawingUtils sobre el canvas', () => {
    expect(html).toContain('du.drawConnectors(lm, PoseLandmarker.POSE_CONNECTIONS');
    expect(html).toContain("color: '#3A4552'");
    expect(html).toContain('lineWidth: 2');
  });

  it('pinta los puntos exigidos con el mismo criterio de visibilidad', () => {
    expect(html).toContain('const VIS = 0.65;');
    expect(html).toContain('(p.visibility ?? 0) >= VIS');
    expect(html).toContain("ctx.fillStyle = ok ? '#C8FF3D' : '#FF5A5A';");
    expect(html).toContain('ok ? 5 : 6');
  });

  it('el canvas tiene el tamaño real del video', () => {
    expect(html).toContain('canvas.width = video.videoWidth || 480;');
    expect(html).toContain('canvas.height = video.videoHeight || 640;');
  });

  it('espeja video y canvas juntos en cámara frontal', () => {
    expect(html).toContain("const mirror = currentFacing === 'user';");
    expect(html).toContain("video.classList.toggle('no-mirror', !mirror);");
    expect(html).toContain("canvas.classList.toggle('no-mirror', !mirror);");
  });
});

describe('checklist de landmarks (copia de HTML:878-894)', () => {
  it('lista cada punto exigido con su estado', () => {
    expect(html).toContain('function renderChecklist(title, pts, missing)');
    expect(html).toContain("(pts.length - missing.length) + '/' + pts.length");
    expect(html).toContain('LABEL_BY_IDX[k] || k');
  });

  it('marca como faltante lo que no supera VIS', () => {
    expect(html).toContain('if (!p || (p.visibility ?? 0) < VIS) missing.push(k);');
  });
});

describe('puente de orientación (copia de HTML:1896-1904)', () => {
  it('expone el hook que la app nativa inyecta con expo-sensors', () => {
    expect(html).toContain('window.__resilienciaSetNativeOrientation = function (sample)');
    expect(html).toContain('typeof sample.vertical');
  });

  it('avisa que necesita sensor cuando corre dentro de React Native', () => {
    expect(html).toContain('const runningInsideReactNative = Boolean(window.ReactNativeWebView);');
    expect(html).toContain("post({ type: 'sensor_request' })");
  });
});

describe('layout de la cámara (copia de HTML:28-92)', () => {
  it('el alto de la cámara no depende de html/body height:100%', () => {
    // Este fue el bug que dejó la cámara invisible: `#stage` con
    // `position:absolute; inset:0` colapsa a 0 cuando body height:100% no
    // resuelve dentro del WebView. Producción usa un wrapper estático.
    // El `height: 100%` que sí debe existir es el de video/canvas respecto del
    // wrapper (HTML:81), no el del body.
    expect(html).not.toMatch(/body\s*\{[^}]*height:\s*100%/);
    expect(html).not.toContain('position: absolute; inset: 0;');
  });

  it('usa un wrapper estático con aspect-ratio 3/4', () => {
    expect(html).toContain('class="video-wrap"');
    expect(html).toContain('position: relative;');
    expect(html).toContain('aspect-ratio: 3/4;');
    expect(html).toContain('overflow: hidden;');
  });

  it('video y canvas se superponen al wrapper, como en producción', () => {
    expect(html).toContain('video, canvas {');
    expect(html).toContain('position: absolute;');
    expect(html).toContain('object-fit: cover;');
  });

  it('el espejo está por defecto en el CSS y se quita con .no-mirror', () => {
    // camera-verification.html:84-92: el scaleX(-1) está en la regla base.
    expect(html).toContain('video { transform: scaleX(-1); }');
    expect(html).toContain('canvas { transform: scaleX(-1); }');
    expect(html).toContain('.no-mirror { transform: none; }');
  });
});

describe('superficie que consume la app nativa', () => {
  it('expone las funciones que TestScreen inyecta', () => {
    expect(html).toContain('window.__start = startCamera;');
    expect(html).toContain('window.__stop = stopCamera;');
    expect(html).toContain('window.__facing = function (f)');
    expect(html).toContain('window.__setHighlight = function (title, pts)');
    expect(html).toContain('window.__snap = function ()');
  });

  it('emite los landmarks planos que el motor de conteo espera', () => {
    expect(html).toContain("post({ type: 'pose', t: Date.now(), flat: flat })");
    // x, y, z, visibility por landmark
    expect(html).toContain(
      'flat.push(p.x, p.y, p.z, p.visibility === undefined ? 1 : p.visibility);',
    );
  });

  it('libera la cámara al detener', () => {
    expect(html).toContain('old.getTracks().forEach(function (t) { t.stop(); });');
  });

  it('no tiene sintaxis rota por backticks dentro del template', () => {
    // El HTML va embebido en un template literal de TS: cualquier backtick sin
    // escapar corta la cadena y rompe el bundle entero.
    expect(html).not.toContain('`');
    expect(html.trimEnd().endsWith('</html>')).toBe(true);
  });
});

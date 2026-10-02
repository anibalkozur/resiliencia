// Puente de pose del banco de pruebas.
//
// Esto es una copia de la ejecución de camera-verification.html, no una
// variante: mismo <video> + getUserMedia, mismo PoseLandmarker en runningMode
// 'VIDEO', mismo detectForVideo, mismo canvas con DrawingUtils, mismo checklist
// y mismo puente de orientación __resilienciaSetNativeOrientation.
//
// Lo que hace la app nativa es inyectar la configuración del ejercicio (los
// puntos a resaltar y el lado confirmado) y consumir los landmarks que llegan
// por el puente para correr el motor de conteo, que vive en TypeScript para
// poder testearlo.
//
// Por qué NO se usan fotos: `takePictureAsync` en bucle + `runningMode: 'IMAGE'`
// no es lo que hace producción. VIDEO con timestamps crecientes del stream es lo
// que aprovecha el tracking de MediaPipe; con snapshots_fixed el modelo pierde
// la continuidad entre cuadros y además se degradaba a ~1.4 cuadros por segundo.

export type Landmark = { x: number; y: number; z: number; visibility: number };

const VERSION = '0.10.14';

/**
 * El HTML del puente. Es a la vez la vista de cámara y el motor de MediaPipe.
 * Las líneas entre comentarios copian camera-verification.html.
 */
export const POSE_VIEW_HTML = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no" />
    <script src="https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/vision_bundle.js" crossorigin="anonymous"></script>
    <style>
      * { box-sizing: border-box; }
      html, body { margin: 0; height: 100%; background: #000; overflow: hidden;
        font-family: -apple-system, Roboto, sans-serif; }
      #stage { position: absolute; inset: 0; }
      video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
      canvas { position: absolute; inset: 0; width: 100%; height: 100%; }
      .no-mirror { transform: scaleX(-1); }
      #checklist { position: absolute; left: 8px; bottom: 8px; display: none;
        background: rgba(3,4,5,.72); border-radius: 8px; padding: 7px 8px; }
      #clTitle { color: #EAF2FF; font-size: 11px; font-weight: 700; }
      #clRows { margin-top: 4px; }
      .cl-row { display: flex; align-items: center; gap: 5px; color: #FF5A5A;
        font-size: 10px; line-height: 14px; }
      .cl-row.ok { color: #39D98A; }
      .cl-dot { width: 6px; height: 6px; border-radius: 50%; background: #FF5A5A; }
      .cl-row.ok .cl-dot { background: #39D98A; }
    </style>
  </head>
  <body>
    <div id="stage">
      <video id="video" playsinline autoplay muted></video>
      <canvas id="canvas"></canvas>
      <div id="checklist"><div id="clTitle"></div><div id="clRows"></div></div>
    </div>
    <script>
      const VERSION = '${VERSION}';
      // camera-verification.html:1793-1795
      const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@' + VERSION + '/wasm';
      const MODEL_URL =
        'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task';
      // camera-verification.html:779-782, :1796
      const VIS = 0.65;
      const MODEL_LOAD_MS = 20000;
      // camera-verification.html:563-589
      const LID = {
        nose: 0, left_eye: 2, right_eye: 5,
        left_shoulder: 11, right_shoulder: 12,
        left_elbow: 13, right_elbow: 14,
        left_wrist: 15, right_wrist: 16,
        left_pinky: 17, right_pinky: 18,
        left_index: 19, right_index: 20,
        left_thumb: 21, right_thumb: 22,
        left_hip: 23, right_hip: 24,
        left_knee: 25, right_knee: 26,
        left_ankle: 27, right_ankle: 28,
        left_heel: 29, right_heel: 30,
        left_foot: 31, right_foot: 32,
      };
      // camera-verification.html:590-604
      const LABEL = {
        nose: 'Cabeza',
        left_shoulder: 'Hombro I', right_shoulder: 'Hombro D',
        left_elbow: 'Codo I', right_elbow: 'Codo D',
        left_wrist: 'Muñeca I', right_wrist: 'Muñeca D',
        left_hip: 'Cadera I', right_hip: 'Cadera D',
        left_knee: 'Rodilla I', right_knee: 'Rodilla D',
        left_ankle: 'Tobillo I', right_ankle: 'Tobillo D',
      };
      // La app nativa manda índices (los mismos que usa el motor de conteo), así
      // que el checklist traduce índice -> etiqueta para mostrar el texto.
      const LABEL_BY_IDX = {};
      for (const k in LID) { if (LABEL[k]) LABEL_BY_IDX[LID[k]] = LABEL[k]; }
      // camera-verification.html:769-778
      const FRONTAL_POINTS = ['left_shoulder','right_shoulder','left_hip','right_hip',
        'left_knee','right_knee','left_ankle','right_ankle'];

      const video = document.getElementById('video');
      const canvas = document.getElementById('canvas');
      const ctx = canvas.getContext('2d');
      const checklistHud = document.getElementById('checklist');
      const clTitle = document.getElementById('clTitle');
      const clRows = document.getElementById('clRows');
      const runningInsideReactNative = Boolean(window.ReactNativeWebView);

      let poseLandmarker = null;
      let running = false;
      let lastTime = -1;
      let currentFacing = 'user';
      // Los highlight los inyecta la app nativa como índices de landmark: en
      // producción salen de FRONTAL_POINTS o de cfg.sides[confirmedSide].points
      // (HTML:1705-1706).
      let hlTitle = 'Cuerpo';
      let hlPts = FRONTAL_POINTS.map(function (k) { return LID[k]; });

      const post = (p) => {
        if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(p));
      };
      const log = (t) => post({ type: 'log', text: t });
      const stage = (s) => post({ type: 'stage', stage: s });

      // Todo error no capturado se reenvía: si el script del CDN no carga o el
      // WASM falla, el ReferenceError aparecía solo en la consola del WebView y
      // la app quedaba esperando en silencio.
      window.onerror = (m, s, l) => post({ type: 'fatal', error: 'js: ' + m + ' @' + l });
      window.addEventListener('unhandledrejection', (e) =>
        post({ type: 'fatal', error: 'promise: ' + String((e.reason && e.reason.message) || e.reason) }));

      // camera-verification.html:1778-1792
      function withTimeout(promise, ms, label) {
        return new Promise((resolve, reject) => {
          const t = setTimeout(() => reject(new Error(label + ' (demoró ' + ms + 'ms)')), ms);
          promise.then(
            (v) => { clearTimeout(t); resolve(v); },
            (e) => { clearTimeout(t); reject(e); },
          );
        });
      }

      function waitForVision(triesLeft) {
        if (window.FilesetResolver && window.PoseLandmarker) return Promise.resolve();
        if (triesLeft <= 0) return Promise.reject(new Error('vision_bundle.js no cargó (CDN sin respuesta?)'));
        return new Promise((res) => setTimeout(res, 400)).then(() => waitForVision(triesLeft - 1));
      }

      // camera-verification.html:1798-1805
      async function attemptCreate(label, make) {
        try {
          return await withTimeout(make('GPU'), MODEL_LOAD_MS, label + ' GPU');
        } catch (e) {
          log(label + ' GPU no disponible (' + e.message + '). Reintentando con CPU…');
          return await withTimeout(make('CPU'), MODEL_LOAD_MS, label + ' CPU');
        }
      }

      // camera-verification.html:1807-1826
      async function initModel() {
        try {
          stage('wasm');
          // ESTA llamada es la que faltaba en el banco anterior: sin
          // FilesetResolver no existe "vision" y createFromOptions falla.
          const vision = await withTimeout(
            FilesetResolver.forVisionTasks(WASM_URL),
            MODEL_LOAD_MS,
            'modelo',
          );
          stage('modelo');
          poseLandmarker = await attemptCreate('pose', (delegate) =>
            PoseLandmarker.createFromOptions(vision, {
              baseOptions: { modelAssetPath: MODEL_URL, delegate },
              runningMode: 'VIDEO',
              numPoses: 1,
            }),
          );
          log('Modelo de pose cargado');
          post({
            type: 'ready',
            backend: poseLandmarker.getBackend ? poseLandmarker.getBackend() : 'unknown',
          });
        } catch (e) {
          throw new Error('El modelo no cargó (' + e.message + ')');
        }
      }

      // camera-verification.html:1699-1731
      function draw(result) {
        ctx.save();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (result.landmarks && result.landmarks.length) {
          const du = new DrawingUtils(ctx);
          for (const lm of result.landmarks) {
            du.drawConnectors(lm, PoseLandmarker.POSE_CONNECTIONS, {
              color: '#3A4552',
              lineWidth: 2,
            });
            for (const k of hlPts) {
              const p = lm[k];
              if (!p) continue;
              const ok = (p.visibility ?? 0) >= VIS;
              ctx.beginPath();
              ctx.arc(p.x * canvas.width, p.y * canvas.height, ok ? 5 : 6, 0, 2 * Math.PI);
              ctx.fillStyle = ok ? '#C8FF3D' : '#FF5A5A';
              ctx.fill();
              if (!ok) {
                ctx.lineWidth = 2;
                ctx.strokeStyle = '#FF5A5A';
                ctx.beginPath();
                ctx.arc(p.x * canvas.width, p.y * canvas.height, 10, 0, 2 * Math.PI);
                ctx.stroke();
              }
            }
          }
        }
        ctx.restore();
      }

      // camera-verification.html:878-894
      function renderChecklist(title, pts, missing) {
        checklistHud.style.display = 'block';
        clTitle.innerHTML =
          title + ' <span>' + (pts.length - missing.length) + '/' + pts.length + '</span>';
        clRows.innerHTML = pts
          .map(function (k) {
            const ok = missing.indexOf(k) === -1;
            return '<div class="cl-row ' + (ok ? 'ok' : '') +
              '"><div class="cl-dot"></div><span>' + (LABEL_BY_IDX[k] || k) + '</span></div>';
          })
          .join('');
      }

      // camera-verification.html:1734-1738
      function applyMirror() {
        const mirror = currentFacing === 'user';
        video.classList.toggle('no-mirror', !mirror);
        canvas.classList.toggle('no-mirror', !mirror);
      }

      // camera-verification.html:1896-1904
      window.__resilienciaSetNativeOrientation = function (sample) {
        if (!sample) return;
        if (sample.available === false) {
          post({ type: 'log', text: 'Sensor de orientación no disponible' });
          return;
        }
        if (sample.available !== true || typeof sample.vertical !== 'boolean') return;
        post({ type: 'orientation', vertical: sample.vertical, beta: sample.beta });
      };

      // camera-verification.html:1906-1959
      async function startCamera() {
        stage('camara');
        // En producción esto espera el sensor antes de tocar el modelo. Acá el
        // sensor lo lee la app con expo-sensors y lo inyecta por
        // __resilienciaSetNativeOrientation, igual que el prototipo.
        if (runningInsideReactNative) post({ type: 'sensor_request' });
        try {
          if (!poseLandmarker) await initModel();
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: currentFacing },
            audio: false,
          });
          video.srcObject = stream;
          await video.play();
          canvas.width = video.videoWidth || 480;
          canvas.height = video.videoHeight || 640;
          running = true;
          applyMirror();
          post({ type: 'running' });
          log('Cámara activa · ' + hlTitle);
          requestAnimationFrame(loop);
        } catch (e) {
          post({ type: 'fatal', error: 'cámara: ' + e.message });
        }
      }

      // camera-verification.html:1760-1776
      function loop() {
        if (!running) return;
        const now = performance.now();
        if (video.currentTime !== lastTime) {
          lastTime = video.currentTime;
          let r;
          try {
            r = poseLandmarker.detectForVideo(video, now);
          } catch (e) {
            post({ type: 'fatal', error: 'detect: ' + e.message });
            running = false;
            return;
          }
          draw(r);
          const lms = (r && r.landmarks && r.landmarks[0]) || [];
          const missing = [];
          for (const k of hlPts) {
            const p = lms[k];
            if (!p || (p.visibility ?? 0) < VIS) missing.push(k);
          }
          renderChecklist(hlTitle, hlPts, missing);
          const flat = [];
          for (const p of lms) {
            flat.push(p.x, p.y, p.z, p.visibility === undefined ? 1 : p.visibility);
          }
          post({ type: 'pose', t: Date.now(), flat: flat });
        }
        requestAnimationFrame(loop);
      }

      function stopCamera() {
        running = false;
        const old = video.srcObject;
        if (old) old.getTracks().forEach(function (t) { t.stop(); });
        video.srcObject = null;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        checklistHud.style.display = 'none';
      }

      window.__start = startCamera;
      window.__stop = stopCamera;
      window.__facing = function (f) {
        currentFacing = f === 'back' ? 'environment' : 'user';
        applyMirror();
        if (running) startCamera();
      };
      // La app nativa calcula el lado confirmado (resolveSide) y lo pasa acá.
      window.__setHighlight = function (title, pts) {
        hlTitle = title;
        hlPts = pts;
      };
      // Evidencia: un frame limpio del video, sin el overlay del esqueleto.
      window.__snap = function () {
        try {
          const c = document.createElement('canvas');
          c.width = video.videoWidth || 480;
          c.height = video.videoHeight || 640;
          c.getContext('2d').drawImage(video, 0, 0, c.width, c.height);
          post({ type: 'snap', uri: c.toDataURL('image/jpeg', 0.6) });
        } catch (e) {
          post({ type: 'log', text: 'sin evidencia: ' + e.message });
        }
      };

      stage('script');      waitForVision(40)
        .then(function () {
          post({ type: 'log', text: 'MediaPipe ' + VERSION + ' cargado' });
        })
        .catch(function (e) {
          post({ type: 'fatal', error: e.message });
        });
    </script>
  </body>
</html>`;

/** Origen del WebView: sin esto el CDN y el WASM fallan por CORS. */
export const POSE_BRIDGE_BASE_URL = 'https://cdn.jsdelivr.net';

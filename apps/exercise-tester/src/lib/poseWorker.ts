// Puente de pose: WebView oculta que carga MediaPipe Pose Landmarker (mismos
// modelos y CDN que camera-verification.html:1811-1820) y analiza cada snapshot
// de la cámara nativa. Es el reemplazo del WebView visible de producción: acá la
// cámara la maneja expo-camera y el conteo vive en la app.
//
// Puntos donde este puente difiere de producción (que analiza video en vivo):
// - `runningMode: 'IMAGE'` + `detect()`: la entrada son fotos fijas, no un
//   `<video>`. `detectForVideo` exige timestamps crecientes de un stream.
// - El WebView necesita un origin https real (`baseUrl`) o el CDN y el WASM
//   fallan por CORS al cargar desde `about:blank`.

export type Landmark = { x: number; y: number; z: number; visibility: number };

export type PoseStage = 'arrancando' | 'script' | 'wasm' | 'modelo' | 'lista' | 'error';

const VERSION = '0.10.14';

/**
 * El HTML del puente. Reporta el avance por etapas para que la UI pueda decir
 * en qué punto se quedó (si el CDN no responde, se ve "script", no un silencio).
 */
export const POSE_BRIDGE_HTML = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <script src="https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/vision_bundle.js" crossorigin="anonymous"></script>
  </head>
  <body style="margin:0;background:#000">
    <img id="frame" />
    <script>
      const VERSION = '${VERSION}';
      const WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@' + VERSION + '/wasm';
      const MODEL =
        'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

      let landmarker = null;
      let busy = false;
      const img = document.getElementById('frame');

      const raw = (p) => { if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(p)); };
      const send = (p) => raw(p);
      const stage = (s, extra) => send(Object.assign({ type: 'stage', stage: s }, extra || {}));

      // Todo error no capturado se reenvía: si el script del CDN no carga, el
      // ReferenceError aparecía solo en la consola del WebView y la app quedaba
      // esperando en silencio.
      window.onerror = (m, s, l) => send({ type: 'fatal', error: 'js: ' + m + ' @' + l });
      window.addEventListener('unhandledrejection', (e) =>
        send({ type: 'fatal', error: 'promise: ' + String((e.reason && e.reason.message) || e.reason) }));

      function waitForVision(triesLeft) {
        if (window.FilesetResolver && window.PoseLandmarker) return Promise.resolve();
        if (triesLeft <= 0) return Promise.reject(new Error('vision_bundle.js no cargó (CDN sin respuesta?)'));
        return new Promise((res) => setTimeout(res, 400)).then(() => waitForVision(triesLeft - 1));
      }

      async function init() {
        try {
          stage('arrancando');
          stage('script');
          await waitForVision(40);
          stage('wasm');
          const opts = (delegate) => ({
            baseOptions: { modelAssetPath: MODEL, delegate: delegate },
            // imagen fija: IMAGE mode es el correcto para snapshots
            runningMode: 'IMAGE',
            numPoses: 1,
            minPoseDetectionConfidence: 0.5,
            minPosePresenceConfidence: 0.5,
            minTrackingConfidence: 0.5,
          });
          try {
            landmarker = await PoseLandmarker.createFromOptions(vision, opts('GPU'));
          } catch (e) {
            send({ type: 'log', text: 'GPU no disponible, pruebo CPU: ' + String(e && e.message) });
            landmarker = await PoseLandmarker.createFromOptions(vision, opts('CPU'));
          }
          stage('modelo');
          // El <img> arranca sin src: el primer detect() puede correr contra una
          // imagen que todavía no decodificó. Se lo fuerza con un GIF de 1x1.
          try {
            img.src = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
            if (img.decode) await img.decode();
          } catch (e) {}
          send({
            type: 'ready',
            backend: landmarker.getBackend ? landmarker.getBackend() : 'unknown',
          });
        } catch (e) {
          send({ type: 'fatal', error: String((e && e.message) || e) });
        }
      }

      // analyze(id, base64) -> promesa resuelta por postMessage
      window.__analyze = function (id, base64) {
        if (!landmarker) {
          send({ id: id, ok: false, error: 'pose no lista' });
          return;
        }
        if (busy) {
          send({ id: id, ok: false, error: 'ocupado' });
          return;
        }
        busy = true;
        const done = () => { busy = false; };
        img.onload = () => {
          const t0 = performance.now();
          try {
            const res = landmarker.detect(img);
            const lms = (res && res.landmarks && res.landmarks[0]) || [];
            const out = [];
            for (const p of lms) {
              out.push({ x: p.x, y: p.y, z: p.z, visibility: p.visibility === undefined ? 1 : p.visibility });
            }
            send({ id: id, ok: true, landmarks: out, ms: Math.round(performance.now() - t0) });
          } catch (e) {
            send({ id: id, ok: false, error: String((e && e.message) || e) });
          }
          done();
        };
        img.onerror = () => {
          send({ id: id, ok: false, error: 'no se pudo cargar el frame' });
          done();
        };
        img.src = 'data:image/jpeg;base64,' + base64;
      };

      if (document.readyState === 'complete') init();
      else window.addEventListener('load', init);
    </script>
  </body>
</html>`;

/** Origen del WebView: sin esto el CDN y el WASM fallan por CORS. */
export const POSE_BRIDGE_BASE_URL = 'https://cdn.jsdelivr.net';

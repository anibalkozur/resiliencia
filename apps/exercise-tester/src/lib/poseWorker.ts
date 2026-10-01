// Puente de pose: WebView oculta que carga MediaPipe Pose Landmarker (mismos
// modelos y CDN que camera-verification.html:1760-1805) y analyze cada snapshot
// de la cámara nativa. Es el reemplazo del WebView visible de producción: acá la
// cámara la maneja expo-camera y el conteo vive en el app.

export type Landmark = { x: number; y: number; z: number; visibility: number };

export type AnalyzeResult =
  { ok: true; landmarks: Landmark[]; ms: number } | { ok: false; error: string };

const VERSION = '0.10.14';

export const POSE_BRIDGE_HTML = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <script src="https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/vision_bundle.js" crossorigin="anonymous"></script>
  </head>
  <body style="margin:0;background:#000">
    <img id="frame" style="display:none" />
    <script>
      const VERSION = '${VERSION}';
      const WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@' + VERSION + '/wasm';
      const MODEL =
        'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
      let landmarker = null;
      let busy = false;
      const send = (payload) => {
        if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(payload));
      };
      const img = document.getElementById('frame');

      async function init() {
        try {
          const vision = await FilesetResolver.forVisionTasks(WASM);
          const opts = (delegate) => ({
            baseOptions: { modelAssetPath: MODEL, delegate: delegate },
            runningMode: 'VIDEO',
            numPoses: 1,
            minPoseDetectionConfidence: 0.5,
            minPosePresenceConfidence: 0.5,
            minTrackingConfidence: 0.5,
          });
          try {
            landmarker = await PoseLandmarker.createFromOptions(vision, opts('GPU'));
          } catch (e) {
            landmarker = await PoseLandmarker.createFromOptions(vision, opts('CPU'));
          }
          send({ type: 'ready', backend: landmarker.getBackend ? landmarker.getBackend() : 'unknown' });
        } catch (e) {
          send({ type: 'fatal', error: String((e && e.message) || e) });
        }
      }

      window.__analyze = (id, base64) => {
        if (!landmarker || busy) {
          send({ id: id, ok: false, error: 'pose no lista' });
          return;
        }
        busy = true;
        img.onload = () => {
          const t0 = performance.now();
          try {
            const res = landmarker.detectForVideo(img, t0);
            const out = [];
            const lms = (res && res.landmarks && res.landmarks[0]) || [];
            for (const p of lms) {
              out.push({ x: p.x, y: p.y, z: p.z, visibility: p.visibility === undefined ? 1 : p.visibility });
            }
            send({ id: id, ok: true, landmarks: out, ms: Math.round(performance.now() - t0) });
          } catch (e) {
            send({ id: id, ok: false, error: String((e && e.message) || e) });
          }
          busy = false;
        };
        img.onerror = () => {
          busy = false;
          send({ id: id, ok: false, error: 'no se pudo cargar el frame' });
        };
        img.src = 'data:image/jpeg;base64,' + base64;
      };

      window.addEventListener('load', init);
    </script>
  </body>
</html>`;

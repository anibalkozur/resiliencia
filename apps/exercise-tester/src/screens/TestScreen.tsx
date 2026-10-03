// Pantalla de prueba. Copia la ejecución de producción: NO procesa pose ni
// cuenta reps acá. Monta la MISMA página que la app real
// (camera-verification.html) por URL en una WebView, le inyecta el sensor de
// inclinación con expo-sensors (mismo puente que camretos.tsx:113-134) y escucha
// el mensaje `complete`. La página prende la cámara sola y hace todo el conteo.

import { useCameraPermissions } from 'expo-camera';
import { DeviceMotion } from 'expo-sensors';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { cadenceSec, type ExerciseInfo } from '../lib/exercises';
import { summarizeCompletion, type TestResult } from '../lib/report';
import { buildVerifyUri } from '../lib/verify';

type Props = {
  exercise: ExerciseInfo;
  exerciseId: string;
  onExit: () => void;
  onRecorded: (r: TestResult) => void;
};

export function TestScreen({ exercise, exerciseId, onExit, onRecorded }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [target, setTarget] = useState(exercise.target);
  const [ranked, setRanked] = useState(false);
  const [live, setLive] = useState(false);
  const [restartKey, setRestartKey] = useState(0);
  const [last, setLast] = useState<string | null>(null);
  const webRef = useRef<WebView<object>>(null);

  const step = exercise.step ?? (exercise.unit === 'seconds' ? 5 : 1);
  const minTarget = exercise.unit === 'seconds' ? 5 : step;
  const maxTarget = exercise.unit === 'seconds' ? 120 : 200;
  const unitLabel = exercise.unit === 'seconds' ? 'segundos' : 'reps';

  // Puente de orientación: idéntico a producción. La página espera el sensor
  // antes de encender la cámara, y dentro del WebView no llegan los eventos
  // deviceorientation/devicemotion sin gesto; por eso los lee expo-sensors y los
  // inyecta la app nativa.
  useEffect(() => {
    if (!live) return;
    let active = true;
    let sub: { remove: () => void } | null = null;
    DeviceMotion.isAvailableAsync().then((available) => {
      if (!available || !active) return;
      DeviceMotion.setUpdateInterval(200);
      sub = DeviceMotion.addListener(({ accelerationIncludingGravity: g }) => {
        if (!g || !Number.isFinite(g.y) || !Number.isFinite(g.z)) return;
        if (Math.hypot(g.y, g.z) < 1) return;
        const tilt = (Math.atan2(Math.abs(g.z), Math.abs(g.y)) * 180) / Math.PI;
        const vertical = tilt <= 35;
        webRef.current?.injectJavaScript(
          `window.__resilienciaSetNativeOrientation && window.__resilienciaSetNativeOrientation(${JSON.stringify({ available: true, vertical, beta: null })})`,
        );
      });
    });
    return () => {
      active = false;
      sub?.remove();
    };
  }, [live, restartKey]);

  const onWebMessage = useCallback(
    (event: { nativeEvent: { data: string } }) => {
      let data: Record<string, unknown>;
      try {
        data = JSON.parse(event.nativeEvent.data) as Record<string, unknown>;
      } catch {
        return;
      }
      const type = String(data.type ?? '');
      if (type === 'sensor_request') return;
      if (type !== 'complete') return;
      const result = summarizeCompletion(exercise, data, Date.now());
      setLast(result.reached ? `✅ ${result.summary}` : `⚠️ ${result.summary}`);
      onRecorded(result);
    },
    [exercise, onRecorded],
  );

  if (!permission) return <View style={styles.box} />;

  if (!permission.granted) {
    return (
      <View style={styles.box}>
        <Text style={styles.msg}>
          El banco de pruebas necesita la cámara para que la página pueda verificar tu técnica.
        </Text>
        <Pressable style={styles.btn} onPress={requestPermission}>
          <Text style={styles.btnText}>Dar permiso</Text>
        </Pressable>
        <Pressable style={styles.back} onPress={onExit}>
          <Text style={styles.backText}>← Volver</Text>
        </Pressable>
      </View>
    );
  }

  if (!live) {
    return (
      <View style={styles.box}>
        <Text style={styles.name}>{exercise.name}</Text>

        <Text style={styles.label}>Objetivo</Text>
        <View style={styles.row}>
          <Pressable
            style={styles.stepBtn}
            onPress={() => setTarget((t) => Math.max(minTarget, t - step))}
          >
            <Text style={styles.stepText}>−</Text>
          </Pressable>
          <View style={styles.targetBox}>
            <Text style={styles.targetNum}>{target}</Text>
            <Text style={styles.targetUnit}>{unitLabel}</Text>
          </View>
          <Pressable
            style={styles.stepBtn}
            onPress={() => setTarget((t) => Math.min(maxTarget, t + step))}
          >
            <Text style={styles.stepText}>+</Text>
          </Pressable>
        </View>

        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Ranking (gesto de mano, cadencia y prueba de vida)</Text>
          <Switch value={ranked} onValueChange={setRanked} />
        </View>

        <Text style={styles.hint}>
          Se carga la misma página que la app real (camera-verification.html) en una WebView, con el
          mismo puente de inclinación. La página prende la cámara sola y hace todo el conteo.
        </Text>

        <Pressable style={styles.btn} onPress={() => setLive(true)}>
          <Text style={styles.btnText}>Iniciar</Text>
        </Pressable>
        <Pressable style={styles.back} onPress={onExit}>
          <Text style={styles.backText}>← Volver</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.live}>
      <View style={styles.bar}>
        <Pressable onPress={onExit} hitSlop={8}>
          <Text style={styles.barText}>← Salir</Text>
        </Pressable>
        <Text style={styles.barTitle} numberOfLines={1}>
          {exercise.name} · {target} {unitLabel}
          {ranked ? ' · ranking' : ''}
        </Text>
        <Pressable onPress={() => setRestartKey((k) => k + 1)} hitSlop={8}>
          <Text style={styles.barText}>Reiniciar</Text>
        </Pressable>
      </View>

      <Text style={styles.resultBar} numberOfLines={2}>
        {last ?? `En vivo${ranked ? ' · ranking: ~5 s por rep o se rompe la serie' : ''}`}
      </Text>

      <WebView<object>
        ref={webRef}
        key={`${exerciseId}-${target}-${ranked ? 'r' : 'f'}-${restartKey}`}
        originWhitelist={['*']}
        source={{
          uri: buildVerifyUri(exerciseId, target, exercise.unit, {
            ranked,
            cadenceSec: ranked ? (cadenceSec(exerciseId) ?? 5) : undefined,
          }),
        }}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        onMessage={onWebMessage}
        style={styles.web}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, padding: 18, justifyContent: 'center' },
  msg: { color: '#9FB0C6', fontSize: 13, lineHeight: 19, marginBottom: 14 },
  name: { color: '#EAF2FF', fontSize: 20, fontWeight: '800', marginBottom: 16 },
  label: { color: '#7C8AA0', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 18 },
  stepBtn: {
    width: 48,
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1E2630',
    backgroundColor: '#0D1117',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { color: '#39D98A', fontSize: 26, fontWeight: '800', lineHeight: 30 },
  targetBox: { minWidth: 96, alignItems: 'center' },
  targetNum: { color: '#EAF2FF', fontSize: 44, fontWeight: '800' },
  targetUnit: { color: '#7C8AA0', fontSize: 13, fontWeight: '600' },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  toggleLabel: {
    color: '#EAF2FF',
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
    marginRight: 12,
  },
  hint: { color: '#7C8AA0', fontSize: 12, lineHeight: 18, marginBottom: 16 },
  btn: {
    backgroundColor: '#39D98A',
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnText: { color: '#06210F', fontWeight: '800', fontSize: 14 },
  back: { paddingVertical: 12, alignItems: 'center' },
  backText: { color: '#39D98A', fontSize: 13, fontWeight: '700' },
  live: { flex: 1 },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  barText: { color: '#39D98A', fontSize: 13, fontWeight: '700' },
  barTitle: {
    color: '#EAF2FF',
    fontSize: 12,
    fontWeight: '700',
    flexShrink: 1,
    marginHorizontal: 10,
  },
  resultBar: {
    color: '#EAF2FF',
    backgroundColor: '#0D1117',
    fontSize: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  web: { flex: 1, backgroundColor: '#000' },
});

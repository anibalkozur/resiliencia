// Pantalla de prueba. Copia la ejecución de producción: NO procesa pose ni
// cuenta reps acá. Monta la MISMA página que la app real
// (camera-verification.html) por URL en una WebView, le inyecta el sensor de
// inclinación con expo-sensors (mismo puente que camretos.tsx:113-134) y escucha
// el mensaje `complete`. La página prende la cámara sola y hace todo el conteo.

import { useCameraPermissions } from 'expo-camera';
import { DeviceMotion } from 'expo-sensors';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { FIRST_EXERCISE, exerciseById, type ExerciseInfo } from '../lib/exercises';
import { summarizeCompletion, type TestResult } from '../lib/report';
import { hablarVoz } from '../lib/voz';
import { buildSequenceUri, buildVerifyUri, type SequenceItem } from '../lib/verify';

type Props = {
  items: SequenceItem[];
  /** La prueba de vida se elige en la home, junto con la secuencia. */
  ranked?: boolean;
  onExit: () => void;
  onRecorded: (r: TestResult) => void;
};

export function TestScreen({ items, ranked: rankedProp = false, onExit, onRecorded }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const multi = items.length > 1;
  const first: ExerciseInfo = exerciseById(items[0]?.id ?? '') ?? FIRST_EXERCISE;
  const [targets, setTargets] = useState<number[]>(items.map((i) => i.target));
  const [ranked, setRanked] = useState(rankedProp);
  const [live, setLive] = useState(false);
  const [restartKey, setRestartKey] = useState(0);
  const [last, setLast] = useState<string | null>(null);
  // Índice del último ejercicio que terminó, para marcar el avance en la lista.
  const [doneIndex, setDoneIndex] = useState(-1);
  const webRef = useRef<WebView<object>>(null);

  const step = first.step ?? (first.unit === 'seconds' ? 5 : 1);
  const minTarget = first.unit === 'seconds' ? 5 : step;
  const maxTarget = first.unit === 'seconds' ? 120 : 200;
  const unitLabel = first.unit === 'seconds' ? 'segundos' : 'reps';
  const target = targets[0] ?? first.target;
  const bump = (i: number, dir: 1 | -1, min: number, max: number, by: number) =>
    setTargets((prev) => {
      const next = [...prev];
      const cur = next[i] ?? items[i]?.target ?? FIRST_EXERCISE.target;
      next[i] = Math.min(max, Math.max(min, cur + dir * by));
      return next;
    });

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
      // La página no habla: avisa qué frase tocar y el TTS nativo la dice. El
      // `speechSynthesis` del WebView de Android no es confiable y desde la
      // página no hay forma de saber si sonó.
      if (type === 'voz') {
        hablarVoz(String(data.text ?? ''));
        return;
      }
      // Las frases que la página eligió, para poder verlas en la terminal de
      // Metro cuando hay que saber por qué no sonó algo.
      if (type === 'voz_log') {
        console.log(`[bench] ${String(data.text ?? '')}`);
        return;
      }
      if (type !== 'complete') return;
      // En una secuencia cada `complete` es de un ejercicio distinto: la página
      // manda cuál es (`exerciseId`), así que el informe usa ese y no el primero.
      const doneId = String(data.exerciseId ?? '');
      const info =
        (doneId ? exerciseById(doneId) : null) ??
        exerciseById(items[0]?.id ?? '') ??
        FIRST_EXERCISE;
      const result = summarizeCompletion(info, data, Date.now());
      const seqIndex = Number(data.seqIndex);
      if (Number.isFinite(seqIndex)) setDoneIndex(seqIndex);
      setLast(result.reached ? `✅ ${result.summary}` : `⚠️ ${result.summary}`);
      onRecorded(result);
    },
    [items, onRecorded],
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
      // Con varios ejercicios la lista, el toggle y el botón no entran: sin
      // scroll quedan inalcanzables.
      <ScrollView contentContainerStyle={styles.box} style={styles.scroll}>
        <Text style={styles.name}>{multi ? `Secuencia de ${items.length}` : first.name}</Text>

        {multi ? (
          <>
            <Text style={styles.label}>Orden de la sesión</Text>
            {items.map((it, i) => {
              const info = exerciseById(it.id);
              const step0 = info?.step ?? (info?.unit === 'seconds' ? 5 : 1);
              const min0 = info?.unit === 'seconds' ? 5 : step0;
              const max0 = info?.unit === 'seconds' ? 120 : 200;
              return (
                <View key={`${it.id}-${i}`} style={styles.seqRow}>
                  <Text style={styles.seqPos}>{i + 1}</Text>
                  <Text style={styles.seqName} numberOfLines={1}>
                    {info?.name ?? it.id}
                  </Text>
                  <Pressable style={styles.stepBtn} onPress={() => bump(i, -1, min0, max0, step0)}>
                    <Text style={styles.stepText}>−</Text>
                  </Pressable>
                  <Text style={styles.seqTarget}>
                    {targets[i] ?? it.target} {info?.unit === 'seconds' ? 's' : ''}
                  </Text>
                  <Pressable style={styles.stepBtn} onPress={() => bump(i, 1, min0, max0, step0)}>
                    <Text style={styles.stepText}>+</Text>
                  </Pressable>
                </View>
              );
            })}
            <Text style={styles.hint}>
              Empezás por el 1. Al completar cada uno levantás la mano para pasar al siguiente; si
              la serie se rompe, la misma mano reintenta ese ejercicio.
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.label}>Objetivo</Text>
            <View style={styles.row}>
              <Pressable
                style={styles.stepBtn}
                onPress={() => bump(0, -1, minTarget, maxTarget, step)}
              >
                <Text style={styles.stepText}>−</Text>
              </Pressable>
              <View style={styles.targetBox}>
                <Text style={styles.targetNum}>{target}</Text>
                <Text style={styles.targetUnit}>{unitLabel}</Text>
              </View>
              <Pressable
                style={styles.stepBtn}
                onPress={() => bump(0, 1, minTarget, maxTarget, step)}
              >
                <Text style={styles.stepText}>+</Text>
              </Pressable>
            </View>
          </>
        )}

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
      </ScrollView>
    );
  }

  const seqItems: SequenceItem[] = items.map((it, i) => ({
    id: it.id,
    target: targets[i] ?? it.target,
  }));
  // 6 s/rep para todos los ejercicios, como se decidió para la sesión.
  const cadence = ranked ? 6 : undefined;

  return (
    <View style={styles.live}>
      <View style={styles.bar}>
        <Pressable onPress={onExit} hitSlop={8}>
          <Text style={styles.barText}>← Salir</Text>
        </Pressable>
        <Text style={styles.barTitle} numberOfLines={1}>
          {multi ? `Secuencia de ${items.length}` : `${first.name} · ${target} ${unitLabel}`}
          {ranked ? ' · ranking' : ''}
        </Text>
        <Pressable onPress={() => setRestartKey((k) => k + 1)} hitSlop={8}>
          <Text style={styles.barText}>Reiniciar</Text>
        </Pressable>
      </View>

      {multi ? (
        <View style={styles.seqStrip}>
          {seqItems.map((it, i) => {
            const info = exerciseById(it.id);
            const done = i <= doneIndex;
            const active = i === doneIndex + 1;
            return (
              <Text
                key={`${it.id}-${i}`}
                style={[
                  styles.seqChip,
                  done ? styles.seqChipDone : null,
                  active ? styles.seqChipActive : null,
                ]}
                numberOfLines={1}
              >
                {done ? '✓ ' : ''}
                {i + 1}. {info?.name ?? it.id}
              </Text>
            );
          })}
        </View>
      ) : null}

      <Text style={styles.resultBar} numberOfLines={2}>
        {last ?? `En vivo${ranked ? ' · ranking: ~6 s por rep o se rompe la serie' : ''}`}
      </Text>

      <WebView<object>
        ref={webRef}
        key={`${multi ? seqItems.map((i) => `${i.id}:${i.target}`).join(',') : `${first.id}:${target}`}-${ranked ? 'r' : 'f'}-${restartKey}`}
        originWhitelist={['*']}
        source={{
          uri: multi
            ? buildSequenceUri(seqItems, { ranked, cadenceSec: cadence })
            : buildVerifyUri(first.id, target, first.unit, {
                ranked,
                cadenceSec: cadence,
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
  scroll: { flex: 1 },
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
  seqRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  seqPos: {
    color: '#030405',
    backgroundColor: '#39D98A',
    fontSize: 12,
    fontWeight: '800',
    width: 22,
    height: 22,
    borderRadius: 11,
    lineHeight: 22,
    textAlign: 'center',
    overflow: 'hidden',
  },
  seqName: { color: '#EAF2FF', fontSize: 14, fontWeight: '600', flex: 1 },
  seqTarget: {
    color: '#EAF2FF',
    fontSize: 14,
    fontWeight: '700',
    minWidth: 42,
    textAlign: 'right',
  },
  seqStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    paddingHorizontal: 12,
    paddingBottom: 6,
  },
  seqChip: {
    color: '#7C8AA0',
    fontSize: 11,
    fontWeight: '600',
    borderWidth: 1,
    borderColor: '#1E2630',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  seqChipDone: { color: '#39D98A', borderColor: '#1d5c3a' },
  seqChipActive: { color: '#030405', backgroundColor: '#39D98A', borderColor: '#39D98A' },
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

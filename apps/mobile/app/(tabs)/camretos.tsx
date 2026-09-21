import { useState, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { colors, spacing } from '@resiliencia/design-tokens';
import { usePrefs } from '../../src/prefs/PrefsProvider';
import { EXERCISES, DEFAULT_TARGETS } from '../../src/retos/catalog';
import { buildVerifyUri } from '../../src/retos/verify';
import { translate } from '../../src/i18n/translations';
import { useLibreExercise } from '../../src/header/LibreExerciseProvider';

export default function LibreScreen() {
  const { prefs } = usePrefs();
  const lang = prefs?.language ?? 'es';
  const { libreExerciseId } = useLibreExercise();
  const [freeResult, setFreeResult] = useState<string | null>(null);

  const freeExercise = EXERCISES.find((e) => e.id === libreExerciseId);
  const freeUnit = freeExercise?.unit ?? 'reps';
  const freeTarget = DEFAULT_TARGETS[libreExerciseId] ?? 10;
  const freeUnitLabel = translate(lang, freeUnit === 'reps' ? 'unit.reps' : 'unit.seconds');

  const handleMessage = useCallback(
    (event: any) => {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type !== 'complete') return;
      const reps = Number(data.reps) || 0;
      setFreeResult(translate(lang, 'cam.free_done', { n: reps, unit: freeUnitLabel }));
    },
    [lang, freeUnitLabel],
  );

  return (
    <View style={styles.container}>
      {freeResult ? (
        <View style={styles.resultBar}>
          <Text style={styles.freeResult}>{freeResult}</Text>
        </View>
      ) : null}
      <View style={styles.cameraContainer}>
        <WebView
          key={libreExerciseId}
          originWhitelist={['*']}
          source={{ uri: buildVerifyUri(libreExerciseId, freeTarget, freeUnit) }}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          allowsInlineMediaPlayback={true}
          mediaPlaybackRequiresUserAction={false}
          onMessage={handleMessage}
          style={styles.webView}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  resultBar: {
    backgroundColor: '#0D1E18',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  freeResult: {
    color: colors.teal,
    fontSize: 13,
    fontWeight: '600',
  },
  cameraContainer: { flex: 1 },
  webView: { flex: 1 },
});

import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { WebView } from 'react-native-webview';
import { colors, radius, spacing } from '@resiliencia/design-tokens';
import { usePrefs } from '../../src/prefs/PrefsProvider';
import { EXERCISES, DEFAULT_TARGETS, exerciseNameKey } from '../../src/retos/catalog';
import { buildVerifyUri } from '../../src/retos/verify';
import { translate } from '../../src/i18n/translations';

export default function LibreScreen() {
  const { prefs } = usePrefs();
  const lang = prefs?.language ?? 'es';
  const [freeExerciseId, setFreeExerciseId] = useState<string>('sentadillas');
  const [freeResult, setFreeResult] = useState<string | null>(null);

  const freeExercise = EXERCISES.find((e) => e.id === freeExerciseId);
  const freeUnit = freeExercise?.unit ?? 'reps';
  const freeTarget = DEFAULT_TARGETS[freeExerciseId] ?? 10;
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
      <View style={styles.topSection}>
        <View style={styles.card}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}
          >
            {EXERCISES.map((e) => {
              const selected = e.id === freeExerciseId;
              return (
                <Pressable
                  key={e.id}
                  style={[styles.chip, selected && styles.chipSelected]}
                  onPress={() => {
                    setFreeExerciseId(e.id);
                    setFreeResult(null);
                  }}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                    {translate(lang, exerciseNameKey(e.id))}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <Text style={styles.freeMeta}>
            {translate(lang, exerciseNameKey(freeExerciseId))} · {freeTarget} {freeUnitLabel}
          </Text>
          {freeResult ? <Text style={styles.freeResult}>{freeResult}</Text> : null}
        </View>
      </View>

      <View style={styles.cameraContainer}>
        <WebView
          key={freeExerciseId}
          originWhitelist={['*']}
          source={{ uri: buildVerifyUri(freeExerciseId, freeTarget, freeUnit) }}
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
  topSection: { paddingHorizontal: spacing.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  chipsRow: { gap: spacing.sm, paddingRight: spacing.lg, paddingVertical: spacing.xs },
  chip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  chipSelected: { borderColor: colors.teal, backgroundColor: '#0D1E18' },
  chipText: { color: colors.silverDim, fontSize: 13, fontWeight: '600' },
  chipTextSelected: { color: colors.teal, fontWeight: '800' },
  freeMeta: {
    color: colors.silver,
    fontSize: 14,
    fontWeight: '800',
    marginTop: spacing.xs,
  },
  freeResult: {
    color: colors.teal,
    fontSize: 13,
    marginTop: spacing.xs,
  },
  cameraContainer: { flex: 1 },
  webView: { flex: 1 },
});

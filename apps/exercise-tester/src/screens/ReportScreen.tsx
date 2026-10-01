import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { toJson, type TestResult } from '../lib/report';

type Props = {
  results: TestResult[];
  onBack: () => void;
  onSelect: (exerciseId: string) => void;
};

export function ReportScreen({ results, onBack, onSelect }: Props) {
  return (
    <View>
      <View style={styles.row}>
        <Pressable onPress={onBack} style={styles.back}>
          <Text style={styles.backText}>← Volver</Text>
        </Pressable>
        <Pressable onPress={() => onSelect('sentadillas')} style={styles.back}>
          <Text style={styles.backText}>Probar de nuevo</Text>
        </Pressable>
      </View>

      {results.length === 0 ? (
        <Text style={styles.empty}>Todavía no hay pruebas. Elegí un ejercicio.</Text>
      ) : (
        results.map((r, i) => (
          <View key={`${r.exerciseId}-${r.finishedAt}-${i}`} style={styles.card}>
            <Text style={styles.title}>
              {r.reached ? '✅' : '⚠️'} {r.name} — {r.summary}
            </Text>
            {r.detail.map((d, j) => (
              <Text key={j} style={styles.line}>
                {d}
              </Text>
            ))}
            {r.telemetry.length > 0 ? (
              <Text style={styles.tele}>
                reps:{' '}
                {r.telemetry
                  .map(
                    (t) => `#${t.index}:${t.amplitude.toFixed(0)}°/${Math.round(t.durationMs)}ms`,
                  )
                  .join('  ')}
              </Text>
            ) : null}
          </View>
        ))
      )}

      <Text style={styles.json}>JSON (para comparar corridas y portar ajustes):</Text>
      <ScrollView horizontal style={styles.jsonBox}>
        <Text style={styles.jsonText}>{toJson(results)}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  back: { paddingVertical: 6, paddingHorizontal: 4 },
  backText: { color: '#39D98A', fontSize: 13, fontWeight: '700' },
  empty: { color: '#7C8AA0', fontSize: 13 },
  card: {
    backgroundColor: '#0D1117',
    borderColor: '#1E2630',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  title: { color: '#EAF2FF', fontSize: 15, fontWeight: '700', marginBottom: 6 },
  line: { color: '#9FB0C6', fontSize: 12, lineHeight: 17 },
  tele: { color: '#6E7F96', fontSize: 11, marginTop: 8, lineHeight: 16 },
  json: { color: '#7C8AA0', fontSize: 12, marginTop: 14, marginBottom: 6 },
  jsonBox: {
    backgroundColor: '#070A0E',
    borderColor: '#1E2630',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    maxHeight: 260,
  },
  jsonText: { color: '#6E7F96', fontSize: 10, lineHeight: 14 },
});

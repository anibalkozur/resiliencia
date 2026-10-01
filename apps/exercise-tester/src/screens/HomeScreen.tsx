import { Pressable, StyleSheet, Text, View } from 'react-native';

import { EXERCISES } from '../lib/exercises';
import { verdict, type TestResult } from '../lib/report';
import { tiltSummary } from '../lib/tilt';

type Props = {
  results: TestResult[];
  onSelect: (exerciseId: string) => void;
  onReport: () => void;
};

export function HomeScreen({ results, onSelect, onReport }: Props) {
  return (
    <View>
      <Text style={styles.h1}>Ejercicios libres</Text>
      <Text style={styles.hint}>
        Mismos umbrales que la app real (camera-verification.html). Sirve para ajustar el conteo
        antes de portarlo.
      </Text>

      {EXERCISES.map((e) => (
        <Pressable key={e.id} style={styles.card} onPress={() => onSelect(e.id)}>
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>{e.name}</Text>
            <Text style={styles.tag}>{e.side}</Text>
          </View>
          <Text style={styles.cardBody}>
            objetivo {e.target} {e.kind === 'isometrico' ? 'segundos' : 'reps'} · prueba de vida{' '}
            {e.liveness}
            {'\n'}cámara + inclinación · vertical obligatoria
          </Text>
        </Pressable>
      ))}

      <Text style={styles.h1}>Prueba de vida</Text>
      <View style={styles.card}>
        <Text style={styles.cardBody}>
          Se dispara sola, una vez por sesión, entre los 4 y 13 s. Tipo “mano” (muñeca 6% sobre la
          nariz, 5 cuadros) para sentadillas y abdominales; tipo “hold” (2 s abajo) para flexiones.
          {'\n'}Probala con los 3 ejercicios: si nunca te pide la prueba, el ejercicio queda sin
          antifraude.
        </Text>
        <Text style={styles.cardBody}>{tiltSummary()}</Text>
      </View>

      <Pressable style={styles.btn} onPress={onReport}>
        <Text style={styles.btnText}>Ver informe ({results.length})</Text>
      </Pressable>

      {results.length > 0 ? (
        <View style={styles.lastBox}>
          <Text style={styles.h2}>Última prueba</Text>
          {results.slice(0, 5).map((r, i) => (
            <Text key={`${r.exerciseId}-${r.finishedAt}-${i}`} style={styles.lastLine}>
              {verdict(r)}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  h1: { color: '#EAF2FF', fontSize: 16, fontWeight: '700', marginTop: 18, marginBottom: 6 },
  h2: { color: '#EAF2FF', fontSize: 14, fontWeight: '700', marginBottom: 4 },
  hint: { color: '#7C8AA0', fontSize: 12, marginBottom: 8, lineHeight: 17 },
  card: {
    backgroundColor: '#0D1117',
    borderColor: '#1E2630',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { color: '#EAF2FF', fontSize: 16, fontWeight: '600' },
  tag: {
    color: '#0B0F14',
    backgroundColor: '#39D98A',
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: 'hidden',
  },
  cardBody: { color: '#9FB0C6', fontSize: 12, lineHeight: 18, marginTop: 6 },
  btn: {
    backgroundColor: '#39D98A',
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  btnText: { color: '#06210F', fontWeight: '800', fontSize: 14 },
  lastBox: { marginTop: 18 },
  lastLine: { color: '#9FB0C6', fontSize: 12, marginTop: 4 },
});

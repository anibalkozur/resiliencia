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
  const free = EXERCISES.filter((e) => e.tier === 'free');
  const premium = EXERCISES.filter((e) => e.tier === 'premium');

  const card = (e: (typeof EXERCISES)[number]) => (
    <Pressable key={e.id} style={styles.card} onPress={() => onSelect(e.id)}>
      <View style={styles.cardHead}>
        <Text style={styles.cardTitle}>{e.name}</Text>
        <View style={styles.tags}>
          <Text style={[styles.tag, e.tier === 'premium' ? styles.tagPremium : null]}>
            {e.tier}
          </Text>
          <Text style={styles.tag}>{e.side}</Text>
          <Text style={styles.tag}>{e.unit === 'seconds' ? 'segundos' : 'reps'}</Text>
        </View>
      </View>
      <Text style={styles.cardBody}>
        objetivo {e.target} {e.unit === 'seconds' ? 'segundos' : 'reps'} · vida: {e.liveness} ·{' '}
        {e.unit === 'seconds' ? 'isométrico' : 'por repeticiones'}
        {e.postureMsg ? `\n${e.postureMsg}` : ''}
      </Text>
    </Pressable>
  );

  return (
    <View>
      <Text style={styles.h1}>Banco de pruebas</Text>
      <Text style={styles.hint}>
        Los 8 ejercicios de la app real, con los umbrales de camera-verification.html. Sirve para
        ajustar el conteo y completar series antes de portarlo.
      </Text>

      <Text style={styles.h2}>Gratuitos ({free.length})</Text>
      {free.map(card)}

      <Text style={styles.h2}>Premium ({premium.length})</Text>
      {premium.map(card)}

      <Text style={styles.h1}>Prueba de vida</Text>
      <View style={styles.card}>
        <Text style={styles.cardBody}>
          Se dispara sola, una vez por sesión, entre los 4 y 13 s. Tipo “mano” (muñeca 5% sobre el
          hombro, 5 cuadros) para sentadillas, abdominales, zancadas, puente, mountain climbers y
          sentadilla isométrica; tipo “hold” (2 s abajo) para flexiones y plancha.
          {'\n'}Con objetivo mayor a 5 tiene que dispararse: si con ningún ejercicio te pide la
          prueba, el antifraude quedó roto.
        </Text>
        <Text style={styles.cardBody}>{tiltSummary()}</Text>
      </View>

      <Pressable style={styles.btn} onPress={onReport}>
        <Text style={styles.btnText}>Ver informe ({results.length})</Text>
      </Pressable>

      {results.length > 0 ? (
        <View style={styles.lastBox}>
          <Text style={styles.h2}>Últimas pruebas</Text>
          {results.slice(0, 8).map((r, i) => (
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
  h2: { color: '#EAF2FF', fontSize: 14, fontWeight: '700', marginTop: 12, marginBottom: 4 },
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
  cardTitle: { color: '#EAF2FF', fontSize: 16, fontWeight: '600', flexShrink: 1 },
  tags: { flexDirection: 'row', gap: 4 },
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
  tagPremium: { backgroundColor: '#F4C542' },
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

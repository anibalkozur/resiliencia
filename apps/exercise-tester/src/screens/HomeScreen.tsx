import { Pressable, StyleSheet, Text, View } from 'react-native';

import { EXERCISES, type ExerciseInfo } from '../lib/exercises';
import { verdict, type TestResult } from '../lib/report';

type Props = {
  results: TestResult[];
  onSelect: (exerciseId: string) => void;
  onReport: () => void;
};

export function HomeScreen({ results, onSelect, onReport }: Props) {
  const free = EXERCISES.filter((e) => e.tier === 'free');
  const premium = EXERCISES.filter((e) => e.tier === 'premium');

  const card = (e: ExerciseInfo) => (
    <Pressable key={e.id} style={styles.card} onPress={() => onSelect(e.id)}>
      <View style={styles.cardHead}>
        <Text style={styles.cardTitle}>{e.name}</Text>
        <View style={styles.tags}>
          <Text style={[styles.tag, e.tier === 'premium' ? styles.tagPremium : null]}>
            {e.tier}
          </Text>
          <Text style={styles.tag}>{e.unit === 'seconds' ? 'segundos' : 'reps'}</Text>
        </View>
      </View>
      <Text style={styles.cardBody}>
        objetivo {e.target} {e.unit === 'seconds' ? 'segundos' : 'reps'} · vida: {e.liveness}
        {e.catalogUnit && e.catalogUnit !== e.unit
          ? `\n⚠ la página mide ${e.unit}; catalog.ts declara ${e.catalogUnit}`
          : ''}
      </Text>
    </Pressable>
  );

  return (
    <View>
      <Text style={styles.h1}>Banco de pruebas</Text>
      <Text style={styles.hint}>
        Carga la misma página que la app real (camera-verification.html) en una WebView: la cámara,
        el modelo, el esqueleto y el conteo son los de producción, no una reimplementación.
      </Text>

      <Text style={styles.h2}>Gratuitos ({free.length})</Text>
      {free.map(card)}

      <Text style={styles.h2}>Premium ({premium.length})</Text>
      {premium.map(card)}

      <Text style={styles.h1}>Cómo funciona</Text>
      <View style={styles.card}>
        <Text style={styles.cardBody}>
          Al tocar Iniciar, la página arranca sola: pide el sensor de inclinación (se lo inyecta el
          celular con expo-sensors, igual que la app), enciende la cámara, carga MediaPipe y cuenta
          reps. Al terminar manda `complete` y acá se guarda el resultado para comparar.
        </Text>
        <Text style={styles.cardBody}>
          Si la prueba de vida no salta en un ejercicio con objetivo mayor a 5, el antifraude quedó
          roto: tiene que dispararse en los 8.
        </Text>
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

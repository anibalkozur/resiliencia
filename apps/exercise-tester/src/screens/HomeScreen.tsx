import { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { EXERCISES, type ExerciseInfo } from '../lib/exercises';
import { verdict, type TestResult } from '../lib/report';
import type { SequenceItem } from '../lib/verify';

type Props = {
  results: TestResult[];
  onSelect: (exerciseId: string) => void;
  onStartSequence: (items: SequenceItem[], ranked: boolean) => void;
  onReport: () => void;
};

const MAX_SEQ = 8;

export function HomeScreen({ results, onSelect, onStartSequence, onReport }: Props) {
  const free = EXERCISES.filter((e) => e.tier === 'free');
  const premium = EXERCISES.filter((e) => e.tier === 'premium');
  const [seqOpen, setSeqOpen] = useState(false);
  const [seq, setSeq] = useState<SequenceItem[]>([]);
  // La prueba de vida (y con ella el gesto de mano y la cadencia) se elige acá,
  // junto con la secuencia, no después de arrancar.
  const [ranked, setRanked] = useState(false);

  const move = (i: number, dir: -1 | 1) =>
    setSeq((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      const a = next[i];
      const b = next[j];
      if (a === undefined || b === undefined) return prev;
      next[i] = b;
      next[j] = a;
      return next;
    });
  const removeAt = (i: number) => setSeq((prev) => prev.filter((_, k) => k !== i));
  const add = (e: ExerciseInfo) =>
    setSeq((prev) => (prev.length >= MAX_SEQ ? prev : [...prev, { id: e.id, target: e.target }]));
  // Objetivo de cada ejercicio de la secuencia, con el mismo paso y los mismos
  // límites que usa la pantalla de prueba.
  const bumpTarget = (i: number, dir: -1 | 1) =>
    setSeq((prev) => {
      const it = prev[i];
      if (!it) return prev;
      const info = EXERCISES.find((e) => e.id === it.id);
      const by = info?.step ?? (info?.unit === 'seconds' ? 5 : 1);
      const min = info?.unit === 'seconds' ? 5 : by;
      const max = info?.unit === 'seconds' ? 120 : 200;
      const next = [...prev];
      next[i] = { ...it, target: Math.min(max, Math.max(min, it.target + dir * by)) };
      return next;
    });

  const picker = (e: ExerciseInfo) => (
    <View key={e.id} style={styles.pickRow}>
      <Text style={styles.pickName} numberOfLines={1}>
        {e.name}
      </Text>
      <Text style={styles.pickMeta}>
        {e.target}
        {e.unit === 'seconds' ? 's' : ''}
      </Text>
      <Pressable style={styles.addBtn} onPress={() => add(e)} hitSlop={6}>
        <Text style={styles.addText}>+</Text>
      </Pressable>
    </View>
  );

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

      <Pressable style={styles.seqToggle} onPress={() => setSeqOpen((v) => !v)}>
        <Text style={styles.seqToggleText}>
          {seqOpen ? '▾' : '▸'} Secuencia de ejercicios {seq.length ? `(${seq.length})` : ''}
        </Text>
      </Pressable>

      {seqOpen ? (
        <View style={styles.seqBox}>
          <Text style={styles.hint}>
            Elegí varios, ajustá las reps de cada uno y ordenalos con ▲▼. Empieza por el 1: al
            completar cada uno levantás la mano para pasar al siguiente, y si la serie se rompe la
            misma mano reintenta ese.
          </Text>

          {seq.length === 0 ? (
            <Text style={styles.hint}>Todavía no agregaste ninguno.</Text>
          ) : (
            seq.map((it, i) => {
              const info = EXERCISES.find((e) => e.id === it.id);
              return (
                <View key={`${it.id}-${i}`} style={styles.ordRow}>
                  <Text style={styles.ordPos}>{i + 1}</Text>
                  <Text style={styles.ordName} numberOfLines={1}>
                    {info?.name ?? it.id}
                  </Text>
                  <Pressable style={styles.ordStep} onPress={() => bumpTarget(i, -1)} hitSlop={6}>
                    <Text style={styles.ordStepText}>−</Text>
                  </Pressable>
                  <Text style={styles.ordMeta}>
                    {it.target}
                    {info?.unit === 'seconds' ? 's' : ''}
                  </Text>
                  <Pressable style={styles.ordStep} onPress={() => bumpTarget(i, 1)} hitSlop={6}>
                    <Text style={styles.ordStepText}>+</Text>
                  </Pressable>
                  <Pressable style={styles.ordBtn} onPress={() => move(i, -1)} hitSlop={6}>
                    <Text style={styles.ordBtnText}>▲</Text>
                  </Pressable>
                  <Pressable style={styles.ordBtn} onPress={() => move(i, 1)} hitSlop={6}>
                    <Text style={styles.ordBtnText}>▼</Text>
                  </Pressable>
                  <Pressable style={styles.ordBtn} onPress={() => removeAt(i)} hitSlop={6}>
                    <Text style={styles.ordBtnText}>✕</Text>
                  </Pressable>
                </View>
              );
            })
          )}

          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Prueba de vida (gesto de mano y cadencia de 6 s)</Text>
            <Switch value={ranked} onValueChange={setRanked} />
          </View>

          <Text style={styles.h2}>Agregar</Text>
          {free.map(picker)}
          {premium.map(picker)}

          <Pressable
            style={[styles.btn, seq.length === 0 ? styles.btnOff : null]}
            disabled={seq.length === 0}
            onPress={() => {
              onStartSequence(seq, ranked);
              setSeq([]);
              setSeqOpen(false);
            }}
          >
            <Text style={seq.length === 0 ? styles.btnOffText : styles.btnText}>
              Iniciar secuencia ({seq.length})
            </Text>
          </Pressable>
        </View>
      ) : null}

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
  seqToggle: { marginBottom: 10 },
  seqToggleText: { color: '#39D98A', fontSize: 14, fontWeight: '800' },
  seqBox: {
    backgroundColor: '#0A0F15',
    borderColor: '#1E2630',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  ordRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 },
  ordPos: {
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
  ordName: { color: '#EAF2FF', fontSize: 14, fontWeight: '600', flex: 1 },
  ordMeta: {
    color: '#EAF2FF',
    fontSize: 13,
    fontWeight: '800',
    minWidth: 30,
    textAlign: 'right',
  },
  ordStep: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1d5c3a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ordStepText: { color: '#39D98A', fontSize: 17, fontWeight: '800', lineHeight: 20 },
  ordBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1E2630',
    backgroundColor: '#0D1117',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    marginBottom: 6,
  },
  toggleLabel: {
    color: '#EAF2FF',
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
    marginRight: 12,
  },
  ordBtnText: { color: '#39D98A', fontSize: 13, fontWeight: '800' },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  pickName: { color: '#9FB0C6', fontSize: 13, flex: 1 },
  pickMeta: { color: '#7C8AA0', fontSize: 12 },
  addBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1d5c3a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addText: { color: '#39D98A', fontSize: 18, fontWeight: '800', lineHeight: 20 },
  btnOff: { backgroundColor: '#1b2b23' },
  btnOffText: { color: '#5b6b7c' },
});

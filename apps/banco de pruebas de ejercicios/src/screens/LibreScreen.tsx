import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { AbdominalAnimation } from '../components/AbdominalAnimation';
import { PushupAnimation } from '../components/PushupAnimation';
import type { SequenceItem } from '../lib/verify';

type Zone = 'all' | 'upper' | 'middle' | 'lower';

type LibreExercise = {
  id: string;
  name: string;
  description: string;
  unit: 'reps' | 'seconds';
  target: number;
  tier: 'free' | 'premium';
  zone: Exclude<Zone, 'all'>;
  guide: string;
};

// Réplica visual del catálogo de apps/mobile/src/retos/catalog.ts. El banco
// conserva su propio catálogo de candidatos para QA; esta lista solo define
// los 9 ejercicios que existen hoy en Modo Libre de la app real.
const LIBRE_EXERCISES: LibreExercise[] = [
  {
    id: 'flexiones',
    name: 'Flexiones',
    description: 'Tren superior',
    unit: 'reps',
    target: 10,
    tier: 'free',
    zone: 'upper',
    guide: 'Cuerpo recto en plancha. Bajá el pecho con control y volvé a extender los brazos.',
  },
  {
    id: 'fondos_silla',
    name: 'Fondos en silla',
    description: 'Tren superior',
    unit: 'reps',
    target: 12,
    tier: 'premium',
    zone: 'upper',
    guide:
      'Apoyá las manos en una silla firme y bajá el cuerpo manteniendo los hombros controlados.',
  },
  {
    id: 'abdominales',
    name: 'Abdominales',
    description: 'Core',
    unit: 'reps',
    target: 15,
    tier: 'free',
    zone: 'middle',
    guide: 'Acostate boca arriba, activá el abdomen y elevá el torso sin tirar del cuello.',
  },
  {
    id: 'plancha',
    name: 'Plancha',
    description: 'Core',
    unit: 'seconds',
    target: 30,
    tier: 'premium',
    zone: 'middle',
    guide: 'Mantené el cuerpo alineado y la cadera estable durante todo el tiempo.',
  },
  {
    id: 'mountain_climbers',
    name: 'Escaladores',
    description: 'Cardio y core',
    unit: 'seconds',
    target: 30,
    tier: 'premium',
    zone: 'middle',
    guide: 'Desde plancha, llevá las rodillas al pecho alternando sin perder la alineación.',
  },
  {
    id: 'sentadillas',
    name: 'Sentadillas',
    description: 'Tren inferior',
    unit: 'reps',
    target: 20,
    tier: 'free',
    zone: 'lower',
    guide: 'Bajá flexionando rodillas y cadera, mantené el pecho abierto y subí con control.',
  },
  {
    id: 'zancadas',
    name: 'Zancadas',
    description: 'Tren inferior',
    unit: 'reps',
    target: 24,
    tier: 'premium',
    zone: 'lower',
    guide: 'Dá un paso largo, bajá con estabilidad y empujá el suelo para volver.',
  },
  {
    id: 'puente_gluteo',
    name: 'Puente de glúteos',
    description: 'Glúteos',
    unit: 'reps',
    target: 15,
    tier: 'premium',
    zone: 'lower',
    guide: 'Acostate boca arriba, apoyá los pies y elevá la cadera apretando los glúteos.',
  },
  {
    id: 'sentadilla_isometrica',
    name: 'Sentadilla isométrica',
    description: 'Tren inferior',
    unit: 'seconds',
    target: 25,
    tier: 'premium',
    zone: 'lower',
    guide: 'Sostené la posición de sentadilla con la espalda apoyada y las rodillas estables.',
  },
];

const ZONES: { id: Zone; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'upper', label: 'Zona superior' },
  { id: 'middle', label: 'Zona media' },
  { id: 'lower', label: 'Zona inferior' },
];

function info(id: string): LibreExercise {
  return LIBRE_EXERCISES.find((exercise) => exercise.id === id) ?? LIBRE_EXERCISES[0]!;
}

function zoneColor(zone: Exclude<Zone, 'all'>): string {
  if (zone === 'upper') return '#29C7E8';
  if (zone === 'middle') return '#5585FF';
  return '#39D98A';
}

type Props = {
  onStartSequence: (items: SequenceItem[], ranked: boolean, skipSetup?: boolean) => void;
  onBack: () => void;
};

export function LibreScreen({ onStartSequence, onBack }: Props) {
  const [routine, setRoutine] = useState<SequenceItem[]>([{ id: 'sentadillas', target: 20 }]);
  const [zone, setZone] = useState<Zone>('all');
  const [ranked, setRanked] = useState(false);
  const [premiumMode, setPremiumMode] = useState(true);
  const [intro, setIntro] = useState(false);

  const visible = useMemo(
    () => LIBRE_EXERCISES.filter((exercise) => zone === 'all' || exercise.zone === zone),
    [zone],
  );
  const multi = routine.length > 1;
  const ranking = !multi && ranked;

  const addExercise = (exercise: LibreExercise) => {
    if (routine.some((item) => item.id === exercise.id)) return;
    if (exercise.tier === 'premium' && !premiumMode) return;
    setRoutine((current) => [...current, { id: exercise.id, target: exercise.target }]);
  };

  const removeExercise = (index: number) => {
    setRoutine((current) => {
      if (current.length <= 1) return current;
      return current.filter((_, position) => position !== index);
    });
  };

  const moveExercise = (index: number, direction: -1 | 1) => {
    setRoutine((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      const currentItem = next[index];
      const nextItem = next[nextIndex];
      if (!currentItem || !nextItem) return current;
      next[index] = nextItem;
      next[nextIndex] = currentItem;
      return next;
    });
  };

  const changeTarget = (index: number, direction: -1 | 1) => {
    setRoutine((current) =>
      current.map((item, position) => {
        if (position !== index) return item;
        const exercise = info(item.id);
        const step = exercise.unit === 'seconds' ? 5 : 1;
        const min = exercise.unit === 'seconds' ? 5 : 1;
        const max = exercise.unit === 'seconds' ? 120 : 200;
        return { ...item, target: Math.min(max, Math.max(min, item.target + direction * step)) };
      }),
    );
  };

  if (intro) {
    return (
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.eyebrow}>ANTES DE EMPEZAR</Text>
          <Text style={styles.title}>Tu sesión está lista</Text>
          <Text style={styles.subtitle}>
            Revisá el orden y la técnica antes de abrir la cámara.
          </Text>
          {routine.map((item, index) => {
            const exercise = info(item.id);
            return (
              <View key={`${item.id}-${index}`} style={styles.introCard}>
                <View style={styles.introHead}>
                  <Text style={styles.index}>{index + 1}</Text>
                  <Text style={styles.exerciseName}>{exercise.name}</Text>
                  <Text style={styles.target}>
                    {item.target} {exercise.unit === 'seconds' ? 'segundos' : 'reps'}
                  </Text>
                </View>
                {exercise.id === 'abdominales' ? <AbdominalAnimation size="large" /> : null}
                {exercise.id === 'flexiones' ? <PushupAnimation size="large" /> : null}
                <Text style={styles.guide}>{exercise.guide}</Text>
              </View>
            );
          })}
          <View style={styles.actions}>
            <Pressable style={styles.secondaryButton} onPress={() => setIntro(false)}>
              <Text style={styles.secondaryText}>VOLVER</Text>
            </Pressable>
            <Pressable
              style={styles.primaryButton}
              onPress={() => onStartSequence(routine, ranking, true)}
            >
              <Text style={styles.primaryText}>CONTINUAR</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>ENTRENAMIENTO A TU MEDIDA</Text>
          <Text style={styles.title}>Armá tu sesión</Text>
          <Text style={styles.subtitle}>
            Elegí ejercicios, ajustá la meta y empezá cuando estés listo.
          </Text>
          <View style={styles.stats}>
            <View>
              <Text style={styles.statValue}>{routine.length}</Text>
              <Text style={styles.statLabel}>EJERCICIOS</Text>
            </View>
            <View style={styles.divider} />
            <View>
              <Text style={styles.statValue}>{ranking ? 'SÍ' : 'NO'}</Text>
              <Text style={styles.statLabel}>RANKING</Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>TU RUTINA</Text>
            <Text style={styles.sectionHint}>Ordená y ajustá tus metas</Text>
          </View>
          <Text style={styles.counter}>
            {routine.length}/{LIBRE_EXERCISES.length}
          </Text>
        </View>

        {routine.map((item, index) => {
          const exercise = info(item.id);
          return (
            <View key={`${item.id}-${index}`} style={styles.routineCard}>
              <View style={styles.routineHead}>
                <View style={styles.index}>
                  <Text style={styles.indexText}>{index + 1}</Text>
                </View>
                <View style={styles.routineNameWrap}>
                  <Text style={styles.exerciseName}>{exercise.name}</Text>
                  <Text style={styles.exerciseDescription}>{exercise.description}</Text>
                </View>
                <View style={styles.iconActions}>
                  <Pressable
                    style={styles.iconButton}
                    disabled={index === 0}
                    onPress={() => moveExercise(index, -1)}
                  >
                    <Text style={[styles.iconText, index === 0 && styles.disabledText]}>↑</Text>
                  </Pressable>
                  <Pressable
                    style={styles.iconButton}
                    disabled={index === routine.length - 1}
                    onPress={() => moveExercise(index, 1)}
                  >
                    <Text
                      style={[styles.iconText, index === routine.length - 1 && styles.disabledText]}
                    >
                      ↓
                    </Text>
                  </Pressable>
                  <Pressable
                    style={styles.iconButton}
                    disabled={routine.length <= 1}
                    onPress={() => removeExercise(index)}
                  >
                    <Text style={[styles.removeText, routine.length <= 1 && styles.disabledText]}>
                      ×
                    </Text>
                  </Pressable>
                </View>
              </View>
              <View style={styles.targetRow}>
                <Pressable style={styles.stepButton} onPress={() => changeTarget(index, -1)}>
                  <Text style={styles.stepText}>−</Text>
                </Pressable>
                <View style={styles.targetBox}>
                  <Text style={styles.targetValue}>{item.target}</Text>
                  <Text style={styles.targetUnit}>
                    {exercise.unit === 'seconds' ? 'segundos' : 'repeticiones'}
                  </Text>
                </View>
                <Pressable style={styles.stepButton} onPress={() => changeTarget(index, 1)}>
                  <Text style={styles.stepText}>+</Text>
                </Pressable>
              </View>
            </View>
          );
        })}

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>ELEGÍ EJERCICIOS</Text>
            <Text style={styles.sectionHint}>Tocá una tarjeta para sumarla</Text>
          </View>
          <Switch value={premiumMode} onValueChange={setPremiumMode} />
        </View>
        <Text style={styles.premiumHint}>
          {premiumMode
            ? 'Modo Premium de prueba activo'
            : 'Vista free: ejercicios Premium bloqueados'}
        </Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
        >
          {ZONES.map((item) => (
            <Pressable
              key={item.id}
              style={[styles.filter, zone === item.id && styles.filterActive]}
              onPress={() => setZone(item.id)}
            >
              <Text style={[styles.filterText, zone === item.id && styles.filterTextActive]}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.grid}>
          {visible.map((exercise) => {
            const added = routine.some((item) => item.id === exercise.id);
            const locked = exercise.tier === 'premium' && !premiumMode;
            return (
              <Pressable
                key={exercise.id}
                style={[
                  styles.exerciseCard,
                  added && styles.exerciseCardAdded,
                  locked && styles.exerciseCardLocked,
                ]}
                disabled={added || locked}
                onPress={() => addExercise(exercise)}
              >
                <View style={styles.cardTop}>
                  <View style={[styles.dot, { backgroundColor: zoneColor(exercise.zone) }]} />
                  <Text style={styles.cardZone}>{exercise.description}</Text>
                  {exercise.tier === 'premium' ? <Text style={styles.premium}>PREMIUM</Text> : null}
                </View>
                {exercise.id === 'abdominales' ? <AbdominalAnimation /> : null}
                {exercise.id === 'flexiones' ? <PushupAnimation /> : null}
                <Text style={styles.cardName}>{exercise.name}</Text>
                <Text style={styles.cardMeta}>
                  {exercise.target} {exercise.unit === 'seconds' ? 'segundos' : 'reps'}
                </Text>
                <Text style={styles.cardAction}>
                  {locked ? 'BLOQUEADO' : added ? 'AGREGADO' : '＋ AGREGAR'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.rankingRow}>
          <View style={styles.rankingCopy}>
            <Text style={styles.sectionTitle}>PARTICIPAR EN RANKING</Text>
            <Text style={styles.sectionHint}>
              {multi ? 'Disponible con un solo ejercicio' : 'Prueba de vida y cadencia activas'}
            </Text>
          </View>
          <Switch value={!multi && ranked} onValueChange={setRanked} disabled={multi} />
        </View>

        <Pressable style={styles.primaryButton} onPress={() => setIntro(true)}>
          <Text style={styles.primaryText}>INICIAR</Text>
        </Pressable>
        <Pressable style={styles.backButton} onPress={onBack}>
          <Text style={styles.backText}>VOLVER AL BANCO</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#030405' },
  content: { padding: 18, paddingBottom: 42 },
  hero: {
    backgroundColor: '#0D1117',
    borderColor: '#1E2630',
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    padding: 20,
  },
  eyebrow: {
    color: '#39D98A',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.4,
    marginBottom: 6,
  },
  title: { color: '#EAF2FF', fontSize: 27, fontWeight: '900' },
  subtitle: { color: '#7C8AA0', fontSize: 13, lineHeight: 19, marginTop: 4 },
  stats: { alignItems: 'center', flexDirection: 'row', gap: 18, marginTop: 20 },
  statValue: { color: '#EAF2FF', fontSize: 18, fontWeight: '900' },
  statLabel: { color: '#7C8AA0', fontSize: 10, fontWeight: '800', letterSpacing: 1, marginTop: 2 },
  divider: { backgroundColor: '#1E2630', height: 30, width: 1 },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 9,
    marginTop: 22,
  },
  sectionTitle: { color: '#EAF2FF', fontSize: 14, fontWeight: '900', letterSpacing: 0.5 },
  sectionHint: { color: '#7C8AA0', fontSize: 11, marginTop: 3 },
  counter: { color: '#39D98A', fontSize: 13, fontWeight: '900' },
  routineCard: {
    backgroundColor: '#0D1117',
    borderColor: '#1E2630',
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
    padding: 14,
  },
  routineHead: { alignItems: 'center', flexDirection: 'row', marginBottom: 10 },
  index: {
    alignItems: 'center',
    backgroundColor: '#030405',
    borderColor: '#39D98A',
    borderRadius: 8,
    borderWidth: 1,
    height: 28,
    justifyContent: 'center',
    marginRight: 9,
    width: 28,
  },
  indexText: { color: '#39D98A', fontSize: 13, fontWeight: '900' },
  routineNameWrap: { flex: 1 },
  exerciseName: { color: '#EAF2FF', fontSize: 15, fontWeight: '800' },
  exerciseDescription: { color: '#7C8AA0', fontSize: 11, marginTop: 2 },
  iconActions: { flexDirection: 'row', gap: 5 },
  iconButton: {
    alignItems: 'center',
    backgroundColor: '#030405',
    borderColor: '#1E2630',
    borderRadius: 7,
    borderWidth: 1,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  iconText: { color: '#39D98A', fontSize: 16, fontWeight: '900' },
  removeText: { color: '#FF6B4A', fontSize: 21, lineHeight: 21 },
  disabledText: { opacity: 0.28 },
  targetRow: { alignItems: 'center', flexDirection: 'row', gap: 18, justifyContent: 'center' },
  stepButton: {
    alignItems: 'center',
    backgroundColor: '#030405',
    borderColor: '#1E2630',
    borderRadius: 10,
    borderWidth: 1,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  stepText: { color: '#39D98A', fontSize: 26, fontWeight: '800' },
  targetBox: { alignItems: 'center', minWidth: 96 },
  targetValue: { color: '#EAF2FF', fontSize: 40, fontWeight: '900' },
  targetUnit: { color: '#7C8AA0', fontSize: 12 },
  premiumHint: { color: '#7C8AA0', fontSize: 11, marginBottom: 8 },
  filters: { gap: 8, paddingBottom: 10 },
  filter: {
    backgroundColor: '#0D1117',
    borderColor: '#1E2630',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  filterActive: { backgroundColor: '#39D98A', borderColor: '#39D98A' },
  filterText: { color: '#9FB0C6', fontSize: 12, fontWeight: '800' },
  filterTextActive: { color: '#030405' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  exerciseCard: {
    backgroundColor: '#0D1117',
    borderColor: '#1E2630',
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 132,
    padding: 13,
    width: '48%',
  },
  exerciseCardAdded: { borderColor: '#39D98A' },
  exerciseCardLocked: { opacity: 0.5 },
  cardTop: { alignItems: 'center', flexDirection: 'row', minHeight: 18 },
  dot: { borderRadius: 99, height: 7, marginRight: 5, width: 7 },
  cardZone: {
    color: '#7C8AA0',
    flex: 1,
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  premium: { color: '#F4C542', fontSize: 8, fontWeight: '900' },
  cardName: { color: '#EAF2FF', fontSize: 14, fontWeight: '900', marginTop: 14 },
  cardMeta: { color: '#9FB0C6', fontSize: 11, marginTop: 4 },
  cardAction: { color: '#39D98A', fontSize: 10, fontWeight: '900', marginTop: 15 },
  rankingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 22,
  },
  rankingCopy: { flex: 1, marginRight: 12 },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#39D98A',
    borderRadius: 999,
    marginTop: 20,
    paddingVertical: 14,
  },
  primaryText: { color: '#06210F', fontSize: 14, fontWeight: '900', letterSpacing: 1.4 },
  secondaryButton: {
    alignItems: 'center',
    borderColor: '#1E2630',
    borderRadius: 999,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 14,
  },
  secondaryText: { color: '#EAF2FF', fontSize: 13, fontWeight: '900', letterSpacing: 1 },
  actions: { flexDirection: 'row', gap: 9, marginTop: 16 },
  guide: { color: '#9FB0C6', fontSize: 13, lineHeight: 19, marginTop: 10 },
  introCard: {
    backgroundColor: '#0D1117',
    borderColor: '#1E2630',
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 9,
    padding: 14,
  },
  introHead: { alignItems: 'center', flexDirection: 'row', gap: 9 },
  target: { color: '#39D98A', fontSize: 12, fontWeight: '800', marginLeft: 'auto' },
  backButton: { alignItems: 'center', paddingVertical: 14 },
  backText: { color: '#39D98A', fontSize: 12, fontWeight: '800', letterSpacing: 1 },
});

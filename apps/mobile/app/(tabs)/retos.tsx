import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, ScrollView, Text, View } from 'react-native';
import { colors, radius, spacing } from '@resiliencia/design-tokens';
import { usePrefs } from '../../src/prefs/PrefsProvider';
import { getRepo } from '../../src/repo';
import { EXERCISES, exerciseDescKey, exerciseNameKey } from '../../src/retos/catalog';
import { isCompleted } from '../../src/retos/completions';
import { buildWeek } from '../../src/retos/week';
import { translate } from '../../src/i18n/translations';
import type { TranslationKey } from '../../src/i18n/translations';

const WEEKDAYS: TranslationKey[] = [
  'weekday.sun',
  'weekday.mon',
  'weekday.tue',
  'weekday.wed',
  'weekday.thu',
  'weekday.fri',
  'weekday.sat',
];

export default function RetosScreen() {
  const { prefs } = usePrefs();
  const lang = prefs?.language ?? 'es';
  const goal = prefs?.goal ?? 'mantener';
  const daysPerWeek = prefs?.daysPerWeek ?? 4;
  const repo = getRepo();
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<string | null>(null);

  const week = useMemo(() => buildWeek(goal, daysPerWeek), [goal, daysPerWeek]);

  useEffect(() => {
    (async () => {
      const result: Record<string, boolean> = {};
      for (const day of week) {
        result[day.date] = await isCompleted(repo, day.date);
      }
      setDone(result);
      const today = week.find((d) => d.isToday);
      if (today) setSelected(today.date);
    })();
  }, [week, repo]);

  const selectedDay = week.find((d) => d.date === selected) ?? week.find((d) => d.isToday);
  const selectedExercise = selectedDay?.exerciseId
    ? EXERCISES.find((e) => e.id === selectedDay.exerciseId)
    : undefined;
  const selectedUnit = selectedExercise?.unit === 'reps' ? 'unit.reps' : 'unit.seconds';

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <Text style={styles.title}>{translate(lang, 'retos.title')}</Text>
      <View style={styles.planChip}>
        <Text style={styles.planChipText}>
          {translate(lang, 'retos.plan_days', { n: daysPerWeek })}
        </Text>
      </View>

      <View style={styles.weekRow}>
        {week.map((day) => (
          <Pressable
            key={day.date}
            onPress={() => setSelected(day.date)}
            style={[
              styles.weekCell,
              day.isTraining ? styles.weekCellTraining : styles.weekCellRest,
              day.isToday && styles.weekCellToday,
              day.date === selected && day.isToday && styles.weekCellSelectedToday,
            ]}
          >
            <Text
              style={[
                styles.weekLabel,
                day.isTraining ? styles.weekLabelTraining : styles.weekLabelRest,
                day.isToday && styles.weekLabelToday,
              ]}
            >
              {translate(lang, WEEKDAYS[day.dayOfWeek])}
            </Text>
            {done[day.date] ? <View style={styles.dotDone} /> : null}
            {day.date === selected && !day.isToday ? <View style={styles.dotSelected} /> : null}
          </Pressable>
        ))}
      </View>

      {selectedDay ? (
        <View style={styles.card}>
          {selectedDay.isTraining ? (
            <>
              {selectedDay.isToday ? (
                <Text style={styles.cardToday}>{translate(lang, 'retos.today')}</Text>
              ) : null}
              <Text style={styles.cardTitle}>
                {selectedExercise ? translate(lang, exerciseNameKey(selectedExercise.id)) : '—'}
              </Text>
              {selectedExercise ? (
                <Text style={styles.cardDesc}>
                  {translate(lang, exerciseDescKey(selectedExercise.id))}
                </Text>
              ) : null}
              <Text style={styles.cardTarget}>
                {translate(lang, 'challenge.meta', {
                  target: selectedDay.target ?? 0,
                  unit: translate(lang, selectedUnit),
                })}
              </Text>
              {selectedDay.isToday ? (
                <Text style={styles.cardNote}>
                  {translate(lang, 'challenge.note')}
                  {'\n'}
                  {translate(lang, 'challenge.rotation')}
                </Text>
              ) : null}
            </>
          ) : (
            <>
              <Text style={styles.cardTitle}>{translate(lang, 'retos.rest')}</Text>
              <Text style={styles.cardNote}>{translate(lang, 'retos.rest_note')}</Text>
            </>
          )}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  container: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  title: {
    color: colors.silver,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 1,
  },
  planChip: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  planChipText: {
    color: colors.silverDim,
    fontSize: 12,
    letterSpacing: 1,
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xl,
  },
  weekCell: {
    width: 36,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekCellTraining: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
  },
  weekCellRest: {
    backgroundColor: colors.bg,
    borderColor: colors.line,
  },
  weekCellToday: {
    borderColor: colors.teal,
  },
  weekCellSelectedToday: {
    backgroundColor: colors.teal,
  },
  weekLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  weekLabelTraining: {
    color: colors.silver,
  },
  weekLabelRest: {
    color: colors.silverDim,
  },
  weekLabelToday: {
    color: colors.bg,
  },
  dotDone: {
    position: 'absolute',
    bottom: 4,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.teal,
  },
  dotSelected: {
    position: 'absolute',
    bottom: 4,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.cyan,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    marginTop: spacing.xl,
    padding: spacing.lg,
  },
  cardToday: {
    color: colors.teal,
    fontSize: 12,
    letterSpacing: 2,
  },
  cardTitle: {
    color: colors.silver,
    fontSize: 24,
    fontWeight: '800',
    marginTop: spacing.sm,
  },
  cardDesc: {
    color: colors.silverDim,
    fontSize: 13,
    marginTop: spacing.xs,
  },
  cardTarget: {
    color: colors.teal,
    fontSize: 32,
    fontWeight: '800',
    marginTop: spacing.xs,
  },
  cardNote: {
    color: colors.silverDim,
    fontSize: 13,
    lineHeight: 19,
    marginTop: spacing.md,
  },
});

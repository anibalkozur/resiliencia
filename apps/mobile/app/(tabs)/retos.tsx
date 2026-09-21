import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, ScrollView, Text, View } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { WebView } from 'react-native-webview';
import { colors, radius, spacing } from '@resiliencia/design-tokens';
import { usePrefs } from '../../src/prefs/PrefsProvider';
import { useAuth } from '../../src/auth/AuthProvider';
import { getRepo } from '../../src/repo';
import { EXERCISES, exerciseDescKey, exerciseNameKey } from '../../src/retos/catalog';
import { isCompleted, markCompleted } from '../../src/retos/completions';
import { buildWeek } from '../../src/retos/week';
import { getTodayChallenge, todayKey } from '../../src/retos/service';
import { buildVerifyUri } from '../../src/retos/verify';
import { syncAfterLogin } from '../../src/sync/syncService';
import { translate } from '../../src/i18n/translations';
import type { TranslationKey } from '../../src/i18n/translations';
import type { DailyChallenge } from '../../src/retos/types';

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
  const router = useRouter();
  const { prefs } = usePrefs();
  const { session } = useAuth();
  const lang = prefs?.language ?? 'es';
  const goal = prefs?.goal ?? 'mantener';
  const daysPerWeek = prefs?.daysPerWeek ?? 4;
  const repo = getRepo();
  const [challenge, setChallenge] = useState<DailyChallenge | null>(null);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<string | null>(null);

  const week = useMemo(() => buildWeek(goal, daysPerWeek), [goal, daysPerWeek]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const result: Record<string, boolean> = {};
        for (const day of week) {
          result[day.date] = await isCompleted(repo, day.date);
        }
        const todayChallenge = await getTodayChallenge(repo);
        if (!active) return;
        setDone(result);
        setChallenge(todayChallenge);
        const today = week.find((d) => d.isToday);
        if (today) setSelected(today.date);
      })();
      return () => {
        active = false;
      };
    }, [week, repo]),
  );

  const selectedDay = week.find((d) => d.date === selected) ?? week.find((d) => d.isToday);
  const selectedExercise = selectedDay?.exerciseId
    ? EXERCISES.find((e) => e.id === selectedDay.exerciseId)
    : undefined;
  const selectedUnit = selectedExercise?.unit === 'reps' ? 'unit.reps' : 'unit.seconds';

  const challengeExercise = challenge
    ? EXERCISES.find((e) => e.id === challenge.exerciseId)
    : undefined;
  const date = todayKey();
  const challengeDone = done[date] ?? false;

  const handleMessage = useCallback(
    (event: any) => {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type !== 'complete') return;
      const reps = Number(data.reps) || 0;
      const target = challenge?.target ?? 0;
      if (reps >= target) {
        void markCompleted(repo, date);
        setDone((prev) => ({ ...prev, [date]: true }));
        if (session) {
          void syncAfterLogin(repo, session.user.id);
        }
      }
    },
    [repo, challenge, date, session],
  );

  return (
    <View style={styles.screen}>
      <ScrollView style={styles.headerScroll} contentContainerStyle={styles.container}>
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

      {challenge && challengeExercise ? (
        <View style={styles.cameraSection}>
          {challengeDone ? (
            <View style={[styles.cameraCard, styles.cameraCardDone]}>
              <Text style={styles.cameraDoneText}>{translate(lang, 'home.completed')}</Text>
              <Pressable style={styles.cameraCta} onPress={() => router.push('/(tabs)/camretos')}>
                <Text style={styles.cameraCtaText}>{translate(lang, 'cam.free_after_done')}</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.cameraCard}>
              <Text style={styles.cameraTitle}>
                {translate(lang, 'cam.challenge')} ·{' '}
                {translate(lang, exerciseNameKey(challengeExercise.id))}
              </Text>
              <Text style={styles.cameraMeta}>
                {challenge.target} {challengeExercise.unit === 'reps' ? 'reps' : 'seg'}
              </Text>
              <WebView
                originWhitelist={['*']}
                source={{
                  uri: buildVerifyUri(
                    challenge.exerciseId,
                    challenge.target,
                    challengeExercise.unit,
                  ),
                }}
                cacheEnabled={false}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                allowsInlineMediaPlayback={true}
                mediaPlaybackRequiresUserAction={false}
                onMessage={handleMessage}
                style={styles.webView}
              />
            </View>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  headerScroll: {
    flexShrink: 1,
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
  cameraSection: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  cameraCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
  },
  cameraCardDone: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraTitle: {
    color: colors.silver,
    fontSize: 18,
    fontWeight: '800',
  },
  cameraMeta: {
    color: colors.teal,
    fontSize: 30,
    fontWeight: '800',
    marginTop: spacing.xs,
  },
  webView: {
    flex: 1,
    marginTop: spacing.md,
    borderRadius: radius.lg,
  },
  cameraDoneText: {
    color: colors.teal,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 2,
    textAlign: 'center',
  },
  cameraCta: {
    backgroundColor: colors.teal,
    borderRadius: radius.pill,
    alignItems: 'center',
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
  },
  cameraCtaText: {
    color: colors.bg,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 2,
  },
});

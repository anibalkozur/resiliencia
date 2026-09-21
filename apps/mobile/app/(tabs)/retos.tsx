import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { WebView } from 'react-native-webview';
import { colors, radius, spacing } from '@resiliencia/design-tokens';
import { usePrefs } from '../../src/prefs/PrefsProvider';
import { useAuth } from '../../src/auth/AuthProvider';
import { getRepo } from '../../src/repo';
import { EXERCISES, exerciseNameKey } from '../../src/retos/catalog';
import { isCompleted, markCompleted } from '../../src/retos/completions';
import { buildWeek } from '../../src/retos/week';
import { getTodayChallenge, todayKey } from '../../src/retos/service';
import { buildVerifyUri } from '../../src/retos/verify';
import { syncAfterLogin } from '../../src/sync/syncService';
import { translate } from '../../src/i18n/translations';
import { useCameraRestart } from '../../src/retos/useCameraRestart';
import { useDayKey } from '../../src/retos/DayProvider';
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
  const dayKey = useDayKey();
  const [challenge, setChallenge] = useState<DailyChallenge | null>(null);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const restartKey = useCameraRestart();

  const week = useMemo(
    () => buildWeek(goal, daysPerWeek, new Date(`${dayKey}T00:00:00`)),
    [goal, daysPerWeek, dayKey],
  );

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
      })();
      return () => {
        active = false;
      };
    }, [week, repo]),
  );

  const challengeExercise = challenge
    ? EXERCISES.find((e) => e.id === challenge.exerciseId)
    : undefined;
  const date = todayKey();
  const challengeDone = done[date] ?? false;
  const today = week.find((d) => d.isToday);
  const trainingToday = today?.isTraining ?? false;

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

  const challengeBlock = challenge && challengeExercise && trainingToday;

  return (
    <View style={styles.screen}>
      <View style={styles.topSection}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{translate(lang, 'retos.title')}</Text>
          <Text style={styles.planSmall}>
            {translate(lang, 'retos.plan_small', { n: daysPerWeek })}
          </Text>
        </View>
        <View style={styles.weekRow}>
          {week.map((day) => (
            <View
              key={day.date}
              style={[
                styles.weekCell,
                day.isTraining ? styles.weekCellTraining : styles.weekCellRest,
                day.isToday && styles.weekCellToday,
                done[day.date] && styles.weekCellDone,
              ]}
            >
              <Text
                style={[
                  styles.weekLabel,
                  done[day.date]
                    ? styles.weekLabelDone
                    : day.isToday
                      ? styles.weekLabelToday
                      : null,
                ]}
              >
                {translate(lang, WEEKDAYS[day.dayOfWeek])}
              </Text>
              {done[day.date] ? <View style={styles.dotDone} /> : null}
            </View>
          ))}
        </View>
      </View>

      {challengeBlock ? (
        <View style={styles.cameraContainer}>
          {challengeDone ? (
            <View style={styles.doneBox}>
              <Text style={styles.cameraDoneText}>{translate(lang, 'home.completed')}</Text>
              <Pressable style={styles.cameraCta} onPress={() => router.push('/(tabs)/camretos')}>
                <Text style={styles.cameraCtaText}>{translate(lang, 'cam.free_after_done')}</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.challengeBar}>
                <Text style={styles.cameraTitle}>
                  {translate(lang, 'cam.challenge')} ·{' '}
                  {translate(lang, exerciseNameKey(challengeExercise.id))}
                </Text>
                <Text style={styles.cameraMeta}>
                  {challenge.target} {challengeExercise.unit === 'reps' ? 'reps' : 'seg'}
                </Text>
              </View>
              <WebView
                key={`stream-${restartKey}`}
                originWhitelist={['*']}
                source={{
                  uri: buildVerifyUri(
                    challenge.exerciseId,
                    challenge.target,
                    challengeExercise.unit,
                  ),
                }}
                javaScriptEnabled={true}
                domStorageEnabled={true}
                allowsInlineMediaPlayback={true}
                mediaPlaybackRequiresUserAction={false}
                onMessage={handleMessage}
                style={styles.webView}
              />
            </>
          )}
        </View>
      ) : today && !trainingToday ? (
        <View style={styles.cameraContainer}>
          <View style={styles.restBox}>
            <Text style={styles.restTitle}>{translate(lang, 'retos.rest')}</Text>
            <Text style={styles.cameraDoneText}>{translate(lang, 'retos.rest_note')}</Text>
          </View>
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
  topSection: {
    paddingHorizontal: spacing.md,
  },
  titleRow: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  title: {
    color: colors.silver,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 1,
  },
  planSmall: {
    color: colors.silverDim,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  weekCell: {
    width: 34,
    height: 38,
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
    backgroundColor: colors.surface,
    borderColor: colors.line,
  },
  weekCellToday: {
    borderColor: colors.teal,
  },
  weekCellDone: {
    backgroundColor: colors.teal,
    borderColor: colors.teal,
  },
  weekLabel: {
    color: colors.silver,
    fontSize: 11,
    fontWeight: '700',
  },
  weekLabelToday: {
    color: colors.teal,
  },
  weekLabelDone: {
    color: colors.bg,
  },
  dotDone: {
    position: 'absolute',
    bottom: 3,
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.bg,
  },
  cameraContainer: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  challengeBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  cameraTitle: {
    color: colors.silver,
    fontSize: 16,
    fontWeight: '800',
    flexShrink: 1,
  },
  cameraMeta: {
    color: colors.teal,
    fontSize: 20,
    fontWeight: '800',
    marginLeft: spacing.sm,
  },
  webView: {
    flex: 1,
    borderRadius: radius.lg,
  },
  doneBox: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  restBox: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  restTitle: {
    color: colors.silver,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: spacing.md,
  },
  cameraDoneText: {
    color: colors.teal,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 1,
    textAlign: 'center',
  },
  cameraCta: {
    backgroundColor: colors.teal,
    borderRadius: radius.pill,
    alignItems: 'center',
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  cameraCtaText: {
    color: colors.bg,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 2,
  },
});

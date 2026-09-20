import { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { WebView } from 'react-native-webview';
import { colors, radius, spacing } from '@resiliencia/design-tokens';
import { useAuth } from '../../src/auth/AuthProvider';
import { usePrefs } from '../../src/prefs/PrefsProvider';
import { getRepo } from '../../src/repo';
import { markCompleted, isCompleted } from '../../src/retos/completions';
import { getTodayChallenge, todayKey } from '../../src/retos/service';
import { getCompletedCount } from '../../src/retos/streak';
import { syncAfterLogin } from '../../src/sync/syncService';
import { EXERCISES, exerciseNameKey, exerciseDescKey } from '../../src/retos/catalog';
import { translate } from '../../src/i18n/translations';
import type { DailyChallenge } from '../../src/retos/types';

const VERIFY_URL = 'https://anibalkozur.github.io/resiliencia/camera-verification.html';

export default function CamretoScreen() {
  const router = useRouter();
  const { prefs } = usePrefs();
  const { session } = useAuth();
  const repo = getRepo();
  const [challenge, setChallenge] = useState<DailyChallenge | null>(null);
  const [completed, setCompleted] = useState(false);
  const [count, setCount] = useState(0);
  const webViewRef = useRef<any>(null);

  const exercise = challenge ? EXERCISES.find((e) => e.id === challenge.exerciseId) : undefined;
  const lang = prefs?.language ?? 'es';
  const target = challenge?.target ?? 0;
  const unit = exercise?.unit ?? 'reps';

  useEffect(() => {
    async function load() {
      const date = todayKey();
      const alreadyDone = await isCompleted(repo, date);
      if (alreadyDone) setCompleted(true);
      const todayChallenge = await getTodayChallenge(repo);
      setChallenge(todayChallenge);
    }
    load();
  }, [repo]);

  const handleMessage = useCallback(
    (event: any) => {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'complete' && Number(data.reps) >= target) {
        const date = todayKey();
        void markCompleted(repo, date);
        void getCompletedCount(repo).then((cnt: number) => setCount(cnt));
        setCompleted(true);
        if (session) {
          void syncAfterLogin(repo, session.user.id);
        }
      }
    },
    [repo, session, target],
  );

  function handleClose() {
    router.back();
  }

  const verificationSource =
    challenge && exercise
      ? { uri: `${VERIFY_URL}?exercise=${exercise.id}&target=${target}&unit=${unit}` }
      : undefined;

  return (
    <View style={styles.container}>
      {challenge && exercise ? (
        <View style={styles.card}>
          <Text style={styles.exerciseName}>{translate(lang, exerciseNameKey(exercise.id))}</Text>
          <Text style={styles.exerciseDesc}>{translate(lang, exerciseDescKey(exercise.id))}</Text>
          <Text style={styles.target}>
            {target} {exercise?.unit === 'reps' ? 'reps' : 'seg'}
          </Text>
        </View>
      ) : null}
      <View style={styles.cameraContainer}>
        {completed ? (
          <View style={styles.resultContainer}>
            <Text style={styles.completeText}>RETO COMPLETADO</Text>
            <Text style={styles.resultCount}>{count} completadas</Text>
            <Pressable style={styles.cta} onPress={handleClose}>
              <Text style={styles.ctaText}>VOLVER</Text>
            </Pressable>
          </View>
        ) : challenge && exercise ? (
          <WebView
            ref={webViewRef}
            originWhitelist={['*']}
            source={verificationSource}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            allowsInlineMediaPlayback={true}
            mediaPlaybackRequiresUserAction={false}
            onMessage={handleMessage}
            style={styles.webView}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  cameraContainer: { flex: 1 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
    marginTop: spacing.md,
  },
  exerciseName: { color: colors.silver, fontSize: 24, fontWeight: '800' },
  exerciseDesc: { color: colors.silverDim, fontSize: 13, marginTop: spacing.xs },
  target: { color: colors.teal, fontSize: 32, fontWeight: '800', marginTop: spacing.xs },
  resultContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
  },
  completeText: { color: colors.teal, fontSize: 28, fontWeight: '800', letterSpacing: 2 },
  resultCount: { color: colors.silver, fontSize: 16, marginTop: spacing.md },
  cta: {
    backgroundColor: colors.teal,
    borderRadius: radius.pill,
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  ctaText: { color: colors.bg, fontSize: 15, fontWeight: '800', letterSpacing: 2 },
  webView: { flex: 1 },
});

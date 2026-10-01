// Banco de pruebas de ejercicios (solo para QA). App independiente: NO comparte
// código con apps/mobile, no escribe en Supabase y no toca la app real.
//
// Corre en Expo Go: el conteo se hace acá mismo con la cámara nativa
// (expo-camera, snapshots) + inclinación (expo-sensors), en lugar del WebView
// con MediaPipe que usa la app de producción.

import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { HomeScreen } from './screens/HomeScreen';
import { ReportScreen } from './screens/ReportScreen';
import { TestScreen } from './screens/TestScreen';
import { EXERCISES } from './lib/exercises';
import type { TestResult } from './lib/report';

export type Screen = { name: 'home' } | { name: 'test'; exerciseId: string } | { name: 'report' };

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const [results, setResults] = useState<TestResult[]>([]);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const onFinish = useCallback((r: TestResult) => {
    if (!mounted.current) return;
    setResults((prev) => [r, ...prev].slice(0, 20));
    setScreen({ name: 'report' });
  }, []);

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Text style={styles.title}>Banco de pruebas</Text>
        <Text style={styles.subtitle}>QA ejercicios libres · sin Supabase · sin ranking</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        style={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {screen.name === 'home' ? (
          <HomeScreen
            results={results}
            onSelect={(exerciseId) => setScreen({ name: 'test', exerciseId })}
            onReport={() => setScreen({ name: 'report' })}
          />
        ) : null}

        {screen.name === 'test' ? (
          <TestScreen
            exerciseId={screen.exerciseId}
            exercise={EXERCISES.find((e) => e.id === screen.exerciseId) ?? null}
            onExit={() => setScreen({ name: 'home' })}
            onFinish={onFinish}
          />
        ) : null}

        {screen.name === 'report' ? (
          <ReportScreen
            results={results}
            onBack={() => setScreen({ name: 'home' })}
            onSelect={(exerciseId) => setScreen({ name: 'test', exerciseId })}
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#030405' },
  scroll: { flex: 1 },
  header: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 8 },
  title: { color: '#EAF2FF', fontSize: 22, fontWeight: '700' },
  subtitle: { color: '#7C8AA0', fontSize: 12, marginTop: 2 },
  body: { paddingHorizontal: 18, paddingBottom: 40 },
});

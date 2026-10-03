// Banco de pruebas de ejercicios (solo para QA). App independiente: NO comparte
// código con apps/mobile, no escribe en Supabase y no toca la app real.
//
// Copia la ejecución de producción: monta camera-verification.html por URL en
// una WebView, con el mismo puente de inclinación (expo-sensors) y el mismo
// mensaje `complete`. La cámara, el modelo, el esqueleto y el conteo son los de
// la página, no una reimplementación.

import { StatusBar } from 'expo-status-bar';
import { useCallback, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

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

  const onRecorded = useCallback((r: TestResult) => {
    if (!mounted.current) return;
    setResults((prev) => [r, ...prev].slice(0, 20));
  }, []);

  const selected =
    screen.name === 'test' ? EXERCISES.find((e) => e.id === screen.exerciseId) : null;

  // La prueba va a PANTALLA COMPLETA, fuera del ScrollView: una WebView con
  // `flex: 1` dentro de un ScrollView colapsa a 0 px de alto y la cámara no se ve.
  if (screen.name === 'test' && selected) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
          <StatusBar style="light" />
          <TestScreen
            exerciseId={screen.exerciseId}
            exercise={selected}
            onExit={() => setScreen({ name: 'home' })}
            onRecorded={onRecorded}
          />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <StatusBar style="light" />
        <View style={styles.header}>
          <Text style={styles.title}>Banco de pruebas</Text>
          <Text style={styles.subtitle}>
            QA ejercicios · misma página que producción · sin Supabase
          </Text>
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

          {screen.name === 'report' ? (
            <ReportScreen
              results={results}
              onBack={() => setScreen({ name: 'home' })}
              onSelect={(exerciseId) => setScreen({ name: 'test', exerciseId })}
            />
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
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

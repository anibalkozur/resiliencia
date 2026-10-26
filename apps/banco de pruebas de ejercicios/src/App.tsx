// Banco de pruebas de ejercicios (solo para QA). App independiente: NO comparte
// código con apps/mobile, no escribe en Supabase y no toca la app real.
//
// Copia la ejecución de producción: monta camera-verification.html por URL en
// una WebView, con el mismo puente de inclinación (expo-sensors) y el mismo
// mensaje `complete`. La cámara, el modelo, el esqueleto y el conteo son los de
// la página, no una reimplementación.

import { StatusBar } from 'expo-status-bar';
import { useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { HomeScreen } from './screens/HomeScreen';
import { LibreScreen } from './screens/LibreScreen';
import { ReportScreen } from './screens/ReportScreen';
import { TestScreen } from './screens/TestScreen';
import { EXERCISES } from './lib/exercises';
import type { TestResult } from './lib/report';
import type { SequenceItem } from './lib/verify';

export type Screen =
  | { name: 'home' }
  | { name: 'libre' }
  | { name: 'test'; items: SequenceItem[]; ranked: boolean; skipSetup?: boolean }
  | { name: 'report' };

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const [results, setResults] = useState<TestResult[]>([]);
  const mounted = useRef(true);

  const onRecorded = useCallback((r: TestResult) => {
    if (!mounted.current) return;
    setResults((prev) => [r, ...prev].slice(0, 20));
  }, []);

  const startSingle = useCallback((exerciseId: string) => {
    const found = EXERCISES.find((e) => e.id === exerciseId);
    setScreen({
      name: 'test',
      items: [{ id: exerciseId, target: found?.target ?? 10 }],
      ranked: false,
    });
  }, []);

  const startSequence = useCallback((items: SequenceItem[], ranked: boolean, skipSetup = false) => {
    setScreen({ name: 'test', items, ranked, skipSetup });
  }, []);

  const items = screen.name === 'test' ? screen.items : null;

  // La prueba va a PANTALLA COMPLETA, fuera del ScrollView: una WebView con
  // `flex: 1` dentro de un ScrollView colapsa a 0 px de alto y la cámara no se ve.
  if (items && items.length > 0) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
          <StatusBar style="light" />
          <TestScreen
            items={items}
            ranked={screen.name === 'test' ? screen.ranked : false}
            skipSetup={screen.name === 'test' ? screen.skipSetup : false}
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

        <View style={styles.nav}>
          <Pressable
            style={[styles.navItem, screen.name === 'home' && styles.navItemActive]}
            onPress={() => setScreen({ name: 'home' })}
          >
            <Text style={[styles.navText, screen.name === 'home' && styles.navTextActive]}>
              PRUEBAS
            </Text>
          </Pressable>
          <Pressable
            style={[styles.navItem, screen.name === 'libre' && styles.navItemActive]}
            onPress={() => setScreen({ name: 'libre' })}
          >
            <Text style={[styles.navText, screen.name === 'libre' && styles.navTextActive]}>
              LIBRE
            </Text>
          </Pressable>
          <Pressable
            style={[styles.navItem, screen.name === 'report' && styles.navItemActive]}
            onPress={() => setScreen({ name: 'report' })}
          >
            <Text style={[styles.navText, screen.name === 'report' && styles.navTextActive]}>
              INFORME
            </Text>
          </Pressable>
        </View>

        {screen.name === 'libre' ? (
          <LibreScreen onStartSequence={startSequence} onBack={() => setScreen({ name: 'home' })} />
        ) : (
          <ScrollView
            contentContainerStyle={styles.body}
            style={styles.scroll}
            keyboardShouldPersistTaps="handled"
          >
            {screen.name === 'home' ? (
              <HomeScreen
                results={results}
                onSelect={startSingle}
                onStartSequence={startSequence}
                onReport={() => setScreen({ name: 'report' })}
              />
            ) : null}

            {screen.name === 'report' ? (
              <ReportScreen
                results={results}
                onBack={() => setScreen({ name: 'home' })}
                onSelect={startSingle}
              />
            ) : null}
          </ScrollView>
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#030405' },
  scroll: { flex: 1 },
  header: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 8 },
  nav: {
    borderBottomColor: '#1E2630',
    borderBottomWidth: 1,
    borderTopColor: '#1E2630',
    borderTopWidth: 1,
    flexDirection: 'row',
    paddingHorizontal: 12,
  },
  navItem: { alignItems: 'center', flex: 1, paddingVertical: 10 },
  navItemActive: { borderBottomColor: '#39D98A', borderBottomWidth: 2 },
  navText: { color: '#7C8AA0', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  navTextActive: { color: '#39D98A' },
  title: { color: '#EAF2FF', fontSize: 22, fontWeight: '700' },
  subtitle: { color: '#7C8AA0', fontSize: 12, marginTop: 2 },
  body: { paddingHorizontal: 18, paddingBottom: 40 },
});

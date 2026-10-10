import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, spacing } from '@resiliencia/design-tokens';

import { hablarVoz } from '../src/lib/voz';
import {
  ATAJOS,
  EDAD_MINIMA,
  nivelDesdeHabit,
  responder,
  type ChatPerfil,
  type ChatReply,
} from '../src/lib/chat';
import { GOAL_TRANSLATION_KEYS, translate } from '../src/i18n/translations';
import { usePrefs } from '../src/prefs/PrefsProvider';
import { habitScore } from '../src/user/service';
import { useUser } from '../src/user/UserProvider';
import type { UserProfile } from '../src/repo';

type Msg = { autor: 'user' | 'bot'; texto: string };

function perfilDelUsuario(profile: UserProfile | null, objetivo?: string): ChatPerfil {
  return {
    nombre: profile?.nickname?.trim().length ? (profile.nickname as string) : 'Atleta',
    edad: profile?.age,
    pesoKg: profile?.weight,
    alturaCm: profile?.height,
    objetivo,
    nivel: nivelDesdeHabit(habitScore(profile?.sports ?? [])),
  };
}

/**
 * El TTS y el STT son adaptadores: hoy la app corre en Expo Go, que no trae
 * reconocimiento de voz. El TTS está en `src/lib/voz` porque lo comparte
 * también el entrenador de voz del WebView, que avisa por `postMessage` en vez
 * de hablar desde la página.
 *
 * En una dev build (EAS o `expo run:android`) el STT se enchufa acá y el resto
 * no cambia: el dominio, el perfil y la puerta de edad ya son estos.
 */
export function ChatPanel() {
  const { profile } = useUser();
  const { prefs } = usePrefs();
  const lang = prefs?.language ?? 'es';
  const objetivo = prefs?.goal
    ? translate(lang, GOAL_TRANSLATION_KEYS[prefs.goal])
    : undefined;
  const perfil = perfilDelUsuario(profile, objetivo);

  const [msgs, setMsgs] = useState<Msg[]>([
    { autor: 'bot', texto: `Hola ${perfil.nombre}. Preguntame qué ejercicio toca hoy o cómo funciona la app.` },
  ]);
  const [texto, setTexto] = useState('');

  // El chat crece y nada se lee solo: cada mensaje nuevo baja la vista al
  // final, y el resize (teclado, respuestas largas) también.
  const scrollRef = useRef<ScrollView>(null);
  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [msgs]);
  const bajarAlFinal = useCallback(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, []);

  const enviar = useCallback(
    (consulta: string) => {
      const n = consulta.trim();
      if (!n) return;
      setTexto('');
      const res: ChatReply = responder(n, perfil);
      setMsgs((prev) => [...prev, { autor: 'user', texto: n }, { autor: 'bot', texto: res.texto }]);
      // Todo lo que `habla` sale por el TTS del teléfono con el mismo texto
      // que se muestra: los datos del perfil incluidos.
      if (res.habla) hablarVoz(res.texto);
    },
    [perfil],
  );

  const menor = perfil.edad != null && perfil.edad < EDAD_MINIMA;
  const sinEdad = perfil.edad == null;

  return (
    <View style={styles.box}>
      <ScrollView
        ref={scrollRef}
        style={styles.log}
        contentContainerStyle={styles.logContent}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={bajarAlFinal}
      >
        {msgs.map((m, i) => (
          <View key={i} style={m.autor === 'user' ? styles.burbujaUser : styles.burbujaBot}>
            <Text style={m.autor === 'user' ? styles.txtUser : styles.txtBot}>{m.texto}</Text>
          </View>
        ))}
      </ScrollView>

      {menor ? (
        <View style={styles.warn}>
          <Text style={styles.warnText}>
            El chat está bloqueado para menores de {EDAD_MINIMA}.
          </Text>
        </View>
      ) : null}
      {!menor && sinEdad ? (
        <View style={styles.warn}>
          <Text style={styles.warnText}>
            Completá tu edad en la pestaña Perfil para que pueda responderte sobre tus datos.
          </Text>
        </View>
      ) : null}

      <View style={styles.atajos}>
        {ATAJOS.map((a) => (
          <Pressable key={a.etiqueta} style={styles.atajo} onPress={() => enviar(a.consulta)}>
            <Text style={styles.atajoText}>{a.etiqueta}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.row}>
        <TextInput
          style={styles.input}
          value={texto}
          onChangeText={setTexto}
          onSubmitEditing={() => enviar(texto)}
          placeholder="Escribí tu consulta"
          placeholderTextColor={colors.silverDim}
          returnKeyType="send"
        />
        <Pressable style={styles.send} onPress={() => enviar(texto)} hitSlop={6}>
          <Text style={styles.sendText}>Enviar</Text>
        </Pressable>
      </View>
      <Text style={styles.nota}>
        Dominio cerrado: la app, los ejercicios, los modos y tus datos. Sin modelo todavía.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flex: 1,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  log: { flex: 1 },
  logContent: { paddingBottom: spacing.sm },
  warn: {
    backgroundColor: '#2a1f10',
    borderColor: '#F4C542',
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  warnText: { color: '#F4C542', fontSize: 12, lineHeight: 17 },
  burbujaUser: {
    alignSelf: 'flex-end',
    backgroundColor: '#1d5c3a',
    padding: spacing.sm,
    borderRadius: 10,
    marginBottom: 6,
    maxWidth: '88%',
  },
  burbujaBot: {
    alignSelf: 'flex-start',
    backgroundColor: colors.bg,
    borderColor: colors.line,
    borderWidth: 1,
    padding: spacing.sm,
    borderRadius: 10,
    marginBottom: 6,
    maxWidth: '88%',
  },
  txtUser: { color: colors.silver, fontSize: 13, lineHeight: 18 },
  txtBot: { color: '#9FB0C6', fontSize: 13, lineHeight: 18 },
  atajos: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.sm },
  atajo: {
    borderWidth: 1,
    borderColor: '#1d5c3a',
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  atajoText: { color: colors.teal, fontSize: 12, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  input: {
    flex: 1,
    backgroundColor: colors.bg,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: radius.sm,
    color: colors.silver,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 13,
  },
  send: {
    backgroundColor: colors.teal,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendText: { color: colors.bg, fontSize: 13, fontWeight: '800', letterSpacing: 1 },
  nota: { color: colors.silverDim, fontSize: 11, lineHeight: 15, marginTop: spacing.sm },
});
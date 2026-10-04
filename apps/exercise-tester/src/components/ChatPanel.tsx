import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  ATAJOS,
  EDAD_MINIMA,
  PERFIL_FALSO,
  responder,
  type ChatReply,
  type UserProfile,
} from '../lib/chat';

type Msg = { autor: 'user' | 'bot'; texto: string };

// El TTS y el STT son adaptadores: hoy el banco corre en Expo Go, que no trae
// reconocimiento de voz. `hablar()` degrada a texto si expo-speech no está, y
// el micrófono avisa en vez de fingir que escuchó.
//
// En una dev build (EAS o `expo run:android`) el STT se enchufa acá y el resto
// no cambia: el dominio, el perfil y la puerta de edad ya son estos.
type Voz = { hablar: (t: string) => void; disponible: boolean };

async function crearVoz(): Promise<Voz> {
  try {
    const mod = await import('expo-speech');
    if (mod && typeof mod.speak === 'function') {
      return {
        disponible: true,
        hablar: (t: string) => {
          mod.stop();
          mod.speak(t, { language: 'es-ES', rate: 1.05 });
        },
      };
    }
  } catch {
    // expo-speech no está en este runtime: seguimos solo con texto.
  }
  return { disponible: false, hablar: () => {} };
}

export function ChatPanel({ perfil = PERFIL_FALSO }: { perfil?: UserProfile }) {
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      autor: 'bot',
      texto: `Hola ${perfil.nombre}. Preguntame cómo se hace un ejercicio o cómo funciona la app.`,
    },
  ]);
  const [texto, setTexto] = useState('');
  const vozRef = useRef<Voz | null>(null);

  const enviar = useCallback(
    (consulta: string) => {
      const n = consulta.trim();
      if (!n) return;
      setTexto('');
      const res: ChatReply = responder(n, perfil);
      setMsgs((prev) => [...prev, { autor: 'user', texto: n }, { autor: 'bot', texto: res.texto }]);
      // Los datos del perfil van solo en texto: el TTS de Android es cloud y
      // decir el peso por ahí manda el dato fuera del teléfono.
      if (res.habla) {
        void crearVoz().then((v) => {
          vozRef.current = v;
          v.hablar(res.texto);
        });
      }
    },
    [perfil],
  );

  const mayor = perfil.edad >= EDAD_MINIMA;

  return (
    <View style={styles.box}>
      <Text style={styles.title}>Entrenador</Text>
      <Text style={styles.hint}>
        Dominio cerrado: la app, los ejercicios, los modos y tus datos. Sin modelo todavía, así que
        no puede inventar. Perfil de prueba: {perfil.nombre}, {perfil.edad} años, nivel{' '}
        {perfil.nivel}.
      </Text>

      {!mayor ? (
        <View style={styles.warn}>
          <Text style={styles.warnText}>
            El chat está bloqueado para menores de {EDAD_MINIMA}. Con este perfil solo responde la
            puerta de edad.
          </Text>
        </View>
      ) : null}

      <View style={styles.log}>
        {msgs.map((m, i) => (
          <View key={i} style={m.autor === 'user' ? styles.burbujaUser : styles.burbujaBot}>
            <Text style={m.autor === 'user' ? styles.txtUser : styles.txtBot}>{m.texto}</Text>
          </View>
        ))}
      </View>

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
          placeholderTextColor="#5b6b7c"
          returnKeyType="send"
        />
        <Pressable style={styles.mic} onPress={() => enviar('hola')} hitSlop={6}>
          <Text style={styles.micText}>🎙</Text>
        </Pressable>
      </View>
      <Text style={styles.nota}>
        El micrófono está deshabilitado a propósito: Expo Go no trae reconocimiento de voz. Con una
        dev build se enchufa sin tocar el dominio.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: '#0A0F15',
    borderColor: '#1E2630',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 14,
  },
  title: { color: '#EAF2FF', fontSize: 15, fontWeight: '700', marginBottom: 4 },
  hint: { color: '#7C8AA0', fontSize: 12, lineHeight: 17, marginBottom: 10 },
  warn: {
    backgroundColor: '#2a1f10',
    borderColor: '#F4C542',
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    marginBottom: 10,
  },
  warnText: { color: '#F4C542', fontSize: 12, lineHeight: 17 },
  log: { marginBottom: 10 },
  burbujaUser: {
    alignSelf: 'flex-end',
    backgroundColor: '#1d5c3a',
    padding: 8,
    borderRadius: 10,
    marginBottom: 6,
    maxWidth: '88%',
  },
  burbujaBot: {
    alignSelf: 'flex-start',
    backgroundColor: '#0D1117',
    borderColor: '#1E2630',
    borderWidth: 1,
    padding: 8,
    borderRadius: 10,
    marginBottom: 6,
    maxWidth: '88%',
  },
  txtUser: { color: '#EAF2FF', fontSize: 13, lineHeight: 18 },
  txtBot: { color: '#9FB0C6', fontSize: 13, lineHeight: 18 },
  atajos: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  atajo: {
    borderWidth: 1,
    borderColor: '#1d5c3a',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  atajoText: { color: '#39D98A', fontSize: 12, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    flex: 1,
    backgroundColor: '#0D1117',
    borderColor: '#1E2630',
    borderWidth: 1,
    borderRadius: 8,
    color: '#EAF2FF',
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 13,
  },
  mic: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2b3644',
    backgroundColor: '#0D1117',
    alignItems: 'center',
    justifyContent: 'center',
  },
  micText: { fontSize: 16, opacity: 0.4 },
  nota: { color: '#5b6b7c', fontSize: 11, lineHeight: 15, marginTop: 8 },
});

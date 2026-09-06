import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, spacing } from '@resiliencia/design-tokens';
import { getRepo } from '../../src/repo';

export default function PerfilScreen() {
  const [nickname, setNickname] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState(false);
  const repo = getRepo();

  useEffect(() => {
    repo.getProfile().then((profile) => {
      if (profile) {
        setNickname(profile.nickname);
      }
      setLoaded(true);
    });
  }, [repo]);

  const handleSave = useCallback(async () => {
    const existing = await repo.getProfile();
    await repo.saveProfile({
      id: existing?.id ?? 'u1',
      nickname: nickname.trim() || 'Atleta',
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    });
    setSaved(true);
  }, [nickname, repo]);

  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>RESILIENCIA</Text>
      <Text style={styles.title}>PERFIL</Text>
      <Text style={styles.caption}>Tu perfil, estadisticas y progreso.</Text>
      {loaded && (
        <View style={styles.card}>
          <Text style={styles.label}>APODO</Text>
          <TextInput
            style={styles.input}
            value={nickname}
            onChangeText={setNickname}
            placeholder="Tu apodo"
            placeholderTextColor={colors.silverDim}
          />
          <Pressable
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
            onPress={handleSave}
          >
            <Text style={styles.buttonText}>GUARDAR</Text>
          </Pressable>
          {saved && <Text style={styles.saved}>Guardado en este dispositivo</Text>}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  eyebrow: {
    color: colors.teal,
    fontSize: 12,
    letterSpacing: 4,
    marginBottom: spacing.sm,
  },
  title: {
    color: colors.silver,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 1,
  },
  caption: {
    color: colors.silverDim,
    fontSize: 16,
    marginTop: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    marginTop: spacing.xl,
    padding: spacing.lg,
  },
  label: {
    color: colors.silverDim,
    fontSize: 12,
    letterSpacing: 2,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.bg,
    borderColor: colors.line,
    borderRadius: radius.sm,
    borderWidth: 1,
    color: colors.silver,
    fontSize: 16,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  button: {
    alignItems: 'center',
    backgroundColor: colors.teal,
    borderRadius: radius.sm,
    marginTop: spacing.md,
    paddingVertical: spacing.md,
  },
  buttonPressed: {
    opacity: 0.7,
  },
  buttonText: {
    color: colors.bg,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 2,
  },
  saved: {
    color: colors.teal,
    fontSize: 13,
    marginTop: spacing.sm,
  },
});

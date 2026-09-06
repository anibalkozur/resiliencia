import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '@resiliencia/design-tokens';

export default function ScreenShell({
  title,
  caption,
}: {
  title: string;
  caption: string;
}) {
  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>RESILIENCIA</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.caption}>{caption}</Text>
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
});
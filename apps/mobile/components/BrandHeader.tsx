import { Image, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '@resiliencia/design-tokens';

const logo = require('../assets/brand/logo.png');

export default function BrandHeader() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
      <Image source={logo} style={styles.logo} resizeMode="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'flex-start',
    backgroundColor: colors.bg,
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    justifyContent: 'center',
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  logo: {
    height: 36,
    width: 46,
  },
});

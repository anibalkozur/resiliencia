import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '@resiliencia/design-tokens';
import { usePrefs } from '../src/prefs/PrefsProvider';
import { translate } from '../src/i18n/translations';
import { useLibreExercise } from '../src/header/LibreExerciseProvider';
import { useDayKey } from '../src/retos/DayProvider';

const logo = require('../assets/brand/logo.png');

function sectionForPath(pathname: string): string | null {
  if (pathname === '/' || pathname === '/(tabs)' || pathname === '') return 'home';
  if (pathname.includes('camretos')) return 'libre';
  if (pathname.includes('retos')) return 'retos';
  if (pathname.includes('progreso')) return 'progreso';
  if (pathname.includes('perfil')) return 'perfil';
  if (pathname.includes('ajustes')) return 'ajustes';
  return null;
}

function displayDate(d: Date, lang: string): string {
  const locale = lang === 'en' ? 'en-US' : lang === 'pt' ? 'pt-BR' : 'es-AR';
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

export default function BrandHeader() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const { prefs } = usePrefs();
  const { routine, libreActive, salir, retosActive, salirRetos } = useLibreExercise();
  useDayKey();
  const lang = prefs?.language ?? 'es';
  const section = sectionForPath(pathname);

  return (
    <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
      <Image source={logo} style={styles.logo} resizeMode="contain" />
      {section === 'home' ? (
        <Text style={[styles.text, styles.textStrong, styles.homeIdentity]} numberOfLines={1}>
          {displayDate(new Date(), lang)}
        </Text>
      ) : null}
      {section === 'retos' ? (
        <>
          <Text style={[styles.text, styles.textStrong]}>{translate(lang, 'header.reto')}</Text>
          {retosActive ? (
            <Pressable
              style={styles.exitBtn}
              onPress={salirRetos}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={translate(lang, 'cam.exit')}
            >
              <Text style={styles.exitBtnText}>{translate(lang, 'cam.exit')}</Text>
            </Pressable>
          ) : null}
        </>
      ) : null}
      {section === 'progreso' ? (
        <Text style={[styles.text, styles.textStrong]}>{translate(lang, 'progress.title')}</Text>
      ) : null}
      {section === 'perfil' ? (
        <Text style={[styles.text, styles.textStrong]}>{translate(lang, 'profile.title')}</Text>
      ) : null}
      {section === 'ajustes' ? (
        <Text style={[styles.text, styles.textStrong]}>{translate(lang, 'settings.title')}</Text>
      ) : null}
      {section === 'libre' ? (
        <>
          <View style={styles.routineChip}>
            <Text style={[styles.text, styles.routineChipText]} numberOfLines={1}>
              {translate(lang, 'cam.free_routine', { n: String(routine.length) })}
            </Text>
          </View>
          {libreActive ? (
            <Pressable
              style={styles.exitBtn}
              onPress={salir}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={translate(lang, 'cam.exit')}
            >
              <Text style={styles.exitBtnText}>{translate(lang, 'cam.exit')}</Text>
            </Pressable>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  logo: {
    height: 36,
    width: 46,
  },
  text: {
    color: colors.silverDim,
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  textStrong: {
    color: colors.silver,
    fontSize: 15,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  homeIdentity: {
    color: colors.teal,
    flex: 1,
    fontSize: 12,
    letterSpacing: 1,
    textAlign: 'right',
  },
  routineChip: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radius.sm,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  routineChipText: {
    color: colors.silver,
    fontSize: 14,
    fontWeight: '700',
  },
  exitBtn: {
    marginLeft: 'auto',
    backgroundColor: colors.ember,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  exitBtnText: {
    color: colors.bg,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
  },
});

import { useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '@resiliencia/design-tokens';
import { usePrefs } from '../src/prefs/PrefsProvider';
import { useUser } from '../src/user/UserProvider';
import { EXERCISES, exerciseNameKey } from '../src/retos/catalog';
import { translate } from '../src/i18n/translations';
import { greetingKey } from '../src/i18n/greeting';
import { useLibreExercise } from '../src/header/LibreExerciseProvider';

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

export default function BrandHeader() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const { prefs } = usePrefs();
  const { profile } = useUser();
  const { libreExerciseId, setLibreExerciseId } = useLibreExercise();
  const lang = prefs?.language ?? 'es';
  const section = sectionForPath(pathname);

  return (
    <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
      <Image source={logo} style={styles.logo} resizeMode="contain" />
      {section === 'home' ? (
        <Text style={styles.text} numberOfLines={1}>
          {translate(lang, greetingKey(new Date().getHours()), {
            name: profile?.nickname ?? 'Atleta',
          })}
        </Text>
      ) : null}
      {section === 'retos' ? (
        <Text style={[styles.text, styles.textStrong]}>{translate(lang, 'header.reto')}</Text>
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
        <LibrePicker
          lang={lang}
          exerciseId={libreExerciseId}
          onSelect={setLibreExerciseId}
          insetsTop={insets.top + spacing.sm}
        />
      ) : null}
    </View>
  );
}

function LibrePicker({
  lang,
  exerciseId,
  onSelect,
  insetsTop,
}: {
  lang: 'es' | 'en' | 'pt';
  exerciseId: string;
  onSelect: (id: string) => void;
  insetsTop: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable style={styles.picker} onPress={() => setOpen(true)}>
        <Text style={[styles.text, styles.pickerText]} numberOfLines={1}>
          {translate(lang, exerciseNameKey(exerciseId))}
        </Text>
        <Text style={styles.pickerCaret}>▾</Text>
      </Pressable>
      <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <View style={[styles.menu, { paddingTop: insetsTop + spacing.sm }]}>
            <Text style={styles.menuTitle}>{translate(lang, 'header.pick_exercise')}</Text>
            {EXERCISES.map((e) => (
              <Pressable
                key={e.id}
                style={[styles.menuItem, e.id === exerciseId && styles.menuItemActive]}
                onPress={() => {
                  onSelect(e.id);
                  setOpen(false);
                }}
              >
                <Text
                  style={[styles.menuItemText, e.id === exerciseId && styles.menuItemTextActive]}
                >
                  {translate(lang, exerciseNameKey(e.id))}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
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
  picker: {
    alignItems: 'center',
    borderColor: colors.line,
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: 'row',
    maxWidth: 240,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  pickerText: {
    color: colors.silver,
    fontSize: 14,
    fontWeight: '700',
  },
  pickerCaret: {
    color: colors.teal,
    fontSize: 13,
    marginLeft: 6,
  },
  overlay: {
    alignItems: 'center',
  },
  menu: {
    alignSelf: 'stretch',
    backgroundColor: colors.surface,
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  menuTitle: {
    color: colors.silverDim,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
  },
  menuItem: {
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  menuItemActive: {
    backgroundColor: colors.line,
  },
  menuItemText: {
    color: colors.silver,
    fontSize: 15,
    fontWeight: '600',
  },
  menuItemTextActive: {
    color: colors.teal,
    fontWeight: '800',
  },
});

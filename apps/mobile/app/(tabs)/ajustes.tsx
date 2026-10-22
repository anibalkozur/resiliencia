import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { colors, radius, spacing } from '@resiliencia/design-tokens';
import PerfilPanel from '../../components/PerfilPanel';
import { usePrefs } from '../../src/prefs/PrefsProvider';
import { useAuth } from '../../src/auth/AuthProvider';
import { getSupabase } from '../../src/auth/supabase';
import { getRepo } from '../../src/repo';
import { resetCloudProgress, resetLocalProgress } from '../../src/retos/reset';
import { LANGUAGE_OPTIONS } from '../../src/prefs/service';
import { translate } from '../../src/i18n/translations';
import type { TranslationKey } from '../../src/i18n/translations';
import type { Language } from '../../src/prefs/types';
import { useUser } from '../../src/user/UserProvider';

const DAY_ORDER: { label: TranslationKey; value: number }[] = [
  { label: 'weekday.mon', value: 1 },
  { label: 'weekday.tue', value: 2 },
  { label: 'weekday.wed', value: 3 },
  { label: 'weekday.thu', value: 4 },
  { label: 'weekday.fri', value: 5 },
  { label: 'weekday.sat', value: 6 },
  { label: 'weekday.sun', value: 0 },
];

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.chip,
        active && styles.chipActive,
        pressed && styles.chipPressed,
      ]}
      onPress={onPress}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

export default function AjustesScreen() {
  const { prefs, updatePrefs } = usePrefs();
  const { session, signOut } = useAuth();
  const { profile, avatarUri, setAvatarUri } = useUser();
  const lang = prefs?.language ?? 'es';
  const [perfilOpen, setPerfilOpen] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);

  const email = session?.user?.email ?? null;
  const displayName = profile?.nickname?.trim() || email?.split('@')[0] || 'Atleta';
  const avatarLetter = displayName.charAt(0).toUpperCase();

  async function pickAvatar(source: 'gallery' | 'camera') {
    if (avatarBusy || !profile?.id) return;
    setAvatarBusy(true);

    try {
      let result: ImagePicker.ImagePickerResult;
      if (source === 'gallery') {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          Alert.alert(
            translate(lang, 'settings.photo_permission_title'),
            translate(lang, 'settings.photo_permission_gallery'),
          );
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
          exif: false,
        });
      } else {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          Alert.alert(
            translate(lang, 'settings.photo_permission_title'),
            translate(lang, 'settings.photo_permission_camera'),
          );
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
          exif: false,
        });
      }

      if (result.canceled || !result.assets[0]?.uri) return;
      await setAvatarUri(result.assets[0].uri);
    } catch (err) {
      console.warn('[ajustes] avatar:', err);
      Alert.alert(
        translate(lang, 'settings.photo_error_title'),
        translate(lang, 'settings.photo_error_body'),
      );
    } finally {
      setAvatarBusy(false);
    }
  }

  function removeCurrentAvatar() {
    if (avatarBusy || !avatarUri) return;
    setAvatarBusy(true);
    void setAvatarUri(null)
      .catch((err) => {
        console.warn('[ajustes] remove avatar:', err);
        Alert.alert(
          translate(lang, 'settings.photo_error_title'),
          translate(lang, 'settings.photo_error_body'),
        );
      })
      .finally(() => setAvatarBusy(false));
  }

  function openAvatarMenu() {
    if (avatarBusy || !profile?.id) return;
    const buttons: Parameters<typeof Alert.alert>[2] = [
      {
        text: translate(lang, 'settings.choose_gallery'),
        onPress: () => void pickAvatar('gallery'),
      },
      { text: translate(lang, 'settings.take_photo'), onPress: () => void pickAvatar('camera') },
    ];
    if (avatarUri) {
      buttons.push({
        text: translate(lang, 'settings.remove_photo'),
        style: 'destructive',
        onPress: removeCurrentAvatar,
      });
    }
    buttons.push({ text: translate(lang, 'settings.reset_cancel'), style: 'cancel' });
    Alert.alert(
      translate(lang, 'settings.photo_menu_title'),
      translate(lang, 'settings.photo_menu_body'),
      buttons,
    );
  }

  function toggleTrainingDay(day: number) {
    if (!prefs) return;
    const has = prefs.trainingDays.includes(day);
    if (has && prefs.trainingDays.length === 1) return;
    const trainingDays = has
      ? prefs.trainingDays.filter((d) => d !== day)
      : [...prefs.trainingDays, day].sort((a, b) => a - b);
    void updatePrefs({ trainingDays });
  }

  function confirmReset() {
    Alert.alert(
      translate(lang, 'settings.reset_confirm_title'),
      translate(lang, 'settings.reset_confirm'),
      [
        { text: translate(lang, 'settings.reset_cancel'), style: 'cancel' },
        {
          text: translate(lang, 'settings.reset_ok'),
          style: 'destructive',
          onPress: () => {
            const client = getSupabase();
            void (async () => {
              try {
                await resetLocalProgress(getRepo());
                if (client && session) {
                  await resetCloudProgress(client);
                }
                Alert.alert(
                  translate(lang, 'settings.reset_confirm_title'),
                  client && session
                    ? translate(lang, 'settings.reset_done')
                    : translate(lang, 'settings.reset_local_only'),
                );
              } catch (err) {
                console.warn('[ajustes] reset:', err);
                Alert.alert(
                  translate(lang, 'settings.reset_confirm_title'),
                  client && session
                    ? translate(lang, 'settings.reset_error')
                    : translate(lang, 'settings.reset_local_only'),
                );
              }
            })();
          },
        },
      ],
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.intro}>
        <Text style={styles.kicker}>{translate(lang, 'settings.title')}</Text>
        <Text style={styles.introTitle}>{translate(lang, 'settings.subtitle')}</Text>
      </View>

      <View style={styles.avatarCard}>
        <View style={styles.avatarWrap}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarLetter}>{avatarLetter}</Text>
          )}
        </View>
        <View style={styles.avatarCopy}>
          <Text style={styles.cardEyebrow}>{translate(lang, 'settings.profile_photo')}</Text>
          <Text style={styles.avatarName} numberOfLines={1}>
            {displayName}
          </Text>
          <Text style={styles.hint}>{translate(lang, 'settings.profile_photo_hint')}</Text>
          <Pressable
            style={({ pressed }) => [styles.primaryAction, pressed && styles.chipPressed]}
            onPress={openAvatarMenu}
            disabled={avatarBusy || !profile?.id}
            accessibilityRole="button"
          >
            <Text style={styles.primaryActionText}>
              {avatarBusy
                ? translate(lang, 'settings.photo_saving')
                : translate(lang, 'settings.change_photo')}
            </Text>
          </Pressable>
        </View>
      </View>

      <Pressable
        style={styles.profileHeader}
        onPress={() => setPerfilOpen((open) => !open)}
        accessibilityRole="button"
        accessibilityState={{ expanded: perfilOpen }}
      >
        <View>
          <Text style={styles.profileHeaderText}>{translate(lang, 'settings.profile')}</Text>
          <Text style={styles.profileHeaderHint}>
            {translate(lang, 'settings.profile_photo_hint')}
          </Text>
        </View>
        <Text style={styles.profileHeaderChevron}>{perfilOpen ? '▾' : '▸'}</Text>
      </Pressable>
      {perfilOpen ? (
        <View style={styles.profilePanel}>
          <PerfilPanel />
        </View>
      ) : null}
      {prefs && (
        <View style={styles.body}>
          <View style={styles.sectionBlock}>
            <Text style={styles.section}>{translate(lang, 'settings.days')}</Text>
            <Text style={styles.hint}>{translate(lang, 'settings.days_hint')}</Text>
            <View style={styles.daysRow}>
              {DAY_ORDER.map(({ label, value }) => {
                const active = prefs.trainingDays.includes(value);
                return (
                  <Pressable
                    key={value}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    style={({ pressed }) => [
                      styles.dayChip,
                      active && styles.dayChipActive,
                      pressed && styles.chipPressed,
                    ]}
                    onPress={() => toggleTrainingDay(value)}
                  >
                    <Text style={[styles.dayChipText, active && styles.dayChipTextActive]}>
                      {translate(lang, label)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.sectionBlock}>
            <Text style={styles.section}>{translate(lang, 'settings.language')}</Text>
            <View style={styles.row}>
              {LANGUAGE_OPTIONS.map((option) => (
                <Chip
                  key={option.code}
                  label={option.label}
                  active={prefs.language === option.code}
                  onPress={() => updatePrefs({ language: option.code as Language })}
                />
              ))}
            </View>
          </View>

          <View style={styles.sectionBlock}>
            <Text style={styles.section}>{translate(lang, 'settings.account')}</Text>
            <Text style={styles.accountLine}>
              {translate(lang, 'settings.logged_as', { email: email ?? '' })}
            </Text>
            <Pressable
              style={({ pressed }) => [styles.action, pressed && styles.chipPressed]}
              onPress={() => signOut()}
            >
              <Text style={styles.actionText}>{translate(lang, 'settings.logout')}</Text>
            </Pressable>
          </View>
          <View style={styles.sectionBlockDanger}>
            <Text style={styles.section}>{translate(lang, 'settings.reset')}</Text>
            <Text style={styles.accountLine}>{translate(lang, 'settings.reset_desc')}</Text>
            <Pressable
              style={({ pressed }) => [styles.actionDanger, pressed && styles.chipPressed]}
              onPress={confirmReset}
            >
              <Text style={styles.actionDangerText}>{translate(lang, 'settings.reset')}</Text>
            </Pressable>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  container: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  intro: {
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.xs,
  },
  kicker: {
    color: colors.teal,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2.5,
  },
  introTitle: {
    color: colors.silver,
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 27,
    marginTop: spacing.xs,
  },
  avatarCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    padding: spacing.md,
  },
  avatarWrap: {
    alignItems: 'center',
    backgroundColor: colors.teal,
    borderColor: colors.cyan,
    borderRadius: 44,
    borderWidth: 1,
    height: 88,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 88,
  },
  avatarImage: {
    height: 86,
    width: 86,
  },
  avatarLetter: {
    color: colors.bg,
    fontSize: 34,
    fontWeight: '900',
  },
  avatarCopy: {
    flex: 1,
    marginLeft: spacing.md,
  },
  cardEyebrow: {
    color: colors.teal,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.6,
  },
  avatarName: {
    color: colors.silver,
    fontSize: 18,
    fontWeight: '800',
    marginTop: spacing.xs,
  },
  primaryAction: {
    alignSelf: 'flex-start',
    backgroundColor: colors.teal,
    borderRadius: radius.pill,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  primaryActionText: {
    color: colors.bg,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  body: {
    marginTop: spacing.sm,
  },
  profileHeader: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    padding: spacing.lg,
  },
  profilePanel: {
    marginTop: spacing.sm,
  },
  profileHeaderText: {
    color: colors.silver,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
  },
  profileHeaderChevron: {
    color: colors.teal,
    fontSize: 16,
    fontWeight: '800',
  },
  profileHeaderHint: {
    color: colors.silverDim,
    fontSize: 12,
    marginTop: spacing.xs,
  },
  sectionBlock: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radius.md,
    borderWidth: 1,
    marginTop: spacing.md,
    padding: spacing.md,
  },
  sectionBlockDanger: {
    backgroundColor: colors.surface,
    borderColor: 'rgba(255, 107, 107, 0.35)',
    borderRadius: radius.md,
    borderWidth: 1,
    marginTop: spacing.md,
    padding: spacing.md,
  },
  section: {
    color: colors.silverDim,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  daysRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  dayChip: {
    alignItems: 'center',
    borderColor: colors.line,
    borderRadius: radius.pill,
    borderWidth: 1,
    flex: 1,
    paddingVertical: spacing.sm,
  },
  dayChipActive: {
    borderColor: colors.teal,
    backgroundColor: '#0D272A',
  },
  dayChipText: {
    color: colors.silverDim,
    fontSize: 13,
  },
  dayChipTextActive: {
    color: colors.teal,
    fontWeight: '700',
  },
  chip: {
    borderColor: colors.line,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  chipActive: {
    borderColor: colors.teal,
    backgroundColor: '#0D272A',
  },
  chipPressed: {
    opacity: 0.7,
  },
  chipText: {
    color: colors.silverDim,
    fontSize: 14,
  },
  chipTextActive: {
    color: colors.teal,
    fontWeight: '700',
  },
  hint: {
    color: colors.silverDim,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: spacing.sm,
  },
  accountLine: {
    color: colors.silverDim,
    fontSize: 13,
    marginBottom: spacing.sm,
  },
  action: {
    alignItems: 'center',
    borderColor: colors.line,
    borderRadius: radius.sm,
    borderWidth: 1,
    marginRight: spacing.sm,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  actionText: {
    color: colors.silver,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
  },
  actionDanger: {
    alignItems: 'center',
    borderColor: colors.line,
    borderRadius: radius.sm,
    borderWidth: 1,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  actionDangerText: {
    color: '#ff6b6b',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
  },
});

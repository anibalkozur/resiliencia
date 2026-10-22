import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '@resiliencia/design-tokens';
import { usePrefs } from '../src/prefs/PrefsProvider';
import { usePremium } from '../src/premium/usePremium';
import { translate } from '../src/i18n/translations';

const BENEFITS = [
  'plans.benefit_daily',
  'plans.benefit_exercises',
  'plans.benefit_ranking',
] as const;

export default function PlanesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { prefs } = usePrefs();
  const lang = prefs?.language ?? 'es';
  const premium = usePremium();

  function handleInterest() {
    Alert.alert(translate(lang, 'plans.coming_title'), translate(lang, 'plans.coming_body'), [
      { text: translate(lang, 'plans.close') },
    ]);
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.sm }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable
            style={styles.backButton}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel={translate(lang, 'plans.back')}
          >
            <Text style={styles.backText}>‹</Text>
          </Pressable>
          <Text style={styles.headerLabel}>RESILIENCIA</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.hero}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>PREMIUM</Text>
          </View>
          <Text style={styles.title}>{translate(lang, 'plans.title')}</Text>
          <Text style={styles.subtitle}>{translate(lang, 'plans.subtitle')}</Text>
        </View>

        <View style={styles.benefits}>
          {BENEFITS.map((key) => (
            <View key={key} style={styles.benefitRow}>
              <View style={styles.check}>
                <Text style={styles.checkText}>✓</Text>
              </View>
              <Text style={styles.benefitText}>{translate(lang, key)}</Text>
            </View>
          ))}
        </View>

        <View style={[styles.planCard, styles.annualCard]}>
          <View style={styles.planTopRow}>
            <Text style={styles.planName}>{translate(lang, 'plans.annual')}</Text>
            <View style={styles.valueBadge}>
              <Text style={styles.valueBadgeText}>{translate(lang, 'plans.best_value')}</Text>
            </View>
          </View>
          <View style={styles.priceRow}>
            <Text style={styles.price}>US$19.99</Text>
            <Text style={styles.period}>{translate(lang, 'plans.per_year')}</Text>
          </View>
          <Text style={styles.trial}>{translate(lang, 'plans.trial')}</Text>
          <Pressable
            style={styles.primaryButton}
            onPress={handleInterest}
            accessibilityRole="button"
          >
            <Text style={styles.primaryButtonText}>
              {translate(lang, premium ? 'plans.active' : 'plans.notify')}
            </Text>
          </Pressable>
        </View>

        <View style={styles.planCard}>
          <Text style={styles.planName}>{translate(lang, 'plans.monthly')}</Text>
          <View style={styles.priceRow}>
            <Text style={styles.priceSmall}>US$2.99</Text>
            <Text style={styles.period}>{translate(lang, 'plans.per_month')}</Text>
          </View>
          <Text style={styles.planNote}>{translate(lang, 'plans.monthly_note')}</Text>
        </View>

        <Text style={styles.disclaimer}>{translate(lang, 'plans.disclaimer')}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.bg,
    flex: 1,
  },
  content: {
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.md,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  backButton: {
    alignItems: 'center',
    borderColor: colors.line,
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  backText: {
    color: colors.silver,
    fontSize: 30,
    lineHeight: 32,
    marginTop: -4,
  },
  headerLabel: {
    color: colors.teal,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
  },
  headerSpacer: {
    width: 40,
  },
  hero: {
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xxl,
  },
  badge: {
    backgroundColor: colors.teal,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  badgeText: {
    color: colors.bg,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
  },
  title: {
    color: colors.silver,
    fontSize: 32,
    fontWeight: '900',
    marginTop: spacing.md,
    textAlign: 'center',
  },
  subtitle: {
    color: colors.silverDim,
    fontSize: 15,
    lineHeight: 23,
    marginTop: spacing.sm,
    maxWidth: 330,
    textAlign: 'center',
  },
  benefits: {
    marginTop: spacing.xl,
  },
  benefitRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  check: {
    alignItems: 'center',
    backgroundColor: 'rgba(45, 212, 168, 0.14)',
    borderRadius: radius.pill,
    height: 26,
    justifyContent: 'center',
    marginRight: spacing.sm,
    width: 26,
  },
  checkText: {
    color: colors.teal,
    fontSize: 15,
    fontWeight: '900',
  },
  benefitText: {
    color: colors.silver,
    flex: 1,
    fontSize: 14,
  },
  planCard: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginTop: spacing.md,
    padding: spacing.lg,
  },
  annualCard: {
    backgroundColor: '#0D272A',
    borderColor: colors.teal,
  },
  planTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  planName: {
    color: colors.silver,
    fontSize: 17,
    fontWeight: '800',
  },
  valueBadge: {
    backgroundColor: colors.teal,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  valueBadgeText: {
    color: colors.bg,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  priceRow: {
    alignItems: 'baseline',
    flexDirection: 'row',
    marginTop: spacing.md,
  },
  price: {
    color: colors.silver,
    fontSize: 30,
    fontWeight: '900',
  },
  priceSmall: {
    color: colors.silver,
    fontSize: 25,
    fontWeight: '900',
  },
  period: {
    color: colors.silverDim,
    fontSize: 13,
    marginLeft: spacing.xs,
  },
  trial: {
    color: colors.teal,
    fontSize: 13,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  planNote: {
    color: colors.silverDim,
    fontSize: 13,
    marginTop: spacing.xs,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.teal,
    borderRadius: radius.pill,
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
  },
  primaryButtonText: {
    color: colors.bg,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1,
  },
  disclaimer: {
    color: colors.silverDim,
    fontSize: 12,
    lineHeight: 18,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
});

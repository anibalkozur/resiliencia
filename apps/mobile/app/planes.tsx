import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '@resiliencia/design-tokens';
import { usePrefs } from '../src/prefs/PrefsProvider';
import { usePremiumState } from '../src/premium/usePremium';
import { useAuth } from '../src/auth/AuthProvider';
import { translate } from '../src/i18n/translations';
import {
  getBillingOffers,
  isBillingConfigured,
  purchaseBillingPlan,
  restoreBillingPurchases,
  type BillingOffer,
  type BillingPlan,
} from '../src/premium/billing';

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
  const { session } = useAuth();
  const { active: premium, loading: premiumLoading, refresh } = usePremiumState();
  const [selectedPlan, setSelectedPlan] = useState<'annual' | 'monthly'>('annual');
  const [offers, setOffers] = useState<BillingOffer[]>([]);
  const [billingBusy, setBillingBusy] = useState(false);

  useEffect(() => {
    if (!session?.user?.id || !isBillingConfigured()) return;
    void getBillingOffers(session.user.id).then((result) => {
      if (result.ok) setOffers(result.offers);
    });
  }, [session?.user?.id]);

  async function handlePurchase(plan: BillingPlan) {
    if (!session?.user?.id) return;
    if (!isBillingConfigured()) {
      Alert.alert(translate(lang, 'plans.coming_title'), translate(lang, 'plans.preview_body'), [
        { text: translate(lang, 'plans.close') },
      ]);
      return;
    }
    setBillingBusy(true);
    const result = await purchaseBillingPlan(session.user.id, plan);
    setBillingBusy(false);
    if (result.ok) {
      await refresh();
      Alert.alert(
        translate(lang, 'plans.purchase_title'),
        translate(lang, 'plans.purchase_pending'),
        [{ text: translate(lang, 'plans.close') }],
      );
    } else if (result.code !== 'cancelled') {
      Alert.alert(
        translate(lang, 'plans.purchase_error_title'),
        translate(lang, 'plans.purchase_error'),
        [{ text: translate(lang, 'plans.close') }],
      );
    }
  }

  async function handleRestore() {
    if (!session?.user?.id || !isBillingConfigured()) {
      Alert.alert(translate(lang, 'plans.coming_title'), translate(lang, 'plans.preview_body'), [
        { text: translate(lang, 'plans.close') },
      ]);
      return;
    }
    setBillingBusy(true);
    const result = await restoreBillingPurchases(session.user.id);
    setBillingBusy(false);
    if (result.ok) {
      await refresh();
      Alert.alert(
        translate(lang, 'plans.restore_title'),
        translate(lang, 'plans.restore_pending'),
        [{ text: translate(lang, 'plans.close') }],
      );
    } else {
      Alert.alert(
        translate(lang, 'plans.purchase_error_title'),
        translate(lang, 'plans.purchase_error'),
        [{ text: translate(lang, 'plans.close') }],
      );
    }
  }

  function handleBack() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.xxl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable
            style={styles.headerBackButton}
            onPress={handleBack}
            accessibilityRole="button"
            accessibilityLabel={translate(lang, 'plans.back_to_app')}
          >
            <Text style={styles.headerBackButtonText}>‹</Text>
          </Pressable>
          <Text style={styles.headerLabel}>RESILIENCIA</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.hero}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>✦ PREMIUM ✦</Text>
          </View>
          <Text style={styles.title}>{translate(lang, 'plans.title')}</Text>
          <Text style={styles.subtitle}>{translate(lang, 'plans.subtitle')}</Text>
          <View style={styles.previewBanner}>
            <Text style={styles.previewBannerText}>
              {isBillingConfigured()
                ? translate(lang, 'plans.store_ready')
                : translate(lang, 'plans.preview_banner')}
            </Text>
          </View>
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

        <Text style={styles.sectionLabel}>
          {translate(
            lang,
            isBillingConfigured() ? 'plans.premium_includes_live' : 'plans.premium_includes',
          )}
        </Text>

        <Pressable
          style={[
            styles.planCard,
            styles.annualCard,
            selectedPlan === 'annual' && styles.selectedCard,
          ]}
          onPress={() => setSelectedPlan('annual')}
          accessibilityRole="radio"
          accessibilityState={{ selected: selectedPlan === 'annual' }}
          accessibilityLabel={translate(lang, 'plans.annual')}
        >
          <View style={styles.planTopRow}>
            <Text style={styles.planName}>{translate(lang, 'plans.annual')}</Text>
            <View style={styles.valueBadge}>
              <Text style={styles.valueBadgeText}>{translate(lang, 'plans.best_value')}</Text>
            </View>
          </View>
          <View style={styles.priceRow}>
            <Text style={styles.price}>
              {offers.find((offer) => offer.plan === 'annual')?.priceString ??
                (isBillingConfigured() ? translate(lang, 'plans.price_loading') : 'US$19.99')}
            </Text>
            <Text style={styles.period}>{translate(lang, 'plans.per_year')}</Text>
          </View>
          <Text style={styles.trial}>
            {translate(lang, isBillingConfigured() ? 'plans.trial_live' : 'plans.trial')}
          </Text>
          <Pressable
            style={[styles.primaryButton, (premiumLoading || premium) && styles.disabledButton]}
            onPress={() => void handlePurchase('annual')}
            disabled={premiumLoading || premium || billingBusy}
            accessibilityRole="button"
            accessibilityLabel={translate(lang, 'plans.demo_cta')}
          >
            <Text style={styles.primaryButtonText}>
              {translate(
                lang,
                premiumLoading || billingBusy
                  ? 'plans.loading'
                  : premium
                    ? 'plans.active'
                    : isBillingConfigured()
                      ? 'plans.purchase_cta'
                      : 'plans.demo_cta',
              )}
            </Text>
          </Pressable>
        </Pressable>

        <Pressable
          style={[styles.planCard, selectedPlan === 'monthly' && styles.selectedCard]}
          onPress={() => setSelectedPlan('monthly')}
          accessibilityRole="radio"
          accessibilityState={{ selected: selectedPlan === 'monthly' }}
          accessibilityLabel={translate(lang, 'plans.monthly')}
        >
          <Text style={styles.planName}>{translate(lang, 'plans.monthly')}</Text>
          <View style={styles.priceRow}>
            <Text style={styles.priceSmall}>
              {offers.find((offer) => offer.plan === 'monthly')?.priceString ??
                (isBillingConfigured() ? translate(lang, 'plans.price_loading') : 'US$2.99')}
            </Text>
            <Text style={styles.period}>{translate(lang, 'plans.per_month')}</Text>
          </View>
          <Text style={styles.planNote}>
            {translate(
              lang,
              isBillingConfigured() ? 'plans.monthly_note_live' : 'plans.monthly_note',
            )}
          </Text>
          <Pressable
            style={[styles.secondaryButton, (premiumLoading || premium) && styles.disabledButton]}
            onPress={() => void handlePurchase('monthly')}
            disabled={premiumLoading || premium || billingBusy}
            accessibilityRole="button"
            accessibilityLabel={translate(lang, 'plans.demo_cta')}
          >
            <Text style={styles.secondaryButtonText}>
              {isBillingConfigured()
                ? translate(lang, 'plans.purchase_cta')
                : translate(lang, 'plans.demo_cta')}
            </Text>
          </Pressable>
        </Pressable>

        <Text style={styles.freeNote}>{translate(lang, 'plans.free_note')}</Text>

        <Pressable
          style={[styles.restoreButton, billingBusy && styles.disabledButton]}
          onPress={() => void handleRestore()}
          disabled={billingBusy}
          accessibilityRole="button"
          accessibilityLabel={translate(lang, 'plans.restore')}
        >
          <Text style={styles.restoreButtonText}>{translate(lang, 'plans.restore')}</Text>
        </Pressable>

        <Text style={styles.disclaimer}>
          {translate(lang, isBillingConfigured() ? 'plans.live_disclaimer' : 'plans.disclaimer')}
        </Text>

        <Pressable
          style={styles.bottomBackButton}
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel={translate(lang, 'plans.back_to_app')}
        >
          <Text style={styles.bottomBackButtonText}>{translate(lang, 'plans.back_to_app')}</Text>
        </Pressable>
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
  headerBackButton: {
    alignItems: 'center',
    backgroundColor: colors.teal,
    borderRadius: radius.pill,
    height: 34,
    justifyContent: 'center',
    width: 42,
  },
  headerBackButtonText: {
    color: colors.bg,
    fontSize: 30,
    fontWeight: '900',
    lineHeight: 32,
    marginTop: -4,
  },
  headerSpacer: {
    width: 42,
  },
  headerLabel: {
    color: colors.teal,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
  },
  hero: {
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
  },
  badge: {
    backgroundColor: colors.teal,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  badgeText: {
    color: colors.bg,
    fontSize: 14,
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
  previewBanner: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: colors.line,
    borderRadius: radius.md,
    borderWidth: 1,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  previewBannerText: {
    color: colors.silver,
    fontSize: 12,
    lineHeight: 18,
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
  sectionLabel: {
    color: colors.silverDim,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginTop: spacing.xl,
    textTransform: 'uppercase',
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
  selectedCard: {
    borderWidth: 2,
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
  disabledButton: {
    opacity: 0.55,
  },
  secondaryButton: {
    alignItems: 'center',
    borderColor: colors.teal,
    borderRadius: radius.pill,
    borderWidth: 1,
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
  },
  secondaryButtonText: {
    color: colors.teal,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  freeNote: {
    color: colors.silverDim,
    fontSize: 13,
    lineHeight: 19,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  disclaimer: {
    color: colors.silverDim,
    fontSize: 12,
    lineHeight: 18,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  restoreButton: {
    alignItems: 'center',
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
  },
  restoreButtonText: {
    color: colors.teal,
    fontSize: 13,
    fontWeight: '800',
  },
  bottomBackButton: {
    alignItems: 'center',
    backgroundColor: colors.teal,
    borderRadius: radius.pill,
    marginTop: spacing.xl,
    paddingVertical: spacing.md,
  },
  bottomBackButtonText: {
    color: colors.bg,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1,
  },
});

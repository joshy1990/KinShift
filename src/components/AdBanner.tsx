/**
 * Ad Banner Component
 * Displays Google AdMob banner ads based on subscription tier and household settings.
 *
 * Position: Bottom of screen, above tab navigation
 * Size: Full width, standard banner height (50dp)
 *
 * Ad Display Logic (Option 3 — household-aware):
 * - Free tier users: Always see ads
 * - Standard admin: Doesn't see ads, but household members do
 * - Premium user OR admin: Nobody in the household sees ads
 *
 * Graceful degradation:
 * - If the native AdMob SDK isn't linked (e.g., web, dev client without
 *   react-native-google-mobile-ads), a subtle placeholder is shown instead.
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, Platform } from 'react-native';
import { BannerAdSize, getBannerAdUnitId, isAdMobAvailable } from '@/services/admob.service';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { subscriptionService } from '@/services/subscription.service';

interface AdBannerProps {
  /** Current user ID (if not using context) */
  userId?: string;
  /** Current household admin ID */
  adminId?: string;
  /** Is current user the household admin? */
  isAdmin?: boolean;
}

/**
 * Renders a Google AdMob banner when the native SDK is linked,
 * otherwise renders a minimal placeholder.
 */
export const AdBanner: React.FC<AdBannerProps> = ({
  userId,
  adminId,
  isAdmin = false,
}) => {
  const subscription = useSubscription();
  const [adminSubscription, setAdminSubscription] = useState<any>(null);
  const [shouldShowAds, setShouldShowAds] = useState(false);
  const [adError, setAdError] = useState(false);

  const { width } = Dimensions.get('window');
  const isMobile = width < 768;
  const adHeight = isMobile ? 50 : 60;

  // Fetch admin subscription when adminId changes
  useEffect(() => {
    if (!adminId) return;

    const fetchAdminSub = async () => {
      try {
        const adminSub = await subscriptionService.getUserSubscription(adminId);
        setAdminSubscription(adminSub);
      } catch (error) {
        console.error('[AdBanner] Failed to get admin subscription:', error);
      }
    };

    fetchAdminSub();
  }, [adminId]);

  // Determine if ads should be shown (household-aware logic)
  useEffect(() => {
    if (!subscription.currentTier) {
      setShouldShowAds(false);
      return;
    }

    const userSubscription: any = {
      tier: subscription.currentTier,
      status: 'active',
    };

    if (adminSubscription) {
      const show = subscriptionService.shouldShowAdsInHousehold(
        userSubscription,
        adminSubscription,
        isAdmin,
      );
      setShouldShowAds(show);
    } else {
      // No admin info yet — fall back to user-only check
      const show = subscriptionService.shouldShowAds(userSubscription, isAdmin);
      setShouldShowAds(show);
    }
  }, [subscription.currentTier, adminSubscription, isAdmin]);

  // Don't render anything if ads shouldn't be shown
  if (!shouldShowAds) {
    return null;
  }

  // ── Native AdMob banner ────────────────────────────────────────────────
  if (isAdMobAvailable() && !adError) {
    try {
      const { BannerAd, BannerAdSize: NativeBannerSize, } =
        require('react-native-google-mobile-ads');

      const adUnitId = getBannerAdUnitId(false);

      return (
        <View style={[styles.container, { height: adHeight }]} testID="ad-banner">
          <BannerAd
            unitId={adUnitId}
            size={NativeBannerSize.ANCHORED_ADAPTIVE_BANNER}
            requestOptions={{ requestNonPersonalizedAdsOnly: true }}
            onAdFailedToLoad={(error: any) => {
              console.warn('[AdBanner] Ad failed to load:', error);
              setAdError(true);
            }}
          />
        </View>
      );
    } catch {
      // Native module not available — fall through to placeholder
    }
  }

  // ── Fallback placeholder (dev builds / web / ad load failure) ──────────
  return (
    <View
      style={[styles.container, { height: adHeight }]}
      testID="ad-banner-placeholder"
    >
      <View style={styles.adPlaceholder}>
        <Text style={styles.adPlaceholderText}>
          {adError ? 'Ad unavailable' : 'Advertisement'}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: '#1A1A2E',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  adPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  adPlaceholderText: {
    color: '#555',
    fontSize: 11,
  },
});

export default AdBanner;

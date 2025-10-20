/**
 * Ad Banner Component
 * Displays ads based on subscription tier and household settings
 * 
 * Position: Bottom of screen, above tab navigation
 * Size: Full width, responsive height (50-70px)
 * 
 * Ad Display Logic (Option 3):
 * - Free tier users: Always see ads
 * - Standard admin: Doesn't see ads, but members do
 * - Premium user OR admin: Nobody sees ads (household perk)
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { subscriptionService } from '@/services/subscription.service';

interface AdBannerProps {
  /** Whether to show placeholder */
  showPlaceholder?: boolean;
  /** Current user ID (if not using context) */
  userId?: string;
  /** Current household admin ID */
  adminId?: string;
  /** Is current user the household admin? */
  isAdmin?: boolean;
}

/**
 * AdBanner Component
 * Displays ad banner based on subscription tier with household-aware logic
 * 
 * Usage:
 * ```tsx
 * import {AdBanner} from '@/components/AdBanner';
 * 
 * const MyScreen = () => {
 *   const { household } = useHousehold();
 *   const user = useAuth().user;
 *   
 *   return (
 *     <View style={{flex: 1}}>
 *       <ScrollView>...</ScrollView>
 *       <AdBanner 
 *         userId={user.id}
 *         adminId={household.adminId}
 *         isAdmin={user.id === household.adminId}
 *       />
 *     </View>
 *   );
 * };
 * ```
 */
export const AdBanner: React.FC<AdBannerProps> = ({ 
  showPlaceholder = true,
  userId,
  adminId,
  isAdmin = false,
}) => {
  const subscription = useSubscription();
  const [adminSubscription, setAdminSubscription] = useState(null);
  const [shouldShowAds, setShouldShowAds] = useState(false);
  
  const { width } = Dimensions.get('window');
  const isMobile = width < 768;
  const isTablet = width >= 768 && width < 1024;
  
  // Responsive ad height
  const adHeight = isMobile ? 50 : isTablet ? 60 : 70;
  
  // Fetch admin subscription on mount/adminId change
  useEffect(() => {
    const fetchAdminSub = async () => {
      if (!adminId) return;
      
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
    if (!subscription.currentTier || !adminSubscription) {
      setShouldShowAds(false);
      return;
    }
    
    // Convert currentTier to Subscription object for compatibility
    const userSubscription: any = {
      tier: subscription.currentTier,
      status: 'active',
    };
    
    // Use new household-aware logic
    const show = subscriptionService.shouldShowAdsInHousehold(
      userSubscription,
      adminSubscription,
      isAdmin
    );
    
    setShouldShowAds(show);
  }, [subscription.currentTier, adminSubscription, isAdmin]);
  
  // Don't render if ads shouldn't be shown
  if (!shouldShowAds && !showPlaceholder) {
    // Return empty space for ads (when integrated with real ads)
    return <View style={{ height: adHeight }} />;
  }
  
  // Return nothing if not showing ads and not showing placeholder
  if (!shouldShowAds) {
    return null;
  }
  
  // Placeholder design
  return (
    <View style={[
      styles.container,
      { 
        height: adHeight,
      }
    ]}>
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>📢 Advertisement</Text>
        <Text style={styles.placeholderSmallText}>
          {isMobile ? '320×50' : isTablet ? '728×60' : '970×90'} Ad Space
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
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  placeholder: {
    width: '100%',
    backgroundColor: '#0F1729',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(99, 102, 241, 0.3)',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  placeholderText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6366F1',
    marginBottom: 1,
  },
  placeholderSmallText: {
    fontSize: 10,
    color: '#A1A1AA',
    fontStyle: 'italic',
  },
});

export default AdBanner;

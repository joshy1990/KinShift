/**
 * Ad Banner Component
 * Placeholder for future AdMob/similar integration
 * 
 * Position: Bottom of screen, above tab navigation
 * Size: Full width, responsive height (50-70px)
 */

import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';

interface AdBannerProps {
  /** Whether to show placeholder */
  showPlaceholder?: boolean;
}

/**
 * AdBanner Component
 * Displays ad banner or placeholder at bottom of screen
 * 
 * Usage:
 * ```tsx
 * import {AdBanner} from '@/components/AdBanner';
 * import {useSafeAreaInsets} from 'react-native-safe-area-context';
 * 
 * const MyScreen = () => {
 *   const insets = useSafeAreaInsets();
 *   return (
 *     <View style={{flex: 1}}>
 *       <ScrollView>...</ScrollView>
 *       <AdBanner safeAreaBottom={insets.bottom} showPlaceholder={true} />
 *     </View>
 *   );
 * };
 * ```
 */
export const AdBanner: React.FC<AdBannerProps> = ({ 
  showPlaceholder = true 
}) => {
  const { width } = Dimensions.get('window');
  const isMobile = width < 768;
  const isTablet = width >= 768 && width < 1024;
  
  // Responsive ad height
  const adHeight = isMobile ? 50 : isTablet ? 60 : 70;
  
  if (!showPlaceholder) {
    // Return empty space for ads (when integrated with real ads)
    return <View style={{ height: adHeight }} />;
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

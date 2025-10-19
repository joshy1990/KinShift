/**
 * Bottom Spacing Utility
 * Ensures proper spacing at the bottom of screens to accommodate:
 * - Tab navigation bar
 * - Android system buttons
 * - Future ad banners
 * - Safe area insets
 */

import { Dimensions, Platform, StatusBar } from 'react-native';

export interface BottomSpacingConfig {
  /** Space for tab bar */
  navBarHeight: number;
  /** Additional space for ads/banners */
  adBannerSpace: number;
  /** Total space needed */
  totalSpace: number;
  /** Safe area bottom padding */
  safeAreaBottom: number;
}

/**
 * Calculate responsive bottom spacing based on device
 * @param safeAreaBottom - Safe area insets bottom (from useSafeAreaInsets)
 * @returns Bottom spacing configuration
 */
export const getBottomSpacingConfig = (safeAreaBottom: number = 0): BottomSpacingConfig => {
  const { width } = Dimensions.get('window');
  
  // Responsive breakpoints
  const isMobile = width < 768;
  const isTablet = width >= 768 && width < 1024;
  const isDesktop = width >= 1024;
  
  // Tab navigation bar height (consistent across platforms)
  const navBarHeight = 60;
  
  // Ad banner space (responsive):
  // Mobile: 50px (room for small banner ads)
  // Tablet: 60px (medium banner ads)
  // Desktop: 70px (larger banner ads or multiple ads)
  const adBannerSpace = isMobile ? 50 : isTablet ? 60 : 70;
  
  // Total space = nav bar + ad space + safe area padding
  const totalSpace = navBarHeight + adBannerSpace + safeAreaBottom + 8; // 8px extra breathing room
  
  return {
    navBarHeight,
    adBannerSpace,
    totalSpace,
    safeAreaBottom,
  };
};

/**
 * Get bottom padding for screens
 * Use in contentContainerStyle for ScrollView or paddingBottom for View
 * @param safeAreaBottom - Safe area insets bottom
 * @returns Padding value in pixels
 */
export const getScreenBottomPadding = (safeAreaBottom: number = 0): number => {
  const config = getBottomSpacingConfig(safeAreaBottom);
  return config.totalSpace;
};

/**
 * Get space for FlatList or scrollable content
 * @param safeAreaBottom - Safe area insets bottom
 * @returns Bottom content inset
 */
export const getScrollViewBottomInset = (safeAreaBottom: number = 0): number => {
  const config = getBottomSpacingConfig(safeAreaBottom);
  // For ScrollView, we want slightly less than total to account for tab bar overlap
  return config.navBarHeight + config.adBannerSpace + 16;
};

/**
 * Get the style object for screen containers
 * @param safeAreaBottom - Safe area insets bottom
 * @returns StyleSheet-compatible style object
 */
export const getScreenContainerStyle = (safeAreaBottom: number = 0) => ({
  paddingBottom: getScreenBottomPadding(safeAreaBottom),
});

/**
 * Get the style object for ScrollView content
 * @param safeAreaBottom - Safe area insets bottom
 * @returns StyleSheet-compatible contentContainerStyle
 */
export const getScrollViewContentStyle = (safeAreaBottom: number = 0) => ({
  paddingBottom: getScrollViewBottomInset(safeAreaBottom),
});

/**
 * Hook for responsive bottom spacing (if using hooks)
 * Use this in screens for consistent spacing
 * @param safeAreaBottom - Safe area insets bottom from useSafeAreaInsets()
 * @returns Bottom spacing configuration
 */
export const useBottomSpacing = (safeAreaBottom: number = 0): BottomSpacingConfig => {
  return getBottomSpacingConfig(safeAreaBottom);
};

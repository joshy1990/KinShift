/**
 * AdMob Service
 * Manages Google Mobile Ads (AdMob) configuration and ad unit IDs.
 * 
 * Ad unit IDs are loaded from environment variables via app.config.js extras.
 * For development/testing, Google-provided test IDs are used automatically
 * when __DEV__ is true.
 * 
 * PRODUCTION SETUP:
 * 1. Create ad units in AdMob dashboard (https://admob.google.com)
 * 2. Set env vars: ADMOB_BANNER_PORTRAIT_ID, ADMOB_BANNER_LANDSCAPE_ID, etc.
 * 3. Enable the AdMob plugin in app.config.js
 * 4. Rebuild native apps (expo prebuild)
 */

import { Platform } from 'react-native';
import Constants from 'expo-constants';

// -- Banner Ad Sizes ------------------------------------------------------
export const BannerAdSize = {
  BANNER: 'BANNER',                     // 320x50
  LARGE_BANNER: 'LARGE_BANNER',         // 320x100
  MEDIUM_RECTANGLE: 'MEDIUM_RECTANGLE', // 300x250
  FULL_BANNER: 'FULL_BANNER',           // 468x60
  LEADERBOARD: 'LEADERBOARD',           // 728x90
  ADAPTIVE_BANNER: 'ADAPTIVE_BANNER',   // Variable width, auto height
} as const;

export type BannerAdSizeType = typeof BannerAdSize[keyof typeof BannerAdSize];

// -- Google-provided test ad unit IDs -------------------------------------
// These are safe to use in development � they serve test ads, never real ones.
export const TestIds = {
  BANNER: Platform.select({
    ios: 'ca-app-pub-3940256099942544/2934735716',
    android: 'ca-app-pub-3940256099942544/6300978111',
    default: 'ca-app-pub-3940256099942544/6300978111',
  }) as string,
  INTERSTITIAL: Platform.select({
    ios: 'ca-app-pub-3940256099942544/4411468910',
    android: 'ca-app-pub-3940256099942544/1033173712',
    default: 'ca-app-pub-3940256099942544/1033173712',
  }) as string,
  REWARDED: Platform.select({
    ios: 'ca-app-pub-3940256099942544/1712485313',
    android: 'ca-app-pub-3940256099942544/5224354917',
    default: 'ca-app-pub-3940256099942544/5224354917',
  }) as string,
};

// -- App-level AdMob IDs (from env or fallback) ---------------------------
const extras = Constants.expoConfig?.extra ?? {};

export const ADMOB_APP_IDS = {
  ios: extras.admobAppIdIos || 'ca-app-pub-xxxxxxxxxxxxxxxx',
  android: extras.admobAppIdAndroid || 'ca-app-pub-xxxxxxxxxxxxxxxx',
};

// -- Ad Unit IDs ----------------------------------------------------------
// In __DEV__ mode, always use Google test IDs to avoid policy violations.
const resolveAdUnitId = (envKey: string, testFallback: string): string => {
  if (__DEV__) return testFallback;
  return extras[envKey] || testFallback;
};

export const AD_UNIT_IDS = {
  bannerPortrait: resolveAdUnitId('admobBannerPortraitId', TestIds.BANNER),
  bannerLandscape: resolveAdUnitId('admobBannerLandscapeId', TestIds.BANNER),
  interstitial: resolveAdUnitId('admobInterstitialId', TestIds.INTERSTITIAL),
  rewarded: resolveAdUnitId('admobRewardedId', TestIds.REWARDED),
};

// -- Public helpers -------------------------------------------------------

export const getBannerAdUnitId = (isLandscape: boolean = false): string => {
  return isLandscape ? AD_UNIT_IDS.bannerLandscape : AD_UNIT_IDS.bannerPortrait;
};

export const getAdaptiveBannerSize = (_screenWidth: number): string => {
  return BannerAdSize.BANNER;
};

/**
 * Whether the AdMob native SDK is available.
 * Returns false on web or when the native module isn't linked.
 */
export const isAdMobAvailable = (): boolean => {
  if (Platform.OS === 'web') return false;
  try {
    // react-native-google-mobile-ads must be installed & linked
    require('react-native-google-mobile-ads');
    return true;
  } catch {
    return false;
  }
};

export const admobService = {
  async initialize(): Promise<void> {
    if (!isAdMobAvailable()) {
      console.log('[AdMob] Native SDK not available � ads will render as placeholder');
      return;
    }
    try {
      const mobileAds = require('react-native-google-mobile-ads').default;
      await mobileAds().initialize();
      console.log('[AdMob] Initialized successfully');
    } catch (error) {
      console.warn('[AdMob] Initialization failed:', error);
    }
  },
  getBannerAdUnitId,
  getInterstitialAdUnitId(): string {
    return AD_UNIT_IDS.interstitial;
  },
  getRewardedAdUnitId(): string {
    return AD_UNIT_IDS.rewarded;
  },
  getAdaptiveBannerSize,
  isAdMobAvailable,
};

export default admobService;

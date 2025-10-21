/**
 * AdMob Service
 * Manages Google Mobile Ads configuration and ad units
 * 
 * Setup:
 * 1. Create Google AdMob account at https://admob.google.com
 * 2. Create app and get App ID
 * 3. Create ad units and get Ad Unit IDs
 * 4. Update AD_UNIT_IDS below with your real IDs
 * 5. Update app.json with your app IDs
 */

import { BannerAdSize, TestIds } from 'react-native-google-mobile-ads';

/**
 * Your AdMob App IDs - UPDATE THESE
 * Get from: https://admob.google.com → Apps
 */
export const ADMOB_APP_IDS = {
  ios: process.env.ADMOB_APP_ID_IOS || 'ca-app-pub-xxxxxxxxxxxxxxxx', // Replace with your iOS App ID
  android: process.env.ADMOB_APP_ID_ANDROID || 'ca-app-pub-xxxxxxxxxxxxxxxx', // Replace with your Android App ID
};

/**
 * Ad Unit IDs for your app
 * Get from: https://admob.google.com → Apps → Your App → Ad units
 * 
 * Test IDs (use during development):
 * - Banner: TestIds.BANNER
 * - Interstitial: TestIds.INTERSTITIAL
 * - Rewarded: TestIds.REWARDED
 */
export const AD_UNIT_IDS = {
  // Banner Ads
  bannerPortrait: __DEV__
    ? TestIds.BANNER // Test ID during development
    : process.env.ADMOB_BANNER_PORTRAIT_ID || 'ca-app-pub-xxxxxxxxxxxxxxxx/yyyyyyyyyy', // Production Banner Ad Unit ID

  bannerLandscape: __DEV__
    ? TestIds.BANNER
    : process.env.ADMOB_BANNER_LANDSCAPE_ID || 'ca-app-pub-xxxxxxxxxxxxxxxx/zzzzzzzzzz', // Production Landscape Banner Ad Unit ID

  // Interstitial Ads (full-screen ads)
  interstitial: __DEV__
    ? TestIds.INTERSTITIAL
    : process.env.ADMOB_INTERSTITIAL_ID || 'ca-app-pub-xxxxxxxxxxxxxxxx/aaaaaaaaaa', // Production Interstitial Ad Unit ID

  // Rewarded Ads (video ads with reward)
  rewarded: __DEV__
    ? TestIds.REWARDED
    : process.env.ADMOB_REWARDED_ID || 'ca-app-pub-xxxxxxxxxxxxxxxx/bbbbbbbbbb', // Production Rewarded Ad Unit ID
};

/**
 * Get appropriate banner ad unit ID based on screen orientation
 */
export const getBannerAdUnitId = (isLandscape: boolean = false): string => {
  return isLandscape ? AD_UNIT_IDS.bannerLandscape : AD_UNIT_IDS.bannerPortrait;
};

/**
 * Get appropriate banner size based on screen width
 */
export const getAdaptiveBannerSize = (screenWidth: number): BannerAdSize => {
  if (screenWidth < 320) return BannerAdSize.BANNER;
  if (screenWidth < 728) return BannerAdSize.LEADERBOARD;
  if (screenWidth < 970) return BannerAdSize.LEADERBOARD;
  return BannerAdSize.FULL_BANNER;
};

/**
 * AdMob Service Object
 */
export const admobService = {
  /**
   * Initialize AdMob with your app ID
   * Call this once in your App.tsx root component
   */
  async initialize(): Promise<void> {
    try {
      // Initialization is handled by the plugin
      // But you can add custom logic here if needed
      console.log('[AdMob] AdMob service initialized');
    } catch (error) {
      console.error('[AdMob] Initialization failed:', error);
    }
  },

  /**
   * Get banner ad unit ID
   */
  getBannerAdUnitId,

  /**
   * Get interstitial ad unit ID
   */
  getInterstitialAdUnitId(): string {
    return AD_UNIT_IDS.interstitial;
  },

  /**
   * Get rewarded ad unit ID
   */
  getRewardedAdUnitId(): string {
    return AD_UNIT_IDS.rewarded;
  },

  /**
   * Get adaptive banner size
   */
  getAdaptiveBannerSize,
};

export default admobService;

/**
 * SETUP INSTRUCTIONS
 * ===================
 * 
 * 1. GET YOUR APP IDs FROM ADMOB
 *    - Go to: https://admob.google.com
 *    - Sign in with your Google account
 *    - Click: "Apps" in left menu
 *    - Find your app (create if needed)
 *    - Copy your App IDs
 *    - Update ADMOB_APP_IDS above
 * 
 * 2. CREATE AD UNITS
 *    - In AdMob console, go to "Ad units"
 *    - Create Banner ad unit
 *    - Create Interstitial ad unit (optional)
 *    - Create Rewarded ad unit (optional)
 *    - Copy the Ad Unit IDs
 *    - Update AD_UNIT_IDS above
 * 
 * 3. UPDATE app.json
 *    - Add your App IDs to plugins section:
 *    ```json
 *    "plugins": [
 *      [
 *        "react-native-google-mobile-ads",
 *        {
 *          "androidAppId": "ca-app-pub-...",
 *          "iosAppId": "ca-app-pub-..."
 *        }
 *      ]
 *    ]
 *    ```
 * 
 * 4. TEST WITH TEST IDS
 *    - During development, test IDs are used automatically (__DEV__)
 *    - Test IDs: TestIds.BANNER, TestIds.INTERSTITIAL, TestIds.REWARDED
 *    - This prevents accidental clicks on real ads during testing
 * 
 * 5. UPDATE WITH PRODUCTION IDS
 *    - When ready to deploy, update AD_UNIT_IDS with real IDs
 *    - Make sure __DEV__ is false in production build
 * 
 * TEST IDS (FOR DEVELOPMENT)
 * ==========================
 * Use these during development to avoid invalid traffic:
 * - Banner: ca-app-pub-3940256099942544/6300978111
 * - Interstitial: ca-app-pub-3940256099942544/1033173712
 * - Rewarded: ca-app-pub-3940256099942544/5224354917
 * - Native Advanced: ca-app-pub-3940256099942544/2247696110
 * 
 * IMPORTANT NOTES
 * ===============
 * - Never use real Ad Unit IDs during testing/development
 * - Invalid traffic can result in account suspension
 * - Always use TestIds during development
 * - Test with real IDs only after deploying to app store
 */

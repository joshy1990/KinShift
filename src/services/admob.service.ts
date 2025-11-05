/**
 * AdMob Service (DISABLED)
 * AdMob has been removed from the app. Ads will be added later after user base grows.
 * This file is kept as a stub to avoid breaking imports.
 */

// Stub types for backward compatibility
export const BannerAdSize = {
  BANNER: 'BANNER',
  LARGE_BANNER: 'LARGE_BANNER',
  MEDIUM_RECTANGLE: 'MEDIUM_RECTANGLE',
  FULL_BANNER: 'FULL_BANNER',
  LEADERBOARD: 'LEADERBOARD',
};

export const TestIds = {
  BANNER: 'test-banner',
  INTERSTITIAL: 'test-interstitial',
  REWARDED: 'test-rewarded',
};

export const ADMOB_APP_IDS = {
  ios: 'ca-app-pub-xxxxxxxxxxxxxxxx',
  android: 'ca-app-pub-xxxxxxxxxxxxxxxx',
};

export const AD_UNIT_IDS = {
  bannerPortrait: 'ca-app-pub-xxxxxxxxxxxxxxxx/yyyyyyyyyy',
  bannerLandscape: 'ca-app-pub-xxxxxxxxxxxxxxxx/zzzzzzzzzz',
  interstitial: 'ca-app-pub-xxxxxxxxxxxxxxxx/aaaaaaaaaa',
  rewarded: 'ca-app-pub-xxxxxxxxxxxxxxxx/bbbbbbbbbb',
};

export const getBannerAdUnitId = (_isLandscape: boolean = false): string => {
  return AD_UNIT_IDS.bannerPortrait;
};

export const getAdaptiveBannerSize = (_screenWidth: number): string => {
  return BannerAdSize.BANNER;
};

export const admobService = {
  async initialize(): Promise<void> {
    console.log('[AdMob] AdMob is disabled');
  },
  getBannerAdUnitId,
  getInterstitialAdUnitId(): string {
    return AD_UNIT_IDS.interstitial;
  },
  getRewardedAdUnitId(): string {
    return AD_UNIT_IDS.rewarded;
  },
  getAdaptiveBannerSize,
};

export default admobService;

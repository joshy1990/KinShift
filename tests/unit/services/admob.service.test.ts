/**
 * Unit tests for AdMob Service
 *
 * Tests ad unit ID resolution, banner size constants, and availability checks.
 */

// Mock Platform before importing
jest.mock('react-native', () => ({
  Platform: {
    OS: 'android',
    select: (obj: any) => obj.android ?? obj.default,
  },
}));

// Mock expo-constants
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      extra: {
        admobBannerPortraitId: undefined,
        admobBannerLandscapeId: undefined,
        admobInterstitialId: undefined,
        admobRewardedId: undefined,
      },
    },
  },
}));

import {
  BannerAdSize,
  TestIds,
  getBannerAdUnitId,
  getAdaptiveBannerSize,
  isAdMobAvailable,
  admobService,
  AD_UNIT_IDS,
} from '@/services/admob.service';

describe('AdMob Service', () => {
  // ── BannerAdSize constants ─────────────────────────────────────────
  describe('BannerAdSize', () => {
    it('has all standard sizes', () => {
      expect(BannerAdSize.BANNER).toBe('BANNER');
      expect(BannerAdSize.LARGE_BANNER).toBe('LARGE_BANNER');
      expect(BannerAdSize.MEDIUM_RECTANGLE).toBe('MEDIUM_RECTANGLE');
      expect(BannerAdSize.FULL_BANNER).toBe('FULL_BANNER');
      expect(BannerAdSize.LEADERBOARD).toBe('LEADERBOARD');
      expect(BannerAdSize.ADAPTIVE_BANNER).toBe('ADAPTIVE_BANNER');
    });
  });

  // ── TestIds ────────────────────────────────────────────────────────
  describe('TestIds', () => {
    it('has Google test IDs for BANNER', () => {
      expect(TestIds.BANNER).toContain('ca-app-pub-3940256099942544');
    });

    it('has Google test IDs for INTERSTITIAL', () => {
      expect(TestIds.INTERSTITIAL).toContain('ca-app-pub-3940256099942544');
    });

    it('has Google test IDs for REWARDED', () => {
      expect(TestIds.REWARDED).toContain('ca-app-pub-3940256099942544');
    });
  });

  // ── getBannerAdUnitId ──────────────────────────────────────────────
  describe('getBannerAdUnitId', () => {
    it('returns portrait ID by default', () => {
      const id = getBannerAdUnitId();
      expect(id).toBe(AD_UNIT_IDS.bannerPortrait);
    });

    it('returns portrait ID when isLandscape is false', () => {
      const id = getBannerAdUnitId(false);
      expect(id).toBe(AD_UNIT_IDS.bannerPortrait);
    });

    it('returns landscape ID when isLandscape is true', () => {
      const id = getBannerAdUnitId(true);
      expect(id).toBe(AD_UNIT_IDS.bannerLandscape);
    });
  });

  // ── getAdaptiveBannerSize ─────────────────────────────────────────
  describe('getAdaptiveBannerSize', () => {
    it('returns BANNER size', () => {
      expect(getAdaptiveBannerSize(320)).toBe('BANNER');
      expect(getAdaptiveBannerSize(768)).toBe('BANNER');
    });
  });

  // ── isAdMobAvailable ──────────────────────────────────────────────
  describe('isAdMobAvailable', () => {
    it('returns false when native module is not linked', () => {
      // react-native-google-mobile-ads is not installed in test env
      expect(isAdMobAvailable()).toBe(false);
    });
  });

  // ── admobService ──────────────────────────────────────────────────
  describe('admobService', () => {
    it('initialize resolves without error when SDK not available', async () => {
      await expect(admobService.initialize()).resolves.toBeUndefined();
    });

    it('exposes getBannerAdUnitId', () => {
      expect(typeof admobService.getBannerAdUnitId).toBe('function');
    });

    it('exposes getInterstitialAdUnitId', () => {
      const id = admobService.getInterstitialAdUnitId();
      expect(id).toBe(AD_UNIT_IDS.interstitial);
    });

    it('exposes getRewardedAdUnitId', () => {
      const id = admobService.getRewardedAdUnitId();
      expect(id).toBe(AD_UNIT_IDS.rewarded);
    });

    it('exposes getAdaptiveBannerSize', () => {
      expect(typeof admobService.getAdaptiveBannerSize).toBe('function');
    });

    it('exposes isAdMobAvailable', () => {
      expect(typeof admobService.isAdMobAvailable).toBe('function');
    });
  });
});

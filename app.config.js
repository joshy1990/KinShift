require('dotenv').config({ path: '.env.local' });

module.exports = {
  "expo": {
    "name": "KinShift",
    "slug": "linkshift",  // Matches EAS project ID
    "version": "1.0.0",
    "icon": "./assets/icon.png",
    "platforms": [
      "ios",
      "android",
      "web"
    ],
    "orientation": "portrait",
    "userInterfaceStyle": "light",
    "splash": {
      "backgroundColor": "#0F0F23"
    },
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.kinshift.app",
      "buildNumber": "1",
      "googleServicesFile": "./GoogleService-Info.plist",
      "infoPlist": {
        "NSUserNotificationUsageDescription": "KinShift uses notifications to inform you about shift updates, changes, and schedule conflicts in your households.",
        "NSLocationWhenInUseUsageDescription": "Your location is not used by KinShift but is required by some system features.",
        "UIBackgroundModes": ["remote-notification"],
        "CFBundleAllowMixedLocalizations": true
      }
    },
    "android": {
      "backgroundColor": "#0F0F23",
      "package": "com.kinshift.app",
      "versionCode": 1,
      "adaptiveIcon": {
        "foregroundImage": "./assets/icon.png",
        "backgroundColor": "#0F0F23"
      },
      "googleServicesFile": "./google-services.json",
      "permissions": [
        "RECEIVE_BOOT_COMPLETED",
        "VIBRATE",
        "WAKE_LOCK"
      ]
    },
    "web": {
      "bundler": "metro"
    },
    "plugins": [
      "@react-native-firebase/app",
      [
        "@react-native-firebase/messaging",
        {
          "default_notification_icon": "notification_icon",
          "default_notification_color": "#0F0F23"
        }
      ],
      [
        "expo-notifications",
        {
          "icon": "./assets/icon.png",
          "sounds": []
        }
      ]
      // AdMob plugin temporarily disabled - launching ad-free, will enable after user base grows
      // [
      //   "react-native-google-mobile-ads",
      //   {
      //     "androidAppId": process.env.ADMOB_APP_ID_ANDROID || "ca-app-pub-xxxxxxxxxxxxxxxx",
      //     "iosAppId": process.env.ADMOB_APP_ID_IOS || "ca-app-pub-xxxxxxxxxxxxxxxx"
      //   }
      // ]
      // Sentry plugin temporarily disabled - will re-enable after adding SENTRY_AUTH_TOKEN to EAS
      // [
      //   "@sentry/react-native/expo",
      //   {
      //     "url": "https://sentry.io/",
      //     "project": "kinshift",
      //     "organization": "kinshift"
      //   }
      // ]
    ],
    "owner": process.env.EXPO_OWNER || "kinshift",
    "extra": {
      "eas": {
        "projectId": process.env.EAS_PROJECT_ID || "519ab785-c013-4ecb-b983-2354ae498ec4"
      },
      "supportEmail": process.env.SUPPORT_EMAIL || "support@kinshift.app",
      "revenuecatApiKey": process.env.REVENUECAT_API_KEY,
      "sentryDsn": process.env.SENTRY_DSN,
      "sentryDebug": process.env.SENTRY_DEBUG === 'true',
      "admobAppIdIos": process.env.ADMOB_APP_ID_IOS,
      "admobAppIdAndroid": process.env.ADMOB_APP_ID_ANDROID,
      "admobBannerPortraitId": process.env.ADMOB_BANNER_PORTRAIT_ID,
      "admobBannerLandscapeId": process.env.ADMOB_BANNER_LANDSCAPE_ID,
      "admobInterstitialId": process.env.ADMOB_INTERSTITIAL_ID,
      "admobRewardedId": process.env.ADMOB_REWARDED_ID
    }
  }
};

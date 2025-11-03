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
      }
    },
    "web": {
      "bundler": "metro"
    },
    "plugins": [
      [
        "react-native-google-mobile-ads",
        {
          "androidAppId": process.env.ADMOB_APP_ID_ANDROID || "ca-app-pub-xxxxxxxxxxxxxxxx",
          "iosAppId": process.env.ADMOB_APP_ID_IOS || "ca-app-pub-xxxxxxxxxxxxxxxx"
        }
      ]
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
    "owner": "joshlee1990",
    "extra": {
      "eas": {
        "projectId": "519ab785-c013-4ecb-b983-2354ae498ec4"
      },
      "supportEmail": "kinshift25@gmail.com",
      "firebaseApiKey": process.env.FIREBASE_API_KEY,
      "firebaseAuthDomain": process.env.FIREBASE_AUTH_DOMAIN,
      "firebaseProjectId": process.env.FIREBASE_PROJECT_ID,
      "firebaseStorageBucket": process.env.FIREBASE_STORAGE_BUCKET,
      "firebaseMessagingSenderId": process.env.FIREBASE_MESSAGING_SENDER_ID,
      "firebaseAppId": process.env.FIREBASE_APP_ID,
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

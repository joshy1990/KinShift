# KinShift — Release & Store Submission Guide

**Company:** Offeryn Software Ltd  
**Support:** support@offeryn.co.uk  
**Firebase Project:** linkshift-c2725  
**Bundle ID:** com.kinshift.app (Android & iOS)

---

## Table of Contents

1. [Environment Variables — What You Need](#1-environment-variables)
2. [EAS Project Setup](#2-eas-project-setup)
3. [RevenueCat Setup (Subscriptions)](#3-revenuecat-setup)
4. [Google AdMob Setup (Ads)](#4-google-admob-setup)
5. [Release Signing (Android Keystore)](#5-release-signing-android)
6. [Google Play Store Submission](#6-google-play-store)
7. [Apple App Store Submission](#7-apple-app-store)
8. [Firebase Cloud Functions Deployment](#8-cloud-functions)
9. [iOS vs Android — Differences](#9-ios-vs-android-differences)
10. [Pre-Release Checklist](#10-pre-release-checklist)

---

## 1. Environment Variables

You need a `.env.local` file in the project root (never committed to git):

```bash
cp .env.example .env.local
```

Fill in these values:

| Variable | Where to get it | Required for |
|----------|----------------|-------------|
| `EAS_PROJECT_ID` | `eas project:info` or expo.dev dashboard | Push notifications, EAS builds |
| `EXPO_OWNER` | Your Expo account username | EAS builds |
| `REVENUECAT_API_KEY` | RevenueCat dashboard → API Keys → Public | Subscriptions |
| `SENTRY_DSN` | sentry.io → Project Settings → Client Keys | Error monitoring (optional for v1) |
| `SENTRY_AUTH_TOKEN` | sentry.io → Settings → Auth Tokens | Sentry source maps (optional for v1) |
| `ADMOB_APP_ID_ANDROID` | AdMob dashboard → Apps → App ID | Ads (disabled for v1 launch) |
| `ADMOB_APP_ID_IOS` | AdMob dashboard → Apps → App ID | Ads (disabled for v1 launch) |
| `ADMOB_BANNER_PORTRAIT_ID` | AdMob → Ad units → Banner | Ads |
| `ADMOB_BANNER_LANDSCAPE_ID` | AdMob → Ad units → Banner | Ads |
| `SUPPORT_EMAIL` | Already set | Contact email |

For EAS cloud builds, set these as EAS secrets (they won't be in .env.local on the build server):

```bash
eas secret:create --name EAS_PROJECT_ID --value "your-project-id"
eas secret:create --name REVENUECAT_API_KEY --value "your-public-key"
eas secret:create --name SUPPORT_EMAIL --value "support@offeryn.co.uk"
# Add others as needed
```

---

## 2. EAS Project Setup

### First-time setup

```bash
# 1. Install EAS CLI globally
npm install -g eas-cli

# 2. Log in to your Expo account
eas login

# 3. Link this project (if not already)
eas init
# This will create or link the project on expo.dev and give you the EAS_PROJECT_ID

# 4. Verify
eas project:info
# Note the "Project ID" — that's your EAS_PROJECT_ID
```

### Set your EAS_PROJECT_ID

Put the project ID into `.env.local`:

```
EAS_PROJECT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

And register it as an EAS secret for cloud builds:

```bash
eas secret:create --name EAS_PROJECT_ID --value "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

### Verify push tokens work

After setting the EAS_PROJECT_ID, rebuild the app:

```bash
# Development build
eas build --profile preview --platform android

# Install on your phone and open the app
# Check logs — you should see:
#   ✅ Push token registered: ExponentPushToken[xxxxx]
```

---

## 3. RevenueCat Setup (Subscriptions)

RevenueCat handles all payment processing. KinShift has 3 tiers: Free, Standard (£2.99/mo), Premium (£4.99/mo).

### Step 1: Create a RevenueCat Account

1. Go to https://www.revenuecat.com and sign up
2. Create a new project called **"KinShift"**

### Step 2: Connect Google Play

1. In RevenueCat dashboard → **Project Settings** → **Apps** → **Add New App**
2. Select **Google Play**
3. Enter package name: `com.kinshift.app`
4. You need a **Google Play Service Account JSON key**:
   - Go to Google Play Console → **Setup** → **API access**
   - Click **Create new service account**
   - Go to Google Cloud Console (link provided)
   - Create a service account with **Editor** role
   - Create a JSON key and download it
   - Back in Play Console, grant the service account **Admin** access
   - Upload the JSON key to RevenueCat
5. Click **Save**

### Step 3: Connect App Store (iOS)

1. In RevenueCat → **Apps** → **Add New App** → **App Store**
2. Enter bundle ID: `com.kinshift.app`
3. You need an **App Store Connect Shared Secret**:
   - Go to App Store Connect → your app → **In-App Purchases** → **Manage** (top right)
   - **App-Specific Shared Secret** → Generate
   - Copy and paste into RevenueCat
4. Click **Save**

### Step 4: Create Products in the Stores

#### Google Play Console

1. Go to Google Play Console → **KinShift** → **Monetize** → **Subscriptions**
2. Create these subscription products:

| Product ID | Name | Price | Period |
|-----------|------|-------|--------|
| `kinshift_standard_monthly` | KinShift Standard | £2.99 | Monthly |
| `kinshift_standard_annual` | KinShift Standard Annual | £29.99 | Annual |
| `kinshift_premium_monthly` | KinShift Premium | £4.99 | Monthly |
| `kinshift_premium_annual` | KinShift Premium Annual | £49.99 | Annual |

3. Each product needs a **base plan** → set the price and billing period
4. **Activate** each subscription

#### App Store Connect

1. Go to App Store Connect → your app → **In-App Purchases** → **Manage**
2. Click **+** → **Auto-Renewable Subscription**
3. Create a **Subscription Group** called "KinShift Plans"
4. Add the same 4 products with matching Product IDs
5. Set prices in **Pricing and Availability** (use currency converter for GBP equivalents)
6. Submit for review (Apple reviews in-app purchases separately)

### Step 5: Configure Products in RevenueCat

1. In RevenueCat → **Products** → import from both stores
2. Create **Entitlements**:
   - `standard` → attach Standard monthly + annual products
   - `premium` → attach Premium monthly + annual products
3. Create **Offerings**:
   - Default offering with 4 packages (Standard Monthly, Standard Annual, Premium Monthly, Premium Annual)

### Step 6: Get Your API Key

1. RevenueCat → **Project Settings** → **API Keys**
2. Copy the **Public app-specific API key** (starts with `goog_` for Google or `appl_` for Apple)
3. **Important:** For cross-platform, you need TWO keys — one per platform. But for initial launch you can use the Google one.
4. Put it in `.env.local`:

```
REVENUECAT_API_KEY=goog_xxxxxxxxxxxxxxxxxxxx
```

And as an EAS secret:

```bash
eas secret:create --name REVENUECAT_API_KEY --value "goog_xxxxxxxxxxxxxxxxxxxx"
```

### Step 7: Set Up the RevenueCat Webhook (Tier Sync)

This keeps Firestore in sync when RevenueCat processes a purchase/renewal/cancellation:

1. Deploy Cloud Functions first (see [Section 8](#8-cloud-functions))
2. In RevenueCat → **Project Settings** → **Integrations** → **Webhooks**
3. **Webhook URL:** `https://us-central1-linkshift-c2725.cloudfunctions.net/revenueCatWebhook`
4. **Authorization header:** Set a secret token, then add it to your Cloud Functions environment:
   ```bash
   firebase functions:config:set revenuecat.webhook_secret="your-random-secret-here"
   ```
5. Enable events: `INITIAL_PURCHASE`, `RENEWAL`, `CANCELLATION`, `EXPIRATION`, `BILLING_ISSUE_DETECTED`
6. Click **Save**

---

## 4. Google AdMob Setup (Ads)

> **Note:** Ads are currently disabled in app.config.js for v1 launch. Enable when you have a user base.

### Step 1: Create AdMob Account

1. Go to https://admob.google.com and sign in with your Google account
2. Accept the terms of service

### Step 2: Register Your Apps

1. Click **Apps** → **Add App**
2. Select **Android** → search for your app (if published) or enter manually
   - App name: KinShift
   - Package: `com.kinshift.app`
3. Repeat for **iOS**:
   - Bundle ID: `com.kinshift.app`
4. Note the **App IDs** for each platform (format: `ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY`)

### Step 3: Create Ad Units

For each platform (Android and iOS), create:

| Ad Type | Where it shows in app |
|---------|----------------------|
| Banner (320×50) | Bottom of calendar screen (free/standard users) |

1. Click **Ad units** → **Add ad unit** → **Banner**
2. Name it: "KinShift Banner Portrait"
3. Copy the ad unit ID (format: `ca-app-pub-XXXXXXXXXXXXXXXX/YYYYYYYYYY`)
4. Repeat for landscape if needed

### Step 4: Set Environment Variables

```env
ADMOB_APP_ID_ANDROID=ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY
ADMOB_APP_ID_IOS=ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY
ADMOB_BANNER_PORTRAIT_ID=ca-app-pub-XXXXXXXXXXXXXXXX/YYYYYYYYYY
ADMOB_BANNER_LANDSCAPE_ID=ca-app-pub-XXXXXXXXXXXXXXXX/YYYYYYYYYY
```

### Step 5: Enable the AdMob Plugin

In `app.config.js`, uncomment the AdMob plugin block:

```javascript
[
  "react-native-google-mobile-ads",
  {
    "androidAppId": process.env.ADMOB_APP_ID_ANDROID,
    "iosAppId": process.env.ADMOB_APP_ID_IOS
  }
]
```

Then rebuild: `eas build --profile production --platform all`

### AdMob Policy Notes

- Never click your own ads (Google will ban your account)
- In development, the app automatically uses Google's test ad IDs
- AdMob review can take 24-48 hours after your app goes live
- Ads won't serve real ads until the app has real traffic

---

## 5. Release Signing (Android)

### Currently: Debug keystore is used for release builds — this must change.

### Generate a Release Keystore

```bash
# Run in your project root
keytool -genkeypair -v -storetype PKCS12 -keystore android/app/release.keystore -alias kinshift -keyalg RSA -keysize 2048 -validity 10000
```

It will ask you:
- **Keystore password:** Choose a strong password (save it somewhere safe!)
- **Key password:** Can be the same
- **First and last name:** Your name or company name
- **Organization:** Offeryn Software Ltd
- **City/Locality:** Your city
- **Country code:** GB

### Configure build.gradle

Edit `android/app/build.gradle`, replace the release signing config:

```gradle
signingConfigs {
    debug {
        storeFile file('debug.keystore')
        storePassword 'android'
        keyAlias 'androiddebugkey'
        keyPassword 'android'
    }
    release {
        storeFile file('release.keystore')
        storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD") ?: ''
        keyAlias 'kinshift'
        keyPassword System.getenv("ANDROID_KEY_PASSWORD") ?: ''
    }
}

buildTypes {
    debug {
        signingConfig signingConfigs.debug
    }
    release {
        signingConfig signingConfigs.release
        // ... rest stays the same
    }
}
```

### Set EAS Secrets for Cloud Builds

```bash
# Upload the keystore to EAS
eas credentials

# Or set environment secrets
eas secret:create --name ANDROID_KEYSTORE_PASSWORD --value "your-keystore-password"
eas secret:create --name ANDROID_KEY_PASSWORD --value "your-key-password"
```

**CRITICAL:** If you lose the keystore or passwords, you can NEVER update your app again on Google Play. Back up `release.keystore` somewhere safe (USB drive, password manager, cloud storage with encryption).

### Alternative: Let EAS Manage Signing

EAS can generate and manage your keystore automatically:

```bash
eas build --profile production --platform android
# When prompted: "Generate a new Android Keystore? (Y/n)" → Y
```

EAS stores it securely. You can download it later with `eas credentials`.

---

## 6. Google Play Store Submission

### Step 1: Create a Google Play Developer Account

1. Go to https://play.google.com/console
2. Pay the one-time **$25 registration fee**
3. Complete identity verification (can take 48 hours)
4. Set up a payments profile if selling subscriptions

### Step 2: Create the App Listing

1. Click **Create app**
2. Fill in:
   - **App name:** KinShift
   - **Default language:** English (United Kingdom)
   - **App type:** App
   - **Free or paid:** Free (with in-app purchases)
3. Accept the declarations

### Step 3: Store Listing

Fill in these sections:

#### App Details
- **Short description** (max 80 chars): "Share shift schedules with your household. Know who's working when."
- **Full description** (max 4000 chars): Write a detailed description of features
- **App icon:** 512×512 PNG (use your `assets/icon.png` scaled up)
- **Feature graphic:** 1024×500 PNG (banner image shown at top of listing)
- **Screenshots:** At least 2 phone screenshots, ideally 4-8
  - Take screenshots from your device or emulator
  - Must be between 320px and 3840px, 16:9 or 9:16 ratio

#### Content Rating
- Go to **Policy** → **App content** → **Content rating**
- Fill in the IARC questionnaire (the app has no violence, no mature content)
- You'll likely get an **Everyone / PEGI 3** rating

#### Data Safety
- Go to **Policy** → **App content** → **Data safety**
- Declare what data you collect:
  - **Email address** — Account creation (required)
  - **Name** — Display name in households (optional, user-provided)
  - **Push notification tokens** — Notification delivery (required)
  - Data is **encrypted in transit** (Firebase uses HTTPS)
  - Data is **not shared with third parties** (unless you enable AdMob)
  - Users **can request deletion** (via support email)

#### Target Audience
- **Target age:** All ages (if general purpose) OR 18+ (if you want to avoid COPPA requirements)
  - **Recommended:** Target 18+ to avoid the extra compliance burden

### Step 4: Build the Production AAB

```bash
# Build production Android App Bundle
eas build --profile production --platform android

# Wait for build to complete (5-15 minutes)
# Download the .aab file from the EAS dashboard
```

### Step 5: Upload to Google Play

1. Go to **Production** → **Create new release**
2. Upload the `.aab` file
3. Add release notes:
   ```
   KinShift v1.0.0 — Launch Release
   • Share shift schedules with your household
   • See who's working and when at a glance
   • Get notified about shift changes and day notes
   • Local shift reminders before your shifts start
   • Works offline with automatic sync
   ```
4. Click **Review release** → **Start rollout to production**

### Step 6: Review

- Google typically reviews within **1-3 days** for the first submission
- You may get feedback/rejection for policy issues — fix and resubmit

### Pricing & Distribution

In **Monetize** → **Subscriptions**, ensure your subscription products are active (from the RevenueCat section above).

---

## 7. Apple App Store Submission

### Step 1: Apple Developer Account

1. Go to https://developer.apple.com/programs/
2. Enroll in the Apple Developer Program — **$99/year** (USD)
3. If enrolling as a company (Offeryn Software Ltd), you need a **D-U-N-S number**
   - Apply at https://developer.apple.com/enroll/duns-lookup/
   - Takes 5-14 business days
4. Complete enrollment

### Step 2: Create App ID & Certificates

```bash
# EAS handles this automatically when you build:
eas build --profile production --platform ios

# When prompted:
# - "Generate a new Apple Distribution certificate?" → Y
# - "Generate a new Apple Provisioning Profile?" → Y
# EAS will ask you to log in to your Apple Developer account
```

### Step 3: Create the App in App Store Connect

1. Go to https://appstoreconnect.apple.com
2. Click **My Apps** → **+** → **New App**
3. Fill in:
   - **Platform:** iOS
   - **Name:** KinShift
   - **Primary language:** English (UK)
   - **Bundle ID:** com.kinshift.app (must match app.config.js)
   - **SKU:** kinshift-ios-001 (any unique string)
4. Click **Create**

### Step 4: App Store Listing

#### App Information
- **Subtitle** (max 30 chars): "Household Shift Sharing"
- **Category:** Productivity
- **Secondary category:** Lifestyle

#### Version Information
- **Description:** Same as Google Play but written for Apple's tone
- **Keywords** (max 100 chars): "shifts,schedule,household,family,calendar,roster,work"
- **Support URL:** https://offeryn.co.uk (or a simple landing page)
- **Marketing URL:** (optional) Your website
- **Privacy Policy URL:** **REQUIRED** — you must host a privacy policy page

#### Screenshots
- **6.7" iPhone** (iPhone 15 Pro Max): At least 3 screenshots, 1290×2796 px
- **6.5" iPhone** (iPhone 11 Pro Max): At least 3 screenshots, 1242×2688 px
- **Optional:** 5.5" iPhone, iPad screenshots
- You can generate these using a simulator even without a physical device

#### App Review Information
- **Contact info:** Your name, phone, email
- **Demo account:** Create a test account the reviewer can log in with
  - Email: `review@kinshift.app` (or similar)
  - Password: A simple password
  - Pre-populate with some sample data (shifts, a household)
- **Notes:** "This app requires two users in a household to fully test notification features. A second test account is available: review2@kinshift.app"

### Step 5: Build & Submit

```bash
# Build iOS production binary
eas build --profile production --platform ios

# Submit directly to App Store Connect
eas submit --platform ios
# This uploads the build and makes it available in App Store Connect
```

Then in App Store Connect:
1. Go to your app → **iOS App** → select the build
2. Fill in all the required metadata
3. Click **Submit for Review**

### Step 6: Apple Review

- First review typically takes **24-48 hours** (can be up to 7 days)
- Common rejection reasons:
  - Missing privacy policy
  - Crashes during review
  - Login issues (test account doesn't work)
  - Subscription issues (IAP not properly configured)
  - Incomplete features
- If rejected, you can reply to the reviewer and resubmit

### Privacy Policy

You MUST have a privacy policy URL. Create a simple page that covers:
- What data you collect (email, name, shift schedules)
- Why you collect it (account creation, household features)
- How it's stored (Firebase, encrypted in transit)
- Third-party services (Firebase, RevenueCat, optionally AdMob, Sentry)
- User rights (deletion, export)
- Contact info (support@offeryn.co.uk)

Host it on your website, a GitHub Pages site, or even a Google Doc (public link).

---

## 8. Firebase Cloud Functions Deployment

The Cloud Functions handle secure server-side operations (join codes, webhooks, push, cleanup).

```bash
# 1. Install Firebase CLI
npm install -g firebase-tools

# 2. Log in
firebase login

# 3. Ensure you're targeting the right project
firebase use linkshift-c2725

# 4. Install function dependencies
cd functions
npm install
cd ..

# 5. Deploy functions
firebase deploy --only functions

# 6. Deploy Firestore rules & indexes
firebase deploy --only firestore:rules,firestore:indexes
```

### Verify deployment

```bash
firebase functions:list
# Should show:
# joinHouseholdByCode
# lookupInvitationByCode
# revenueCatWebhook
# sendPushNotification
# scheduledCleanup
```

---

## 9. iOS vs Android — Differences

### Will the app look/work different on iOS?

**Short answer:** 95% identical. React Native renders native components on each platform, so it automatically adapts.

### What's the same (no changes needed):
- All business logic, services, Firestore queries
- Navigation structure and screens
- Push notifications (Expo handles both platforms)
- Firebase authentication, Firestore, storage
- RevenueCat subscriptions
- Calendar, shift management, household features
- Offline support

### What's automatically different (React Native handles it):
| Feature | Android | iOS |
|---------|---------|-----|
| **Navigation animations** | Slide from right + fade | iOS-native push animation |
| **Back button** | Hardware back button | Swipe-from-left gesture |
| **Keyboard** | Adjusts differently | `KeyboardAvoidingView` already configured per-platform |
| **Status bar** | Material style | iOS style |
| **Date/time pickers** | Android spinner/calendar | iOS wheel picker |
| **Alerts** | Material Design dialog | iOS-native alert |
| **Font rendering** | Roboto default | San Francisco default |
| **Safe area insets** | Handled by `react-native-safe-area-context` | Notch/Dynamic Island handled |
| **Notification channels** | Required (Android 8+) — already configured | Not applicable |
| **Haptic feedback** | Available | Available |

### What might need attention:
| Area | Detail | Risk |
|------|--------|------|
| **Keyboard avoidance** | Already uses `KeyboardAvoidingView` with `Platform.OS === 'ios' ? 'padding' : 'height'` | ✅ Already handled |
| **Bottom spacing** | `bottomSpacing.ts` utility exists in the project | ✅ Already handled |
| **Push notifications** | iOS requires explicit permission prompt (already coded) | ✅ Already handled |
| **Background modes** | `UIBackgroundModes: ["remote-notification"]` already in infoPlist | ✅ Already handled |
| **Notification channels** | Android-only, code already platform-gated | ✅ Already handled |
| **Google Services file** | `GoogleService-Info.plist` already in project root | ✅ Already present |
| **DateTimePicker** | Uses `@react-native-community/datetimepicker` — renders natively per platform | ✅ Cross-platform |
| **Styling edge cases** | Some Android-specific shadow rendering vs iOS `shadow*` props | Low risk |

### Testing without physical iOS device

You can test in the iOS Simulator:
```bash
# Requires a Mac with Xcode installed
eas build --profile preview --platform ios --local
# Or run locally:
npx expo run:ios
```

If you don't have a Mac, you can:
1. Build via EAS cloud (no Mac needed): `eas build --profile preview --platform ios`
2. Install on a physical iOS device via TestFlight
3. Ask a friend/tester with an iPhone to test via TestFlight

### TestFlight (iOS Beta Testing)

```bash
# Build and submit to TestFlight
eas build --profile production --platform ios
eas submit --platform ios

# In App Store Connect:
# Go to TestFlight tab → Add internal/external testers → Send invite
```

---

## 10. Pre-Release Checklist

### Environment & Config
- [ ] `.env.local` created with all required values
- [ ] EAS secrets set for all env vars (`eas secret:list` to verify)
- [ ] `EAS_PROJECT_ID` set (push notifications depend on this)
- [ ] Firebase project (`linkshift-c2725`) has Blaze plan active (required for Cloud Functions)

### Firebase
- [ ] Firestore rules deployed: `firebase deploy --only firestore:rules`
- [ ] Firestore indexes deployed: `firebase deploy --only firestore:indexes`
- [ ] Cloud Functions deployed: `firebase deploy --only functions`
- [ ] Firebase Authentication → Sign-in providers → Email/Password enabled

### RevenueCat
- [ ] Account created, project configured
- [ ] Google Play service account connected
- [ ] App Store app connected (if doing iOS)
- [ ] Subscription products created in Google Play Console
- [ ] Subscription products created in App Store Connect (if doing iOS)
- [ ] Products imported into RevenueCat
- [ ] Entitlements configured (`standard`, `premium`)
- [ ] Offering created with 4 packages
- [ ] Webhook configured pointing to Cloud Function
- [ ] `REVENUECAT_API_KEY` set in .env.local and EAS secrets

### Android
- [ ] Release keystore generated (or let EAS manage it)
- [ ] Release signing configured in build.gradle
- [ ] Google Play Developer account ($25 paid, identity verified)
- [ ] App listing complete (screenshots, description, icons)
- [ ] Content rating questionnaire completed
- [ ] Data safety form completed
- [ ] Production AAB uploaded
- [ ] Subscription products active in Play Console

### iOS (when ready)
- [ ] Apple Developer account ($99/year paid)
- [ ] D-U-N-S number obtained (if enrolling as company)
- [ ] App created in App Store Connect
- [ ] Screenshots prepared (6.7", 6.5" at minimum)
- [ ] Privacy policy URL live
- [ ] Test/review account created and populated with sample data
- [ ] In-app purchase products submitted for review
- [ ] IPA uploaded via `eas submit`
- [ ] Submitted for App Review

### Testing
- [ ] Push notifications tested between two devices
- [ ] Shift reminders fire at correct time
- [ ] Deep links work from notifications
- [ ] Offline mode works (create shift while offline, comes back when online)
- [ ] Subscription purchase flow tested (use sandbox/test accounts)
- [ ] All 483 unit tests passing: `npm test`
- [ ] Lint clean: `npm run lint`

### Post-Launch
- [ ] Monitor Firebase Console for errors
- [ ] Monitor RevenueCat dashboard for purchases
- [ ] Set up Sentry (optional) for crash reporting
- [ ] Enable AdMob after user base grows (uncomment plugin in app.config.js)
- [ ] Monitor Google Play Console / App Store Connect for reviews

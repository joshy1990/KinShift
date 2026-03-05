# KinShift — Step-by-Step Go-Live Guide

**Company:** Offeryn Software Ltd  
**Support:** support@offeryn.co.uk  
**Firebase Project:** linkshift-c2725  
**Bundle ID (both platforms):** com.kinshift.app  
**Expo Slug:** linkshift

Do these sections **in order**. Each one tells you exactly where to click.

---

## Table of Contents

1. [STEP 1 — Expo & EAS Setup (get your EAS_PROJECT_ID)](#step-1--expo--eas-setup)
2. [STEP 2 — Firebase Setup (Blaze plan + deploy rules)](#step-2--firebase-setup)
3. [STEP 3 — RevenueCat Setup (subscriptions)](#step-3--revenuecat-setup)
4. [STEP 4 — Google Play Developer Account](#step-4--google-play-developer-account)
5. [STEP 5 — Create Products in Google Play Console](#step-5--create-products-in-google-play)
6. [STEP 6 — Wire RevenueCat to Google Play](#step-6--wire-revenuecat-to-google-play)
7. [STEP 7 — Android Release Signing](#step-7--android-release-signing)
8. [STEP 8 — Build & Upload to Google Play](#step-8--build--upload-to-google-play)
9. [STEP 9 — Google Play Store Listing](#step-9--google-play-store-listing)
10. [STEP 10 — Apple Developer Account (iOS)](#step-10--apple-developer-account-ios)
11. [STEP 11 — App Store Connect & TestFlight (iOS)](#step-11--app-store-connect--testflight)
12. [STEP 12 — Google AdMob (ads — do later)](#step-12--google-admob-ads)
13. [STEP 13 — Sentry (crash monitoring — optional)](#step-13--sentry-crash-monitoring)
14. [iOS vs Android — Differences](#ios-vs-android--differences)
15. [Pre-Release Checklist](#pre-release-checklist)
16. [Your .env.local Template](#your-envlocal-template)

---

## STEP 1 — Expo & EAS Setup

**What you get:** `EAS_PROJECT_ID` (needed for push notifications to work)

### 1.1 Create an Expo account (if you don't have one)

1. Open https://expo.dev/signup
2. Sign up with email or GitHub
3. Pick a username (e.g. `kinshift` or your personal name)
4. Confirm your email

### 1.2 Install EAS CLI

Open a terminal in your project folder:

```bash
npm install -g eas-cli
```

### 1.3 Log in

```bash
eas login
```
Enter the email/password from step 1.1.

### 1.4 Link this project

```bash
cd c:\git\KinShift
eas init
```

- It will ask: **"Would you like to create a new EAS project?"** → type **Y**
- It detects `slug: "linkshift"` and creates the project
- It prints something like:
  ```
  ✔ Created project: @kinshift/linkshift
  Project ID: 519ab785-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  ```
- **Copy that Project ID** — that's your `EAS_PROJECT_ID`

### 1.5 Verify

```bash
eas project:info
```

You'll see:
```
Slug:       linkshift
Project ID: 519ab785-xxxx-xxxx-xxxx-xxxxxxxxxxxx
Owner:      kinshift
```

### 1.6 Save it

Create your `.env.local` file in the project root:

```bash
copy .env.example .env.local
```

Open `.env.local` and fill in:

```
EXPO_OWNER=kinshift
EAS_PROJECT_ID=519ab785-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

(Use YOUR actual values from above)

### 1.7 Set EAS Secrets (for cloud builds)

```bash
eas secret:create --name EAS_PROJECT_ID --value "519ab785-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
eas secret:create --name EXPO_OWNER --value "kinshift"
eas secret:create --name SUPPORT_EMAIL --value "support@offeryn.co.uk"
```

To check they're saved:
```bash
eas secret:list
```

---

## STEP 2 — Firebase Setup

**What you get:** Firestore rules deployed, Cloud Functions live, Blaze plan active

Your Firebase project already exists: **linkshift-c2725**

### 2.1 Install Firebase CLI

```bash
npm install -g firebase-tools
```

### 2.2 Log in

```bash
firebase login
```

This opens a browser — sign in with the Google account that owns the Firebase project.

### 2.3 Upgrade to Blaze plan (required for Cloud Functions)

1. Open https://console.firebase.google.com/project/linkshift-c2725/overview
2. Look at the bottom-left of the sidebar — it shows your current plan
3. If it says **"Spark"**, click it → click **"Upgrade"**
4. Select **"Blaze (pay as you go)"**
5. Add a payment method (credit/debit card)
6. Confirm

> **Cost:** The free tier is very generous — you won't pay anything until you hit ~50K reads/day or ~20K function invocations/day. For a new app that's months away.

### 2.4 Check you're pointing at the right project

```bash
firebase use linkshift-c2725
```

If it says "no project directory detected", run:
```bash
firebase init
```
And select **"Use an existing project"** → pick **linkshift-c2725**. When asked which features, select **Firestore** and **Functions**.

### 2.5 Deploy Firestore rules & indexes

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

You should see:
```
✔ firestore: Released rules
✔ firestore: Deployed indexes
```

### 2.6 Deploy Cloud Functions

```bash
cd functions
npm install
cd ..
firebase deploy --only functions
```

You should see:
```
✔ functions: Deployed 5 functions
  joinHouseholdByCode
  lookupInvitationByCode
  revenueCatWebhook
  sendPushNotification
  scheduledCleanup
```

**Note the webhook URL** — it will be printed like:
```
Function URL (revenueCatWebhook): https://us-central1-linkshift-c2725.cloudfunctions.net/revenueCatWebhook
```
Save this URL — you'll need it for RevenueCat in Step 3.

### 2.7 Verify Firebase Auth is enabled

1. Open https://console.firebase.google.com/project/linkshift-c2725/authentication/providers
2. Make sure **"Email/Password"** shows as **Enabled**
3. If not: click it → toggle **Enable** → click **Save**

---

## STEP 3 — RevenueCat Setup

**What you get:** `REVENUECAT_API_KEY` (needed for subscriptions to work)

### 3.1 Create a RevenueCat account

1. Open https://app.revenuecat.com/signup
2. Sign up with email or Google
3. Confirm your email

### 3.2 Create a project

1. After logging in, you'll be on the dashboard
2. Click **"Create new project"** (top-left dropdown or center of screen)
3. Name: **KinShift**
4. Click **"Create project"**

### 3.3 Add your Android app

1. You're now in the project. In the left sidebar: **Project Settings** → **Apps**
2. Click **"+ New"** button (top right)
3. Select **"Google Play Store"**
4. **App name:** KinShift Android
5. **Google Play package:** `com.kinshift.app`
6. **Service account credentials JSON** — leave blank for now (you'll add this after Step 6)
7. Click **"Save"**

### 3.4 Get your API key

1. In left sidebar: **Project Settings** → **API keys**
2. You'll see a key listed under your app
3. **Copy the "Public app-specific API key"** — it starts with `goog_` (for Google Play)
4. Add it to your `.env.local`:

```
REVENUECAT_API_KEY=goog_xxxxxxxxxxxxxxxxxxxx
```

5. Also save as an EAS secret:
```bash
eas secret:create --name REVENUECAT_API_KEY --value "goog_xxxxxxxxxxxxxxxxxxxx"
```

### 3.5 Create Entitlements

Entitlements are what features the user unlocks. You need two.

1. Left sidebar: **Entitlements**
2. Click **"+ New"**
   - **Identifier:** `standard`
   - **Description:** Standard tier features
   - Click **"Add"**
3. Click **"+ New"** again
   - **Identifier:** `premium`
   - **Description:** Premium tier features
   - Click **"Add"**

### 3.6 Create an Offering

Offerings are the "shelf" of products shown to users.

1. Left sidebar: **Offerings**
2. Click **"+ New"**
   - **Identifier:** `default`
   - **Description:** Default offering
   - Click **"Add"**
3. You'll add packages to this after creating products in Google Play (Step 5)

### 3.7 Set up the webhook

1. Left sidebar: **Integrations** → **Webhooks**
2. Click **"+ New"**
3. **Webhook URL:** paste the URL from Step 2.6:
   ```
   https://us-central1-linkshift-c2725.cloudfunctions.net/revenueCatWebhook
   ```
4. **Authorization header:** Type a random secure string (e.g. `rc_webhook_kinshift_2026_secret`)
   - Save this string — you'll need to add it to Firebase too
5. Toggle ON these events:
   - ✅ INITIAL_PURCHASE
   - ✅ RENEWAL
   - ✅ CANCELLATION
   - ✅ EXPIRATION
   - ✅ BILLING_ISSUE_DETECTED
6. Click **"Save"**

Now save the webhook secret in Firebase:
```bash
firebase functions:config:set revenuecat.webhook_secret="rc_webhook_kinshift_2026_secret"
firebase deploy --only functions
```

---

## STEP 4 — Google Play Developer Account

**What you get:** Ability to publish on Google Play Store

### 4.1 Create the account

1. Open https://play.google.com/console/signup
2. Sign in with your Google account
3. **Accept** the developer distribution agreement
4. **Pay the one-time $25 registration fee** (card payment)
5. Fill in your developer profile:
   - **Developer name:** Offeryn Software Ltd
   - **Contact email:** support@offeryn.co.uk
   - **Website:** (your website if you have one, or leave blank)
6. **Identity verification:** Google will ask you to verify your identity
   - They'll send documents to review — typically takes **1-3 business days**
   - You cannot publish until verification is complete

### 4.2 Create the app

Once verified:

1. Open https://play.google.com/console
2. Click **"Create app"** (top right)
3. Fill in:
   - **App name:** KinShift
   - **Default language:** English (United Kingdom)
   - **App or Game:** App
   - **Free or Paid:** Free
4. Check all the declaration boxes at the bottom
5. Click **"Create app"**

---

## STEP 5 — Create Products in Google Play

**What you get:** Subscription products that RevenueCat and your app can sell

### 5.1 Navigate to Subscriptions

1. Open https://play.google.com/console
2. Click **KinShift** in your app list
3. Left sidebar: **Monetize** → **Products** → **Subscriptions**

### 5.2 Create the Standard Monthly subscription

1. Click **"Create subscription"**
2. **Product ID:** `kinshift_standard_monthly` ← must match exactly
3. **Name:** KinShift Standard
4. Click **"Create"**
5. You'll be taken to the subscription details page
6. Click **"Add base plan"**:
   - **Base plan ID:** `standard-monthly`
   - **Auto-renewing:** Yes
   - **Billing period:** 1 Month
   - Click **"Set prices"** → **"Set price"**
     - Select **United Kingdom** → enter **£2.99**
     - Click **"Update"** → it'll auto-calculate other currencies
   - Click **"Save"** then **"Activate"**

### 5.3 Create the Standard Annual subscription

1. Back to **Monetize** → **Products** → **Subscriptions** → **"Create subscription"**
2. **Product ID:** `kinshift_standard_annual`
3. **Name:** KinShift Standard Annual
4. Add base plan with:
   - **Billing period:** 1 Year
   - **Price:** £29.99
5. **Save** and **Activate**

### 5.4 Create the Premium Monthly subscription

1. **Create subscription**
2. **Product ID:** `kinshift_premium_monthly`
3. **Name:** KinShift Premium
4. Add base plan:
   - **Billing period:** 1 Month
   - **Price:** £4.99
5. **Save** and **Activate**

### 5.5 Create the Premium Annual subscription

1. **Create subscription**
2. **Product ID:** `kinshift_premium_annual`
3. **Name:** KinShift Premium Annual
4. Add base plan:
   - **Billing period:** 1 Year
   - **Price:** £49.99
5. **Save** and **Activate**

> **Important:** Subscriptions won't be testable until you've uploaded at least one APK/AAB to the app. Do Step 8 first if Google won't let you activate them.

---

## STEP 6 — Wire RevenueCat to Google Play

**What you get:** RevenueCat can verify purchases and sync subscription status

### 6.1 Create a Google Cloud Service Account

1. Open https://play.google.com/console
2. Click **Setup** (bottom of left sidebar) → **API access**
3. If Google asks you to link a Google Cloud project, click **"Link"** (it creates one automatically)
4. Scroll down to **"Service accounts"** section
5. Click **"Create new service account"**
6. A popup appears telling you to go to Google Cloud Console — click the **"Google Cloud Console"** link
7. In Google Cloud Console:
   - Click **"+ CREATE SERVICE ACCOUNT"** (top of page)
   - **Service account name:** `revenuecat-service`
   - **Service account ID:** auto-fills to `revenuecat-service`
   - Click **"Create and Continue"**
   - **Grant role:** select **"Editor"**
   - Click **"Continue"** → **"Done"**
8. You'll see your new service account in the list
9. Click the **three dots (⋮)** → **"Manage keys"**
10. Click **"Add key"** → **"Create new key"** → select **"JSON"** → **"Create"**
11. A `.json` file downloads — **keep this safe, you'll upload it to RevenueCat**

### 6.2 Grant Play Console access

1. Go back to Google Play Console → **Setup** → **API access**
2. Find `revenuecat-service` in the service accounts list
3. Click **"Grant access"**
4. Under **Account permissions**, check:
   - ✅ View financial data, orders, and cancellation survey responses
   - ✅ Manage orders and subscriptions
   - ✅ View app information and download bulk reports
5. Under **App permissions** → click **"Add app"** → select **KinShift**
6. Click **"Apply"** → **"Invite user"** → **"Send invite"**

### 6.3 Upload to RevenueCat

1. Open https://app.revenuecat.com
2. Left sidebar: **Project Settings** → **Apps** → click your **KinShift Android** app
3. Find **"Service Account credentials JSON"**
4. Click **"Upload"** and select the `.json` file you downloaded
5. Click **"Save"**

### 6.4 Import products into RevenueCat

1. Left sidebar: **Products**
2. Click **"+ New"**
3. Select your **Google Play Store** app
4. It should auto-detect your products, or enter them manually:
   - `kinshift_standard_monthly`
   - `kinshift_standard_annual`
   - `kinshift_premium_monthly`
   - `kinshift_premium_annual`
5. Click **"Add"** for each

### 6.5 Attach products to entitlements

1. Left sidebar: **Entitlements** → click **"standard"**
2. Click **"Attach"** → select `kinshift_standard_monthly` and `kinshift_standard_annual`
3. Click **"Add"**
4. Go back to **Entitlements** → click **"premium"**
5. Click **"Attach"** → select `kinshift_premium_monthly` and `kinshift_premium_annual`
6. Click **"Add"**

### 6.6 Add products to your Offering

1. Left sidebar: **Offerings** → click **"default"**
2. Click **"+ New Package"** four times, creating:

| Package identifier | Product |
|---|---|
| `$rc_monthly` | kinshift_standard_monthly |
| `$rc_annual` | kinshift_standard_annual |
| `kinshift_premium_monthly` | kinshift_premium_monthly |
| `kinshift_premium_annual` | kinshift_premium_annual |

3. Click **"Add"** for each

---

## STEP 7 — Android Release Signing

**What you get:** A production keystore so Google Play accepts your app

### Option A: Let EAS manage it (recommended, easiest)

When you run `eas build` in Step 8, EAS will ask:
```
Would you like to generate a new Android Keystore? (Y/n)
```
Type **Y**. EAS generates, stores, and manages it for you securely.

To download it later if needed:
```bash
eas credentials
```

### Option B: Generate your own keystore

```bash
keytool -genkeypair -v -storetype PKCS12 -keystore android/app/release.keystore -alias kinshift -keyalg RSA -keysize 2048 -validity 10000
```

It asks:
- **Keystore password:** pick something strong, **write it down somewhere safe**
- **Key password:** same as keystore password is fine
- **First and last name:** Your Name
- **Organization:** Offeryn Software Ltd
- **City:** Your city
- **Country code:** GB

Then set EAS secrets:
```bash
eas secret:create --name ANDROID_KEYSTORE_PASSWORD --value "your-password"
eas secret:create --name ANDROID_KEY_PASSWORD --value "your-password"
```

> **WARNING:** If you lose the keystore file or passwords, you can NEVER update your app on Google Play again. Back it up to a USB drive or password manager.

---

## STEP 8 — Build & Upload to Google Play

### 8.1 Run the production build

```bash
cd c:\git\KinShift
eas build --profile production --platform android
```

- Takes about 10-15 minutes
- When finished, EAS gives you a download URL for the `.aab` file
- Download the `.aab` file to your computer

### 8.2 Upload to Google Play Console

1. Open https://play.google.com/console → click **KinShift**
2. Left sidebar: **Production** (under "Release")
3. Click **"Create new release"**
4. **App signing:** If this is your first upload, Google asks about Play App Signing
   - Click **"Continue"** (let Google manage your signing key)
5. Click **"Upload"** → select the `.aab` file you downloaded
6. Wait for it to upload and process
7. **Release name:** `1.0.0`
8. **Release notes:**
   ```
   KinShift v1.0.0
   • Share shift schedules with your household
   • See who's working and when at a glance
   • Get notified about shift changes and day notes
   • Local shift reminders before your shifts start
   • Works offline with automatic sync
   ```
9. Click **"Review release"**
10. Fix any warnings (it'll tell you if anything is missing)
11. Click **"Start rollout to Production"**

### 8.3 Alternative: Use EAS Submit

Instead of manually uploading, EAS can submit directly:
```bash
eas submit --platform android
```
It will ask for your Google Play service account key JSON (the one from Step 6.1).

---

## STEP 9 — Google Play Store Listing

Fill these in **before** or **after** uploading the build — Google won't publish until everything is complete.

### 9.1 Main store listing

1. Open https://play.google.com/console → **KinShift**
2. Left sidebar: **Grow** → **Store presence** → **Main store listing**
3. Fill in:
   - **App name:** KinShift
   - **Short description:** (max 80 chars)
     > Share shift schedules with your household. Know who's working when.
   - **Full description:** (max 4000 chars)
     > KinShift makes it easy to share work shift schedules with your household... (write your description)

### 9.2 Graphics

Still on the Main store listing page:

- **App icon:** 512×512 PNG — scale up your `assets/icon.png`
- **Feature graphic:** 1024×500 PNG — create a banner image (use Canva, Figma, etc.)
- **Phone screenshots:** at least 2 screenshots
  - Take screenshots from your Android phone
  - Size: must be between 320px and 3840px on each side
  - Recommended: 1080×1920 (portrait)
  - Take 4-8 screenshots showing: login, calendar view, shift detail, household, notifications

### 9.3 Content rating

1. Left sidebar: **Policy** → **App content** → **Content rating**
2. Click **"Start questionnaire"**
3. **Category:** "Utility, Productivity, Communication, or other"
4. Answer the questions — for KinShift:
   - Violence: No
   - Sexual content: No
   - Language: No
   - Controlled substances: No
   - Miscellaneous: Nothing applies
5. Click **"Submit"**
6. You'll get a rating like **"Everyone"** / **PEGI 3**

### 9.4 Data safety

1. Left sidebar: **Policy** → **App content** → **Data safety**
2. Click **"Start"**
3. **Does your app collect or share data?** → Yes
4. **Data types collected:**
   - ✅ Email address — Purpose: Account management — Required: Yes
   - ✅ Name — Purpose: App functionality (display in household) — Required: No
   - ✅ Other user IDs (Firebase UID) — Purpose: App functionality — Required: Yes
5. **Is data encrypted in transit?** → Yes (Firebase uses HTTPS)
6. **Can users request data deletion?** → Yes (via support@offeryn.co.uk)
7. **Data shared with third parties?** → No (unless you enable AdMob later)
8. Click **"Submit"**

### 9.5 Target audience

1. Left sidebar: **Policy** → **App content** → **Target audience and content**
2. **Target age group:** Select **"18 and over"**
   - This avoids COPPA children's privacy requirements
3. Click **"Save"**

### 9.6 Privacy policy

1. Left sidebar: **Policy** → **App content** → **Privacy policy**
2. Enter a URL to your privacy policy
   - If you don't have a website yet, create a free Google Doc, make it public, and use the share link
   - It must mention: what data you collect (email, name, shifts), Firebase/RevenueCat as third parties, how to request deletion, contact email
3. Click **"Save"**

---

## STEP 10 — Apple Developer Account (iOS)

**What you get:** Ability to publish on Apple App Store

> **Note:** You need this only when you're ready for iOS. You can launch Android first.

### 10.1 Enroll as a company

1. Open https://developer.apple.com/programs/enroll/
2. Click **"Start Your Enrollment"**
3. Sign in with your Apple ID (or create one)
4. Select **"Organization"** (for Offeryn Software Ltd)
5. You need a **D-U-N-S Number**:
   - Click the link to **"look up your D-U-N-S Number"**
   - Or go directly to: https://developer.apple.com/enroll/duns-lookup/
   - Search for "Offeryn Software Ltd"
   - If not found, **request one** — takes **5-14 business days** (free)
6. Once you have your D-U-N-S number, continue enrollment:
   - **Organization:** Offeryn Software Ltd
   - **D-U-N-S:** your number
   - **Website:** your company website
7. **Pay $99/year** (USD)
8. Apple reviews your enrollment — typically **1-3 business days**

### 10.2 Alternative: Enroll as individual

If you want to skip the D-U-N-S process:
1. Select **"Individual"** instead of Organization
2. The app will show your personal name instead of "Offeryn Software Ltd"
3. You can switch to Organization later

---

## STEP 11 — App Store Connect & TestFlight

### 11.1 Create the app

1. Open https://appstoreconnect.apple.com
2. Click **"My Apps"** → **"+"** (top left) → **"New App"**
3. Fill in:
   - **Platforms:** iOS
   - **Name:** KinShift
   - **Primary Language:** English (UK)
   - **Bundle ID:** select `com.kinshift.app` (it appears after your first EAS iOS build)
   - **SKU:** `kinshift-001`
4. Click **"Create"**

### 11.2 Build for iOS

```bash
eas build --profile production --platform ios
```

- EAS will ask you to log in to your Apple Developer account
- It asks **"Generate a new Apple Distribution certificate?"** → **Y**
- It asks **"Generate a new Provisioning Profile?"** → **Y**
- EAS handles all the certificates for you
- Takes ~15 minutes

### 11.3 Submit to App Store Connect

```bash
eas submit --platform ios
```

This uploads the build directly to App Store Connect.

### 11.4 Set up for TestFlight (beta testing)

1. Open https://appstoreconnect.apple.com → **KinShift** → **"TestFlight"** tab
2. Your build should appear (status: "Processing" then "Ready to Submit")
3. Click on the build → fill in:
   - **What to Test:** "Test shift creation, household joining, notifications"
   - **Test Information:** add your review account email/password
4. Click **"Internal Testing"** → **"+"** to create a group
5. Add testers by email — they'll get an invite to install via TestFlight app

### 11.5 App Store listing (when ready to publish)

1. App Store Connect → **KinShift** → **"App Store"** tab
2. Fill in:
   - **Subtitle:** (max 30 chars) "Household Shift Sharing"
   - **Description:** same as Google Play adapted
   - **Keywords:** (max 100 chars) `shifts,schedule,household,family,calendar,roster,work`
   - **Support URL:** your website or support page
   - **Privacy Policy URL:** same as Google Play — **REQUIRED by Apple**
3. **Screenshots:**
   - **6.7" iPhone:** 1290×2796 px — at least 3 screenshots
   - **6.5" iPhone:** 1242×2688 px — at least 3 screenshots
   - You can take these from the iOS Simulator on a Mac, or use screenshot generator tools like https://screenshots.pro or https://mockuphone.com
4. **App Review Information:**
   - **Contact name:** Your name
   - **Phone:** Your phone number
   - **Email:** support@offeryn.co.uk
   - **Demo account email:** `review@kinshift.app` (create this in your app first)
   - **Demo account password:** a simple password
   - **Review notes:** "This app requires two users in a household to test notification features. Login with the demo account which has sample data pre-populated."
5. Click **"Submit for Review"**

### 11.6 In-App Purchases for iOS (if doing subscriptions on iOS)

1. App Store Connect → **KinShift** → **"In-App Purchases"** (left sidebar under Features)
2. Click **"+"** → **"Auto-Renewable Subscription"**
3. **Subscription Group:** Create a group called **"KinShift Plans"**
4. Create 4 products matching the Google Play ones:

| Reference Name | Product ID | Price | Duration |
|---|---|---|---|
| Standard Monthly | `kinshift_standard_monthly` | £2.99 | 1 Month |
| Standard Annual | `kinshift_standard_annual` | £29.99 | 1 Year |
| Premium Monthly | `kinshift_premium_monthly` | £4.99 | 1 Month |
| Premium Annual | `kinshift_premium_annual` | £49.99 | 1 Year |

5. For each product, add:
   - **Display Name** and **Description** (shown to user during purchase)
   - **Review Screenshot** (a screenshot of the subscription screen in your app)
6. Click **"Submit for Review"** on each product

Then in RevenueCat:
1. Go to https://app.revenuecat.com → **Project Settings** → **Apps** → **"+ New"**
2. Select **"App Store"**
3. **Bundle ID:** `com.kinshift.app`
4. **App-Specific Shared Secret:**
   - In App Store Connect → your app → **In-App Purchases** → **"Manage"** (top right) → click **"App-Specific Shared Secret"** → **"Generate"**
   - Copy and paste into RevenueCat
5. Import the iOS products and attach them to the same entitlements and offerings

---

## STEP 12 — Google AdMob (Ads)

> **Do this LATER** after you have users. Ads are currently disabled in the code.

### 12.1 Create an AdMob account

1. Open https://admob.google.com
2. Sign in with your Google account
3. Accept the terms of service
4. **Payment info:** Set up a payment profile to receive ad revenue

### 12.2 Register your app

1. Click **"Apps"** in the left sidebar → **"ADD APP"**
2. **"Is the app listed on a supported app store?"**
   - If already published: Yes → search for KinShift
   - If not yet published: No → enter manually
3. **Platform:** Android
4. **App name:** KinShift
5. Click **"Add"**
6. **Copy the App ID** shown (format: `ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY`)
7. Repeat for iOS if applicable

### 12.3 Create ad units

1. Click your app → **"Ad units"** → **"ADD AD UNIT"**
2. Select **"Banner"**
3. **Ad unit name:** KinShift Banner Portrait
4. Click **"Create ad unit"**
5. **Copy the Ad unit ID** (format: `ca-app-pub-XXXXXXXXXXXXXXXX/YYYYYYYYYY`)

### 12.4 Set environment variables

Add to `.env.local`:
```
ADMOB_APP_ID_ANDROID=ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY
ADMOB_APP_ID_IOS=ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY
ADMOB_BANNER_PORTRAIT_ID=ca-app-pub-XXXXXXXXXXXXXXXX/YYYYYYYYYY
```

And as EAS secrets:
```bash
eas secret:create --name ADMOB_APP_ID_ANDROID --value "ca-app-pub-xxx~yyy"
eas secret:create --name ADMOB_APP_ID_IOS --value "ca-app-pub-xxx~yyy"
eas secret:create --name ADMOB_BANNER_PORTRAIT_ID --value "ca-app-pub-xxx/yyy"
```

### 12.5 Enable the AdMob plugin

In `app.config.js`, uncomment the AdMob plugin block (lines ~74-80) and rebuild.

---

## STEP 13 — Sentry (Crash Monitoring)

> **Optional for v1 launch.** Nice to have for catching crashes in production.

### 13.1 Create a Sentry account

1. Open https://sentry.io/signup/
2. Sign up (free tier available — 5K events/month)
3. Create an organization: **Offeryn**

### 13.2 Create a project

1. Click **"Create Project"**
2. Platform: **React Native**
3. Project name: **kinshift**
4. Click **"Create Project"**

### 13.3 Get your DSN

1. Left sidebar: **Settings** → **Projects** → **kinshift** → **Client Keys (DSN)**
2. Copy the DSN URL (format: `https://xxxxx@oXXXXXX.ingest.sentry.io/XXXXXXX`)

### 13.4 Get an auth token (for source maps)

1. Left sidebar: **Settings** → **Auth Tokens**
2. Click **"Create New Token"**
3. Scopes: `project:releases`, `org:read`
4. Click **"Create Token"** and copy it

### 13.5 Set environment variables

Add to `.env.local`:
```
SENTRY_DSN=https://xxxxx@oXXXXXX.ingest.sentry.io/XXXXXXX
```

EAS secrets:
```bash
eas secret:create --name SENTRY_DSN --value "https://xxxxx@o..."
eas secret:create --name SENTRY_AUTH_TOKEN --value "your-auth-token"
```

### 13.6 Enable the Sentry plugin

In `app.config.js`, uncomment the Sentry plugin block (lines ~82-87) and rebuild.

---

## iOS vs Android — Differences

**Will the app look/work different on iOS?**

No code changes needed. React Native automatically uses native components per platform.

### What's the same (everything):
- All screens, navigation, logic
- Firebase, Firestore, push notifications
- RevenueCat subscriptions
- Offline support
- Calendar, shifts, households, day notes

### What automatically adapts:

| Feature | Android | iOS |
|---------|---------|-----|
| Back navigation | Hardware back button | Swipe-from-left gesture |
| Keyboard | `height` mode | `padding` mode (already configured) |
| Alerts | Material dialog | iOS-native alert |
| Fonts | Roboto | San Francisco |
| Date pickers | Android spinner | iOS wheel |
| Notifications | Notification shade + channels | Notification Centre + banners |
| Status bar | Material style | iOS style |
| Safe areas | Handled | Notch/Dynamic Island handled |

### Risk areas (low):
- Some shadow styles render slightly differently (Android uses `elevation`, iOS uses `shadow*` props)
- KeyboardAvoidingView — already platform-configured in your code
- The app has not been tested on physical iOS — use TestFlight to get a friend to test before App Store submission

---

## Pre-Release Checklist

### Environment (do first)
- [ ] `.env.local` created with all values filled in (see template below)
- [ ] EAS secrets set: `eas secret:list` shows all required vars
- [ ] `EAS_PROJECT_ID` set — push notifications depend on this

### Firebase
- [ ] Blaze plan active on linkshift-c2725
- [ ] Firestore rules deployed: `firebase deploy --only firestore:rules`
- [ ] Firestore indexes deployed: `firebase deploy --only firestore:indexes`
- [ ] Cloud Functions deployed: `firebase deploy --only functions`
- [ ] Email/Password auth enabled

### RevenueCat
- [ ] Account created, project "KinShift" configured
- [ ] Android app added with package `com.kinshift.app`
- [ ] Service account JSON uploaded (from Google Cloud)
- [ ] 4 subscription products imported and attached to entitlements
- [ ] Offering "default" has all 4 packages
- [ ] Webhook pointing to Cloud Function URL
- [ ] `REVENUECAT_API_KEY` in .env.local and EAS secrets

### Google Play
- [ ] Developer account ($25 paid, identity verified)
- [ ] App created in Play Console
- [ ] 4 subscription products created and activated
- [ ] Store listing complete (screenshots, descriptions, icon, feature graphic)
- [ ] Content rating completed
- [ ] Data safety completed
- [ ] Privacy policy URL set
- [ ] Target audience set to 18+
- [ ] Production AAB uploaded
- [ ] Release submitted for review

### iOS (when ready)
- [ ] Apple Developer account ($99/year paid, D-U-N-S obtained)
- [ ] App created in App Store Connect
- [ ] iOS build completed via `eas build`
- [ ] Build submitted via `eas submit`
- [ ] TestFlight tested by at least one person
- [ ] Screenshots prepared for 6.7" and 6.5" iPhones
- [ ] In-app purchases created and under review
- [ ] App submitted for App Review

### Testing
- [ ] Push notifications tested: member creates shift → other member's phone pings
- [ ] Shift reminders fire before shift start time
- [ ] Offline: create shift with WiFi off → shift syncs when WiFi returns
- [ ] Subscription: test purchase flow using Google Play test track
- [ ] All 483 tests pass: `npm test`

---

## Your .env.local Template

Copy this, fill in your actual values:

```env
# === Expo / EAS ===
EXPO_OWNER=kinshift
EAS_PROJECT_ID=                        # ← from Step 1.4 (eas init)

# === RevenueCat ===
REVENUECAT_API_KEY=                    # ← from Step 3.4 (starts with goog_)

# === Sentry (optional for v1) ===
# SENTRY_DSN=                          # ← from Step 13.3
# SENTRY_DEBUG=false

# === AdMob (disabled for v1) ===
# ADMOB_APP_ID_ANDROID=               # ← from Step 12.2
# ADMOB_APP_ID_IOS=                   # ← from Step 12.2
# ADMOB_BANNER_PORTRAIT_ID=           # ← from Step 12.3
# ADMOB_BANNER_LANDSCAPE_ID=          # ← from Step 12.3

# === Contact ===
SUPPORT_EMAIL=support@offeryn.co.uk
```

Once filled in, also register them as EAS secrets:

```bash
eas secret:create --name EAS_PROJECT_ID --value "your-value"
eas secret:create --name REVENUECAT_API_KEY --value "your-value"
eas secret:create --name SUPPORT_EMAIL --value "support@offeryn.co.uk"
```

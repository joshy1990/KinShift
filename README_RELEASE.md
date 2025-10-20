# LinkShift Release Readiness Checklist

This checklist covers iOS and Android steps to ship LinkShift to the stores.

## Store Assets & Policies
- [ ] App name, description, keywords, screenshots, preview video
- [ ] Privacy Policy and Terms: in-app screens provided; static HTML in `assets/policies/` for offline viewing
- [ ] Data Safety / Privacy manifest answers (Firebase Auth/Firestore, expo-notifications, RevenueCat)

## iOS (App Store)
- [ ] Enable Push Notifications capability (APNs key uploaded in Apple Developer)
- [ ] Configure In-App Purchases in App Store Connect; map product identifiers in RevenueCat
- [ ] Test purchases with Sandbox accounts
- [ ] Add “Restore Purchases” UX (present in Subscription screen)
- [ ] Review info.plist privacy strings for notifications (Expo handles defaults; adjust if needed)

## Android (Play Store)
- [ ] Configure FCM for push (server key for backend if used; Expo push service if applicable)
- [ ] Configure Billing products in Play Console; map in RevenueCat
- [ ] Complete Data safety form with Firebase analytics/crash reporting as applicable

## App Config
- Expo SDK 54 / RN 0.81 (current)
- Firebase configured for RN long-polling, offline persistence enabled
- RevenueCat init/purchase/restore flows present
- Jest tests green; TypeScript typecheck clean

## Telemetry & Limits
- Tier checks log fail-open events (see `src/utils/telemetry.ts`) to help tune behavior
- Consider switching to fail-closed for member additions on production outages

## Build with EAS
- `eas build --platform ios`
- `eas build --platform android`

## Post-Launch
- Monitor crashes, purchase success rates, and fail-open logs
- Iterate ASO based on conversion and retention

# Google Sign-In Setup Guide

This document describes how to configure Google Sign-In for each platform in the OneKey app.

## Overview

OneKey uses Google Sign-In with Supabase for authentication. The flow is:

1. User signs in with Google (platform-specific method)
2. Get Google ID token
3. Exchange ID token for Supabase session via `signInWithIdToken`

## Google Cloud Console Configuration

### Prerequisites

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select or create a project
3. Enable **Google Sign-In API** (APIs & Services → Library → Google Sign-In API)

### OAuth Client IDs

Create OAuth 2.0 Client IDs at: **APIs & Services → Credentials → Create Credentials → OAuth Client ID**

| Platform | Type | Client ID |
|----------|------|-----------|
| Web | Web application | `244450898872-d22ubafv8ca38s6fp0kflhdr6e3s386u.apps.googleusercontent.com` |
| iOS | iOS | `244450898872-1jvugg12bmstu8nfqfmcpf1o7tcsoltt.apps.googleusercontent.com` |
| Android | Web application | Use Web Client ID (required for `idToken`) |
| Extension | Web application | Use Web Client ID |

> **Important**: For Android/iOS native apps, you need a **Web Client ID** to get `idToken` for Supabase. The native client ID alone won't work with `signInWithIdToken`.

---

## iOS Configuration

### 1. Install Dependencies

Ensure `@react-native-google-signin/google-signin` is NOT excluded in `apps/mobile/package.json`:

```json
{
  "excludePackagesFromPodInstall": {
    "exclude": []  // Remove @react-native-google-signin/google-signin from exclude list
  }
}
```

### 2. Run Pod Install

```bash
cd apps/mobile/ios
pod install
```

### 3. Configure URL Scheme in Info.plist (Required)

Add the reversed client ID as a URL scheme in `apps/mobile/ios/OneKeyWallet/Info.plist`:

```xml
<key>CFBundleURLTypes</key>
<array>
  <!-- Existing URL schemes... -->
  <dict>
    <key>CFBundleTypeRole</key>
    <string>Editor</string>
    <key>CFBundleURLSchemes</key>
    <array>
      <!-- Reversed iOS Client ID -->
      <string>com.googleusercontent.apps.244450898872-1jvugg12bmstu8nfqfmcpf1o7tcsoltt</string>
    </array>
  </dict>
</array>
```

> **Note**: The URL scheme is the iOS Client ID reversed. For `244450898872-1jvugg12bmstu8nfqfmcpf1o7tcsoltt.apps.googleusercontent.com`, use `com.googleusercontent.apps.244450898872-1jvugg12bmstu8nfqfmcpf1o7tcsoltt`.

### 4. GoogleService-Info.plist (Optional)

`GoogleService-Info.plist` is **NOT required** for Google Sign-In alone. It's only needed if you use other Firebase services (Analytics, Crashlytics, etc.).

If you do need it:
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a project or select existing one
3. Add an iOS app with your bundle ID
4. Download `GoogleService-Info.plist`
5. Add to Xcode project

### 5. Verify Configuration

The iOS Client ID in `packages/shared/src/consts/authConsts.ts` should match:

```typescript
export const GOOGLE_OAUTH_CLIENT_IDS = {
  IOS: '244450898872-1jvugg12bmstu8nfqfmcpf1o7tcsoltt.apps.googleusercontent.com',
};
```

And in `packages/shared/src/consts/googleSignConsts.ts`:

```typescript
export const GoogleSignInConfigureIOS = {
  scopes: ['openid', 'profile', 'email'],
  offlineAccess: false,
  iosClientId: GOOGLE_OAUTH_CLIENT_IDS.IOS,
};
```

### 6. Rebuild iOS App

```bash
# Clean and rebuild
cd apps/mobile/ios
rm -rf build Pods
pod install
cd ..
yarn ios
```

---

## Android Configuration

### 1. Install Dependencies

Ensure `@react-native-google-signin/google-signin` is properly linked (automatic with autolinking).

### 2. Add google-services.json

1. Download `google-services.json` from Firebase Console
2. Place it in `apps/mobile/android/app/google-services.json`

### 3. Configure Signing (Important!)

Google Sign-In requires proper app signing. In development:

1. Generate a debug keystore SHA-1:
   ```bash
   cd apps/mobile/android
   ./gradlew signingReport
   ```

2. Add the SHA-1 fingerprint to your Google Cloud OAuth client:
   - Go to Google Cloud Console → APIs & Services → Credentials
   - Edit your Android OAuth Client
   - Add the SHA-1 fingerprint

### 4. Verify Configuration

The Web Client ID in `packages/shared/src/consts/googleSignConsts.ts`:

```typescript
export const GoogleSignInConfigure = {
  scopes: ['openid', 'profile', 'email'],
  offlineAccess: false,
  webClientId: GOOGLE_OAUTH_CLIENT_IDS.ANDROID,  // Must be Web Client ID!
};
```

> **Critical**: `webClientId` must be a **Web application** type OAuth client, not Android type. This is required to receive `idToken`.

---

## Web Configuration

Web platform uses Supabase OAuth flow directly (no native Google Sign-In SDK).

### Supabase Configuration

1. Go to [Supabase Dashboard](https://supabase.com/dashboard) → Authentication → Providers → Google
2. Enable Google provider
3. Add Web Client ID and Client Secret
4. Configure redirect URL: `https://your-domain.com/oauth_callback_web/`

---

## Browser Extension Configuration

Extension uses `chrome.identity.launchWebAuthFlow` with the Web Client ID.

### Google Cloud Console

1. Create/edit Web application OAuth client
2. Add authorized redirect URI:
   ```
   https://<extension-id>.chromiumapp.org
   ```

---

## Troubleshooting

### iOS: "Cannot read property 'SIGN_IN_CANCELLED' of null"

**Cause**: Native module not linked properly.

**Solution**:
1. Check `@react-native-google-signin/google-signin` is not excluded
2. Run `pod install`
3. Clean build and rebuild in Xcode

### iOS: "DEVELOPER_ERROR" or sign-in fails silently

**Cause**: URL scheme not configured or wrong Client ID.

**Solution**:
1. Verify URL scheme in Info.plist matches reversed iOS Client ID
2. Verify `iosClientId` in code matches Google Cloud Console

### Android: "DEVELOPER_ERROR"

**Cause**: SHA-1 fingerprint mismatch or wrong Client ID.

**Solution**:
1. Run `./gradlew signingReport` to get SHA-1
2. Add SHA-1 to Google Cloud Console OAuth client
3. Ensure `webClientId` is a Web type client (not Android)

### All Platforms: "No ID token received"

**Cause**: Using wrong client type or `offlineAccess` misconfigured.

**Solution**:
1. Ensure using **Web Client ID** for `webClientId` parameter
2. For native apps, both `webClientId` (web type) and native client must be configured

---

## References

- [Google Sign-In for iOS](https://developers.google.com/identity/sign-in/ios/start)
- [Google Sign-In for Android](https://developers.google.com/identity/sign-in/android/start)
- [@react-native-google-signin/google-signin](https://github.com/react-native-google-signin/google-signin)
- [Supabase Google Auth (React Native)](https://supabase.com/docs/guides/auth/social-login/auth-google?platform=react-native)


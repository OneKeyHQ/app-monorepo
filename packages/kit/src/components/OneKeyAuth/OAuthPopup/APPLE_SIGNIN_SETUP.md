# Apple Sign-In Setup Guide

This document describes how to configure Apple Sign-In for the OneKey app, with a focus on web platform setup.

## Overview

OneKey uses Apple Sign-In with Supabase for authentication. The web platform uses Supabase's OAuth flow:

1. User clicks "Sign in with Apple"
2. Supabase generates OAuth URL with PKCE flow
3. User authenticates with Apple in popup window
4. Apple redirects to Supabase with authorization code
5. Supabase exchanges code for session
6. OneKey receives access/refresh tokens

## Prerequisites

Before starting, ensure you have:

1. **Apple Developer Program Membership** ($99/年) - https://developer.apple.com/programs/enroll/
   > ⚠️ **免费开发者账户不支持 Sign in with Apple！** 你需要付费会员才能：
   > - 创建 App ID 和 Services ID
   > - 生成私钥 (.p8 文件)
   > - 配置 OAuth 回调 URL
   
2. Access to **Supabase Dashboard** (https://supabase.com/dashboard)

## Local Development Testing

**可以在本地测试 Apple Sign-In！** 原理如下：

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐     ┌─────────────┐
│ localhost   │────>│  Supabase (HTTPS)│────>│    Apple    │────>│  Supabase   │
│ :3000       │     │  OAuth URL       │     │   Sign-In   │     │  Callback   │
└─────────────┘     └──────────────────┘     └─────────────┘     └─────────────┘
                                                                       │
                                                                       ▼
                                                              ┌─────────────────┐
                                                              │  localhost:3000 │
                                                              │  /oauth_callback│
                                                              └─────────────────┘
```

**关键点**：
- Apple OAuth 的 callback 先到达 Supabase（HTTPS），不是直接到 localhost
- Supabase 再重定向到你的 localhost
- 所以 **localhost 不需要 HTTPS**

### 本地开发配置步骤

1. **Apple Developer Console - Services ID 配置**:
   - **Domains**: 添加 `localhost`
   - **Return URLs**: 保持 Supabase callback URL（不需要改）
     ```
     https://zvxscjkvkjepbrjncvzt.supabase.co/auth/v1/callback
     ```

2. **Supabase Dashboard - Redirect URLs**:
   - 添加本地开发 URL：
     ```
     http://localhost:3000/oauth_callback_web/
     http://127.0.0.1:3000/oauth_callback_web/
     ```

3. **启动本地开发服务器**:
   ```bash
   yarn app:web
   ```

4. **访问** `http://localhost:3000` 并测试 Apple 登录

> **注意**: 如果端口不是 3000，请相应修改 Supabase 的 Redirect URLs

---

## Part 1: Apple Developer Console Configuration

### Step 1: Create an App ID

1. Go to [Apple Developer Console](https://developer.apple.com/account)
2. Navigate to **Certificates, Identifiers & Profiles** → **Identifiers**
3. Click the **+** button to create a new identifier
4. Select **App IDs** → **Continue**
5. Select **App** type → **Continue**
6. Fill in the details:
   - **Description**: OneKey Wallet
   - **Bundle ID**: `so.onekey.wallet.desktop` (or your bundle ID)
7. Under **Capabilities**, check **Sign in with Apple**
8. Click **Continue** → **Register**

### Step 2: Create a Services ID (Required for Web)

1. In **Identifiers**, click **+** again
2. Select **Services IDs** → **Continue**
3. Fill in the details:
   - **Description**: OneKey Web Login
   - **Identifier**: `so.onekey.wallet.web` (this will be your `client_id`)
4. Click **Continue** → **Register**
5. **Click on the newly created Services ID** to configure it
6. Check **Sign in with Apple** → Click **Configure**
7. Configure the Web Authentication:
   - **Primary App ID**: Select your App ID from Step 1
   - **Domains and Subdomains**: Add your domains, e.g.:
     ```
     app.onekey.so
     localhost
     ```
   - **Return URLs** (Redirect URIs): Add:
     ```
     https://zvxscjkvkjepbrjncvzt.supabase.co/auth/v1/callback
     ```
     > **Note**: Replace with your Supabase project URL. Find it at:
     > Supabase Dashboard → Project Settings → API → Project URL
8. Click **Save** → **Continue** → **Save**

### Step 3: Create a Private Key

1. Navigate to **Keys** in the left sidebar
2. Click **+** to create a new key
3. Fill in:
   - **Key Name**: OneKey Sign In Key
4. Check **Sign in with Apple** → Click **Configure**
5. Select your **Primary App ID** from Step 1
6. Click **Save** → **Continue** → **Register**
7. **Download the key file** (`.p8` file) - you can only download this once!
8. Note down the **Key ID** (10-character string)

### Step 4: Note Your Team ID

1. Go to [Apple Developer Account](https://developer.apple.com/account)
2. Your **Team ID** is shown in the top right, or under **Membership Details**

---

## Part 2: Supabase Configuration

### Step 1: Configure Apple Provider

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Navigate to **Authentication** → **Providers**
4. Find **Apple** and click to expand
5. Toggle **Enable Sign in with Apple**
6. Fill in the configuration:

| Field | Value | Description |
|-------|-------|-------------|
| **Client ID (Services ID)** | `so.onekey.wallet.web` | The Services ID identifier from Step 2 |
| **Secret Key** | `-----BEGIN PRIVATE KEY-----...` | Contents of the `.p8` file downloaded in Step 3 |
| **Key ID** | `ABC1234567` | The 10-character Key ID from Step 3 |
| **Team ID** | `TEAM123456` | Your 10-character Team ID from Step 4 |

7. Click **Save**

### Step 2: Configure Redirect URLs

1. Navigate to **Authentication** → **URL Configuration**
2. Add your application's OAuth callback URLs to **Redirect URLs**:

For Web Platform:
```
https://app.onekey.so/oauth_callback_web/
http://localhost:3000/oauth_callback_web/
```

For Desktop Platform (localhost server):
```
http://localhost:3846/oauth_callback_desktop
http://127.0.0.1:3846/oauth_callback_desktop
```

> **Note**: The trailing slash matters! Match exactly what your application sends.

### Step 3: Verify Configuration

Test the setup:
1. Go to **Authentication** → **Providers** → **Apple**
2. Check that all fields are filled correctly
3. Ensure no error messages are displayed

---

## Part 3: Web Platform Implementation

The web platform OAuth is already implemented in the codebase. Here's how it works:

### OAuth Flow

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐     ┌──────────────┐
│   OneKey    │────>│   Supabase   │────>│    Apple    │────>│   Callback   │
│   Web App   │     │   OAuth URL  │     │   Sign-In   │     │   Handler    │
└─────────────┘     └──────────────┘     └─────────────┘     └──────────────┘
      │                                                              │
      │                                                              │
      └──────────────────── Session Tokens ──────────────────────────┘
```

### Key Files

| File | Purpose |
|------|---------|
| `OAuthPopup.tsx` | Web popup OAuth implementation |
| `OAuthPopupBase.ts` | Shared OAuth utilities |
| `useSupabaseAuth.tsx` | React hook for OAuth sign-in |
| `authConsts.ts` | OAuth configuration constants |

### Usage in Code

```typescript
import { useSupabaseAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/supabase/useSupabaseAuth';

function LoginComponent() {
  const { signInWithApple } = useSupabaseAuth();
  
  const handleAppleLogin = async () => {
    try {
      const result = await signInWithApple({
        persistSession: true, // Save session to storage
      });
      
      if (result.success) {
        console.log('Logged in with Apple!');
        console.log('Access Token:', result.session?.accessToken);
      }
    } catch (error) {
      console.error('Apple Sign-In failed:', error);
    }
  };
  
  return (
    <button onClick={handleAppleLogin}>
      Sign in with Apple
    </button>
  );
}
```

### Redirect URL Configuration

The redirect URL is defined in `authConsts.ts`:

```typescript
export const OAUTH_CALLBACK_WEB_PATH = '/oauth_callback_web/';
```

The full redirect URL is constructed as:
```
${window.location.origin}/oauth_callback_web/
// Example: https://app.onekey.so/oauth_callback_web/
```

---

## Part 4: Desktop & Extension Configuration

### Desktop (Electron)

Desktop uses a localhost HTTP server for OAuth callback:

1. The redirect URL is: `http://localhost:3846/oauth_callback_desktop`
2. This is already configured in `OAuthPopup.desktop.tsx`
3. Make sure to add this URL in:
   - Apple Developer Console → Services ID → Return URLs
   - Supabase Dashboard → URL Configuration → Redirect URLs

### Browser Extension

Extensions use `chrome.identity.launchWebAuthFlow`:

1. The redirect URL format is: `https://<extension-id>.chromiumapp.org`
2. This is automatically handled by Chrome
3. Add the redirect URL in:
   - Apple Developer Console → Services ID → Return URLs
   - Supabase Dashboard → URL Configuration → Redirect URLs

> **Note**: You need to know your extension ID. For development, use a stable extension ID by configuring `key` in `manifest.json`.

---

## Part 5: iOS & Android Configuration

### iOS Native

For iOS, you can use native Apple Sign-In:

1. Enable "Sign in with Apple" capability in Xcode:
   - Select your target → **Signing & Capabilities**
   - Click **+ Capability** → **Sign in with Apple**

2. The bundle ID must match your App ID from Apple Developer Console

3. Native sign-in returns an ID token that can be exchanged with Supabase:

```typescript
// Example using @invertase/react-native-apple-authentication
import appleAuth from '@invertase/react-native-apple-authentication';

const appleAuthResult = await appleAuth.performRequest({
  requestedOperation: appleAuth.Operation.LOGIN,
  requestedScopes: [appleAuth.Scope.EMAIL, appleAuth.Scope.FULL_NAME],
});

// Exchange Apple ID token with Supabase
const { data, error } = await supabase.auth.signInWithIdToken({
  provider: 'apple',
  token: appleAuthResult.identityToken,
});
```

### Android - 使用 Web OAuth 流程

**Android 可以使用 Apple 登录！** Apple 官方支持通过 Web OAuth 流程在 Android 上实现 Sign in with Apple。

参考: [Apple 官方文档 - 在网站和其他平台上使用 Sign in with Apple](https://developer.apple.com/cn/sign-in-with-apple/usage-guidelines-for-websites-and-other-platforms/)

#### 实现原理

Android 没有原生的 Apple Sign-In SDK，但可以通过 **expo-web-browser** 打开 Web OAuth 流程：

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐     ┌──────────────┐
│  Android    │────>│  In-App      │────>│   Apple     │────>│   Deep Link  │
│    App      │     │  Browser     │     │  Sign-In    │     │   Callback   │
└─────────────┘     └──────────────┘     └─────────────┘     └──────────────┘
```

#### 当前实现

在 `OAuthPopup.native.tsx` 中：
- `signInWithApple` 会自动使用 `openWithWebBrowser` 方法
- 使用 `expo-web-browser.openAuthSessionAsync` 打开 Apple 登录页面
- 回调通过 deep link `onekey-wallet://oauth_callback_native` 返回 App

#### 配置要求

1. **Apple Developer Console**:
   - Services ID 的 **Return URLs** 需要添加 Supabase callback:
     ```
     https://zvxscjkvkjepbrjncvzt.supabase.co/auth/v1/callback
     ```

2. **Supabase Dashboard**:
   - **Redirect URLs** 需要添加 deep link:
     ```
     onekey-wallet://oauth_callback_native
     ```

3. **Android App**:
   - 确保 `onekey-wallet://` deep link scheme 已正确配置
   - 在 `AndroidManifest.xml` 中配置 intent filter

#### 代码使用

```typescript
// Android 上调用 signInWithApple 会自动使用 WebBrowser 流程
const { signInWithApple } = useSupabaseAuth();

const result = await signInWithApple({ persistSession: true });
```

#### 注意事项

| 对比项 | iOS | Android |
|-------|-----|---------|
| 登录方式 | 可用原生 SDK 或 Web 流程 | 只能用 Web 流程 |
| 用户体验 | 原生弹窗，体验更好 | 打开内置浏览器 |
| Face ID / 指纹 | 支持 | 需要输入 Apple ID 密码 |
| 配置复杂度 | 需要 Xcode 配置 | 只需 Supabase 配置 |

---

## Troubleshooting

### "Invalid client_id"

**Cause**: The Services ID doesn't match or isn't configured correctly.

**Solution**:
1. Verify the Services ID in Supabase matches exactly (case-sensitive)
2. Ensure the Services ID has "Sign in with Apple" enabled
3. Check the domain/return URL configuration

### "redirect_uri_mismatch"

**Cause**: The redirect URL doesn't match Apple's configuration.

**Solution**:
1. Check the Return URL in Apple Developer Console
2. Ensure the URL in Supabase matches exactly (including trailing slash)
3. Verify the domain is listed in the Services ID configuration

### "invalid_grant" or Token Exchange Fails

**Cause**: The private key or team configuration is incorrect.

**Solution**:
1. Re-download the `.p8` private key
2. Verify the Key ID matches (10 characters)
3. Verify the Team ID matches (10 characters)
4. Ensure the private key content includes the full `-----BEGIN PRIVATE KEY-----` header

### Popup Blocked

**Cause**: Browser blocking popup window.

**Solution**:
1. User needs to allow popups for the site
2. Ensure the popup is triggered by user action (click handler)

### "User cancelled" Error

**Cause**: User closed the Apple Sign-In popup without completing authentication.

**Solution**: This is expected behavior - handle gracefully in UI.

---

## Security Considerations

1. **Never expose the private key** (`.p8` file) in client-side code
2. **Use HTTPS** for all production redirect URLs
3. **Validate state parameters** to prevent CSRF attacks (already implemented)
4. **Use PKCE flow** for enhanced security (already enabled)

---

## Quick Reference: Required URLs

### Apple Developer Console - Services ID Configuration

**Domains**:
```
app.onekey.so
localhost (for development)
```

**Return URLs**:
```
https://zvxscjkvkjepbrjncvzt.supabase.co/auth/v1/callback
```

### Supabase - Redirect URLs

```
https://app.onekey.so/oauth_callback_web/
http://localhost:3000/oauth_callback_web/
http://localhost:3846/oauth_callback_desktop
http://127.0.0.1:3846/oauth_callback_desktop
https://<extension-id>.chromiumapp.org
```

---

## Related Documentation

- [Supabase Apple OAuth Guide](https://supabase.com/docs/guides/auth/social-login/auth-apple)
- [Apple Sign in with Apple Documentation](https://developer.apple.com/sign-in-with-apple/)
- [Apple REST API for Sign in with Apple](https://developer.apple.com/documentation/sign_in_with_apple/sign_in_with_apple_rest_api)


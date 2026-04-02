# apple-auth-macos

Native Apple Sign-In for macOS Electron apps.

## Requirements

- macOS 10.15 (Catalina) or later
- Xcode Command Line Tools
- Node.js with node-gyp

## Build

```bash
cd apps/desktop/native-modules/apple-auth-macos
npm install
npm run build
```

Or from project root:

```bash
node apps/desktop/development/build_apple_auth.js
```

## Usage

```javascript
const appleAuth = require('./native-modules/apple-auth-macos');

// Check availability
if (appleAuth.isAvailable()) {
  try {
    const result = await appleAuth.signIn();
    console.log('Identity Token:', result.identityToken);
    console.log('Raw Nonce:', result.rawNonce);

    // Use with Supabase
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: result.identityToken,
      nonce: result.rawNonce,
    });
  } catch (error) {
    if (error.message.includes('cancelled')) {
      console.log('User cancelled');
    } else {
      console.error('Sign-in failed:', error);
    }
  }
}
```

## API

### `isAvailable(): boolean`

Check if Apple Sign-In is available on this system.

### `signIn(): Promise<AppleSignInResult>`

Perform Apple Sign-In. Returns:

```typescript
interface AppleSignInResult {
  identityToken: string;    // JWT to send to Supabase
  authorizationCode?: string;
  user: string;             // Apple user ID
  email?: string;           // Only on first sign-in
  fullName?: string;        // Only on first sign-in
  rawNonce: string;         // For Supabase nonce validation
}
```

## Important Notes

1. **Supabase Configuration**: Make sure your Supabase Apple provider has the correct bundle ID configured in "Client ID(s)".

2. **App Signing**: For production, the app must be properly signed with Apple Developer certificate and have the "Sign in with Apple" capability.

3. **First Sign-In**: Email and full name are only provided on the user's first sign-in with your app. Store them if needed.


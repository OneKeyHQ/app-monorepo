const _IS_DEV = process.env.NODE_ENV !== 'production';

/**
 * OAuth IPC event channel name for desktop OAuth callback
 */
export const OAUTH_CALLBACK_DESKTOP_CHANNEL =
  'oauth:desktop_localhost_server:callback';

/**
 * OAuth callback path for desktop localhost server
 */
export const OAUTH_CALLBACK_DESKTOP_PATH = '/oauth_callback_desktop';

/**
 * OAuth callback path for web platform
 */
export const OAUTH_CALLBACK_WEB_PATH = '/oauth_callback_web/';

/**
 * OAuth callback path for native platforms (iOS/Android)
 */
export const OAUTH_CALLBACK_NATIVE_PATH = 'oauth_callback_native';

// ============================================================================
// OAuth shared constants (OneKeyAuth)
// ============================================================================

// OAuth provider types (used by OneKeyAuth)
export enum EOAuthSocialLoginProvider {
  Google = 'google',
  Apple = 'apple',
}

// OAuth method enums (used by OneKeyAuth)
export enum EDesktopOAuthMethod {
  // ✅ RECOMMENDED
  // Use localhost HTTP server + Google ID Token + Supabase signInWithIdToken (recommended)
  // Bypasses Supabase redirect URL restrictions
  // Uses system browser for OAuth
  LOCALHOST_SERVER = 'LOCALHOST_SERVER',

  // Use in-app webview to handle OAuth
  // Intercepts navigation to onekey-wallet://oauth_callback_native
  WEBVIEW = 'WEBVIEW',

  // Use system browser + deep link callback
  // Requires onekey-wallet:// protocol to be registered
  DEEP_LINK = 'DEEP_LINK',
}

export enum EExtensionOAuthMethod {
  // ✅ RECOMMENDED: Use chrome.identity.launchWebAuthFlow with signInWithIdToken
  // This method manually builds Google OAuth URL with response_type=id_token
  // Then uses signInWithIdToken to exchange the ID token for a Supabase session
  // Redirect URL: https://<extension-id>.chromiumapp.org/
  CHROME_IDENTITY_API = 'CHROME_IDENTITY_API',

  // ⚠️ NOT SUPPORTED (currently does not work in our implementation)
  // We can get an access token via chrome.identity.getAuthToken, but it does NOT provide an id_token.
  // Supabase signInWithIdToken requires an id_token, so our current flow throws and asks to use
  // CHROME_IDENTITY_API instead. See `openOAuthPopupExtIdToken()` implementation for details.
  CHROME_GET_AUTH_TOKEN = 'CHROME_GET_AUTH_TOKEN',

  // ❌ DOES NOT WORK: Direct chrome-extension:// scheme
  // Redirect URL: chrome-extension://<extension-id>/ui-oauth-callback.html
  // Chrome blocks external websites from redirecting to chrome-extension:// URLs
  // Kept for reference only - do not use
  DIRECT_EXTENSION_SCHEME = 'DIRECT_EXTENSION_SCHEME',
}

export enum ENativeOAuthMethod {
  // ✅ RECOMMENDED: Use @react-native-google-signin/google-signin or expo-apple-authentication with signInWithIdToken
  NATIVE_SDK = 'NATIVE_SDK',

  // Fallback: Use expo-web-browser.openAuthSessionAsync
  // Opens in-app browser for OAuth, uses deep link callback
  // Redirect URL: onekey-wallet://oauth_callback_native
  WEB_BROWSER = 'WEB_BROWSER',
}

// 5 minutes OAuth timeout (used by web/desktop/ext flows)
export const OAUTH_FLOW_TIMEOUT_MS = 5 * 60 * 1000;

// Popup sizing (web + extension OAuth windows)
export const OAUTH_POPUP_WIDTH = 500;
export const OAUTH_POPUP_HEIGHT = 700;

// Desktop in-app webview dialog sizing
export const OAUTH_DESKTOP_WEBVIEW_WIDTH = 480;
export const OAUTH_DESKTOP_WEBVIEW_HEIGHT = 640;

// Poll / focus interval used by web popup + extension OAuth window focusing
export const OAUTH_POLL_INTERVAL_MS = 500;

// OneKey-owned state (defense-in-depth) used for OAuth flows where the upstream provider
// does not reliably include `state` in the authorize URL / callback.
export const ONEKEY_OAUTH_STATE_KEY = 'onekey_oauth_state';

// Common OAuth callback token keys (hash/search params)
export const OAUTH_TOKEN_KEY_ACCESS_TOKEN = 'access_token';
export const OAUTH_TOKEN_KEY_REFRESH_TOKEN = 'refresh_token';
export const OAUTH_TOKEN_KEY_ID_TOKEN = 'id_token';

// Google OAuth
export const GOOGLE_OAUTH_AUTHORIZE_URL =
  'https://accounts.google.com/o/oauth2/auth';
export const GOOGLE_OAUTH_TOKEN_INFO_URL =
  'https://oauth2.googleapis.com/tokeninfo';
export const GOOGLE_OAUTH_USERINFO_URL =
  'https://www.googleapis.com/oauth2/v3/userinfo';

export const GOOGLE_OAUTH_DEFAULT_SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

export const EXTENSION_OAUTH_USE_PKCE_FLOW = true;

// Apple Sign-In nonce support
// When enabled, a nonce will be generated and passed to Apple Sign-In for replay attack protection
// Reference: https://developer.apple.com/documentation/authenticationservices/asauthorizationopenidrequest/nonce
export const APPLE_SIGNIN_USE_NONCE = true;

// Desktop native Apple Sign-In (macOS only)
// When enabled, macOS will use native ASAuthorizationController for Apple Sign-In
// instead of opening the browser. Provides better UX with system UI and Touch ID.
// Set to false to always use browser OAuth flow.
export const MAC_DESKTOP_USE_NATIVE_APPLE_SIGNIN = false;

// Email OTP
export const EMAIL_OTP_COUNTDOWN_SECONDS = 60;

// Default OAuth method selection (OneKeyAuth)
export const DEFAULT_EXTENSION_OAUTH_METHOD: EExtensionOAuthMethod =
  EExtensionOAuthMethod.CHROME_IDENTITY_API;
export const DEFAULT_DESKTOP_OAUTH_METHOD: EDesktopOAuthMethod =
  EDesktopOAuthMethod.LOCALHOST_SERVER;

export const DEFAULT_NATIVE_OAUTH_METHOD: ENativeOAuthMethod =
  ENativeOAuthMethod.NATIVE_SDK;
// export const DEFAULT_NATIVE_OAUTH_METHOD: ENativeOAuthMethod =
// ENativeOAuthMethod.WEB_BROWSER;

// Google OAuth clients
//  - https://console.cloud.google.com/auth/clients
// Google OAuth client id (Chrome extension)
// Configure in Google Cloud Console:
// - OAuth client: https://console.cloud.google.com/apis/credentials
// - Authorized redirect URIs (for chrome.identity.launchWebAuthFlow):
//   https://<extension-id>.chromiumapp.org  (no trailing slash)

// TODO: Search for all occurrences of 'apps.googleusercontent.com' in the project and consolidate all discovered OAuth client IDs here for unified management.

// ================================================
// Google OAuth Clients
// -----------------------------------------------

// prod
const GOOGLE_OAUTH_CLIENT_WEB =
  '94391474021-6106ge2amfsgl9gjviojmai2mqbh2lte.apps.googleusercontent.com';
const GOOGLE_OAUTH_CLIENT_IOS =
  '94391474021-kbgarvu23k3mblp1m2tiknemae99p826.apps.googleusercontent.com';

// test
// const GOOGLE_OAUTH_CLIENT_WEB =

// oxlint-disable-next-line @cspell/spellchecker
//   '244450898872-vmpg9dgocpqtqhm5pk42u4s6hvprogp6.apps.googleusercontent.com';
// const GOOGLE_OAUTH_CLIENT_IOS =

// oxlint-disable-next-line @cspell/spellchecker
//   '244450898872-5uo9r8ekdc82huckjcr4br67edvf3vlg.apps.googleusercontent.com';

// ================================================

export const GOOGLE_OAUTH_CLIENT_IDS = {
  WEB: GOOGLE_OAUTH_CLIENT_WEB,
  EXTENSION: GOOGLE_OAUTH_CLIENT_WEB, // oauth web client, not extension client
  ANDROID: GOOGLE_OAUTH_CLIENT_WEB,
  IOS: GOOGLE_OAUTH_CLIENT_IOS,
};

// Supabase (OneKeyAuth)
// Project URL at https://supabase.com/dashboard/project/_/settings/api
export const SUPABASE_PROJECT_URL = 'https://bwgpgzbzdgkisozswlck.supabase.co';

// Publishable key at https://supabase.com/dashboard/project/_/settings/api-keys/new
export const SUPABASE_PUBLIC_API_KEY =
  'sb_publishable_bnNx0b2QZENMm1OLNAyHeQ_FLagwrqN';

// ================================================
// Keyless Supabase
// -----------------------------------------------

// --- onekey prod
export const KEYLESS_SUPABASE_PROJECT_URL = 'https://auth.onekey.so'; // onekeytest
// export const KEYLESS_SUPABASE_PUBLIC_API_KEY =

// oxlint-disable-next-line @cspell/spellchecker
//   'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzY3NzU4MzUwLCJleHAiOjE5MjU0MzgzNTB9.n-g7Amu-dMVpBgQ8i8gSYFjBvbDPC55ZqYIttPh8CYk';
export const KEYLESS_SUPABASE_PUBLIC_API_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzY5MTc1MzMxLCJleHAiOjE5MjY4NTUzMzF9.d0Zd8eBV8L_EcKDXiJRNTEYGw-dX6IdyDCr0nvOiLqg';

// --- onekeytest
// export const KEYLESS_SUPABASE_PROJECT_URL =
//   'https://supabase.onekey-internal.com'; // onekeytest
// export const KEYLESS_SUPABASE_PUBLIC_API_KEY =

// oxlint-disable-next-line @cspell/spellchecker
//   'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzY3NTg3OTE4LCJleHAiOjE5MjUyNjc5MTh9.F69Rgt30To2V0Rij1nbTpjkHyAv6VpWGz3a81rkpM0U';

// --- local test
// export const KEYLESS_SUPABASE_PROJECT_URL =
//   'https://wtspqckturkzhstyjabx.supabase.co';
// export const KEYLESS_SUPABASE_PUBLIC_API_KEY =

// oxlint-disable-next-line @cspell/spellchecker
//   'sb_publishable_So24RIupCcXUHaKo1gM4VA_uOBbgjoN';

// ================================================

type IJuiceBoxRealmConfig = {
  id: string;
  address: string;
  public_key?: string;
};

type IJuiceBoxConfigJSON = {
  realms: IJuiceBoxRealmConfig[];
  register_threshold: number;
  recover_threshold: number;
  pin_hashing_mode: 'Standard2019' | 'FastInsecure';
};

export const JUICEBOX_AUTH_SERVER = 'https://juicebox.onekeycn.com';
export const JUICEBOX_CONFIG: IJuiceBoxConfigJSON = {
  realms: [
    {
      id: '37ce3a59ff08d57b77bac0b8451ff2d8',
      address: 'https://production-juicebox.onekey-safe.com',
      // address: 'https://career-publisher-interaction-cfr.trycloudflare.com',
    },
    {
      id: '6b47cc201434428be7beee2190f95685',
      address: 'https://juice.rpcbox.com',
      // address:
      // 'https://created-portsmouth-smallest-eligibility.trycloudflare.com',
    },
  ],
  register_threshold: 2, // At least 2 realms must succeed to register
  recover_threshold: 2, // At least 2 realms must succeed to recover
  pin_hashing_mode: 'Standard2019',
};
export const JUICEBOX_ALLOWED_GUESSES = 7; // Number of allowed PIN guess attempts

// Keyless Backend Share Payload Encryption
// Fixed encryption key for keyless backend share payload encryption
export const KEYLESS_BACKEND_SHARE_PAYLOAD_ENCRYPTION_KEY =
  '54C86638-407F-4E5B-AAF0-B782A2399F6A';
// Prefix to identify encrypted payloads (required for decryption)
export const KEYLESS_BACKEND_SHARE_PAYLOAD_ENCRYPTION_PREFIX =
  'backend_share_enc_v1:';

// Keyless encryption iterations (PBKDF2 iterations for key derivation)
export const KEYLESS_ENCRYPTION_ITERATIONS = 600_000;

// Keyless AES-GCM AAD (Additional Authenticated Data)
// Bind ciphertext to its intended usage context to prevent cross-purpose substitution.

// AAD Version Management
export const KEYLESS_AAD_VERSIONS = {
  MNEMONIC: {
    v1: 'keyless-mnemonic-v1',
    // Future versions can be added here:
    // v2: 'keyless-mnemonic-v2',
  },
  BACKEND_SHARE_PAYLOAD: {
    v1: 'keyless-backend-share-payload-v1',
    // Future versions can be added here:
    // v2: 'keyless-backend-share-payload-v2',
  },
} as const;

// Current active versions (used for encryption)
export const KEYLESS_AAD_CURRENT_VERSION = {
  MNEMONIC: 'v1' as const,
  BACKEND_SHARE_PAYLOAD: 'v1' as const,
};

// Backward compatible constants (use current version)
export const KEYLESS_MNEMONIC_GCM_AAD =
  KEYLESS_AAD_VERSIONS.MNEMONIC[KEYLESS_AAD_CURRENT_VERSION.MNEMONIC];
export const KEYLESS_BACKEND_SHARE_PAYLOAD_GCM_AAD =
  KEYLESS_AAD_VERSIONS.BACKEND_SHARE_PAYLOAD[
    KEYLESS_AAD_CURRENT_VERSION.BACKEND_SHARE_PAYLOAD
  ];

// Helper function to get AAD by version
export function getKeylessAadByVersion(
  type: keyof typeof KEYLESS_AAD_VERSIONS,
  version?: keyof (typeof KEYLESS_AAD_VERSIONS)[typeof type],
): string {
  const targetVersion = version || KEYLESS_AAD_CURRENT_VERSION[type];
  return KEYLESS_AAD_VERSIONS[type][targetVersion];
}

// Supabase OAuth Providers
// https://supabase.com/dashboard/project/_/auth/providers

// Supabase OAuth Redirect URIs
// https://supabase.com/dashboard/project/_/auth/url-configuration

// Supabase DOCS
// - https://supabase.com/docs/guides/auth/social-login/auth-google
// - https://react-native-google-signin.github.io/docs/setting-up/ios

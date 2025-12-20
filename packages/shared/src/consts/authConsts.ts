/* eslint-disable spellcheck/spell-checker */

const IS_DEV = process.env.NODE_ENV !== 'production';

/**
 * OAuth IPC event channel name for desktop OAuth callback
 */
export const OAUTH_CALLBACK_DESKTOP_CHANNEL =
  'oauth:desktop_localhost_server:callback';

// ============================================================================
// OAuth shared constants (OneKeyAuth)
// ============================================================================

// OAuth method enums (used by OneKeyAuth)
export enum EDesktopOAuthMethod {
  // ✅ RECOMMENDED
  // Use localhost HTTP server + Google ID Token + Supabase signInWithIdToken (recommended)
  // Bypasses Supabase redirect URL restrictions
  // Uses system browser for OAuth
  LOCALHOST_SERVER = 'LOCALHOST_SERVER',

  // Use in-app webview to handle OAuth
  // Intercepts navigation to onekey-wallet://auth/callback
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

// Common OAuth callback token keys (hash/search params)
export const OAUTH_TOKEN_KEY_ACCESS_TOKEN = 'access_token';
export const OAUTH_TOKEN_KEY_REFRESH_TOKEN = 'refresh_token';
export const OAUTH_TOKEN_KEY_ID_TOKEN = 'id_token';

// Google OAuth
export const GOOGLE_OAUTH_AUTHORIZE_URL =
  'https://accounts.google.com/o/oauth2/auth';
export const GOOGLE_OAUTH_TOKENINFO_URL =
  'https://oauth2.googleapis.com/tokeninfo';
export const GOOGLE_OAUTH_USERINFO_URL =
  'https://www.googleapis.com/oauth2/v3/userinfo';

export const GOOGLE_OAUTH_DEFAULT_SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

export const EXTENSION_OAUTH_USE_PKCE_FLOW = true;

// Email OTP
export const EMAIL_OTP_COUNTDOWN_SECONDS = 60;

// Default OAuth method selection (OneKeyAuth)
export const DEFAULT_EXTENSION_OAUTH_METHOD: EExtensionOAuthMethod =
  EExtensionOAuthMethod.CHROME_IDENTITY_API;
export const DEFAULT_DESKTOP_OAUTH_METHOD: EDesktopOAuthMethod =
  EDesktopOAuthMethod.LOCALHOST_SERVER;

// Google OAuth clients
//  - https://console.cloud.google.com/auth/clients
// Google OAuth client id (Chrome extension)
// Configure in Google Cloud Console:
// - OAuth client: https://console.cloud.google.com/apis/credentials
// - Authorized redirect URIs (for chrome.identity.launchWebAuthFlow):
//   https://<extension-id>.chromiumapp.org  (no trailing slash)
export const GOOGLE_CHROME_EXTENSION_CLIENT_ID =
  '244450898872-d22ubafv8ca38s6fp0kflhdr6e3s386u.apps.googleusercontent.com'; // oauth web client, not extension client
// TODO: Search for all occurrences of 'apps.googleusercontent.com' in the project and consolidate all discovered OAuth client IDs here for unified management.

// Supabase (OneKeyAuth)
// Project URL at https://supabase.com/dashboard/project/_/settings/api
export const SUPABASE_PROJECT_URL = IS_DEV
  ? process.env.SUPABASE_PROJECT_URL ||
    'https://zvxscjkvkjepbrjncvzt.supabase.co' // local test
  : 'https://zvxscjkvkjepbrjncvzt.supabase.co';

// Publishable key at https://supabase.com/dashboard/project/_/settings/api-keys/new
export const SUPABASE_PUBLIC_API_KEY = IS_DEV
  ? process.env.SUPABASE_PUBLIC_API_KEY ||
    'sb_publishable_ryfw0-h47JC2lHFRB2yrjw_iS_1KPgW' // local test
  : 'sb_publishable_ryfw0-h47JC2lHFRB2yrjw_iS_1KPgW';

// Supabase OAuth Providers
// https://supabase.com/dashboard/project/_/auth/providers

// Supabase OAuth Redirect URIs
// https://supabase.com/dashboard/project/_/auth/url-configuration

// Supabase DOCS
// - https://supabase.com/docs/guides/auth/social-login/auth-google

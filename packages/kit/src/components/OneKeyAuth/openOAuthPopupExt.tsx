/* eslint-disable spellcheck/spell-checker */
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import type {
  IHandleOAuthSessionPersistenceParams,
  IOAuthPopupResult,
} from './openOAuthPopupWeb';

// Get the original chrome API
// webextension-polyfill may override global.chrome but doesn't include chrome.identity
// In Firefox, the original chrome is saved to chromeLegacy
// In Chrome, we can use globalThis.chrome directly
function getChromeApi(): typeof chrome {
  const g = globalThis as typeof globalThis & {
    chromeLegacy?: typeof chrome;
    chrome?: typeof chrome;
  };
  const api = g.chromeLegacy || g.chrome;
  if (!api) {
    throw new OneKeyLocalError(
      'Chrome API is not available. This code must run in a Chrome Extension context.',
    );
  }
  return api;
}

// ============================================================================
// Extension OAuth Methods
// ============================================================================

export enum EExtensionOAuthMethod {
  // ✅ RECOMMENDED: Use getChromeApi().identity.launchWebAuthFlow with signInWithIdToken
  // This method manually builds Google OAuth URL with response_type=id_token
  // Then uses signInWithIdToken to exchange the ID token for a Supabase session
  // Redirect URL: https://<extension-id>.chromiumapp.org/
  // This is the Supabase recommended approach for Chrome Extensions
  CHROME_IDENTITY_API = 'CHROME_IDENTITY_API',

  // ✅ ALTERNATIVE: Use getChromeApi().identity.getAuthToken
  // This method uses Chrome's built-in OAuth flow via manifest oauth2 config
  // Then fetches user info and uses signInWithIdToken
  // Requires oauth2.client_id in manifest.json
  CHROME_GET_AUTH_TOKEN = 'CHROME_GET_AUTH_TOKEN',

  // ❌ DOES NOT WORK: Direct chrome-extension:// scheme
  // Redirect URL: chrome-extension://<extension-id>/ui-oauth-callback.html
  // Chrome blocks external websites from redirecting to chrome-extension:// URLs
  // Kept for reference only - do not use
  DIRECT_EXTENSION_SCHEME = 'DIRECT_EXTENSION_SCHEME',
}

/**
 * Get OAuth redirect URL for Chrome Extension
 *
 * Returns different URLs based on the OAuth method:
 * - CHROME_IDENTITY_API: undefined (handled internally by openOAuthPopupExtIdentity)
 * - CHROME_GET_AUTH_TOKEN: undefined (Chrome handles internally)
 * - DIRECT_EXTENSION_SCHEME: chrome-extension://<extension-id>/ui-oauth-callback.html
 *
 * @param method - The extension OAuth method to use
 * @returns The redirect URL for extension OAuth, or undefined if not needed
 */
export function getOAuthRedirectUrlExt(
  method: EExtensionOAuthMethod,
): string | undefined {
  if (
    method === EExtensionOAuthMethod.CHROME_IDENTITY_API ||
    method === EExtensionOAuthMethod.CHROME_GET_AUTH_TOKEN
  ) {
    // These methods handle redirect URL internally, not needed externally
    return undefined;
  }
  // Use direct chrome-extension:// scheme
  // Format: chrome-extension://<extension-id>/ui-oauth-callback.html
  return getChromeApi().runtime.getURL('ui-oauth-callback.html');
}

/**
 * OAuth configuration for Google sign-in
 * These values should match your Google Cloud Console OAuth 2.0 Client ID settings
 */
export interface IExtensionOAuthConfig {
  // Google OAuth Client ID for Chrome Extension
  // Create this in Google Cloud Console > APIs & Services > Credentials > OAuth 2.0 Client IDs
  // Application type: Chrome Extension
  googleClientId: string;
  // OAuth scopes to request
  scopes?: string[];
}

/**
 * Default OAuth scopes for Google sign-in
 */
const DEFAULT_GOOGLE_SCOPES = [
  'openid',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

/**
 * OAuth helper for Chrome Extension using getChromeApi().identity.launchWebAuthFlow
 * with Google ID Token + Supabase signInWithIdToken
 *
 * This is the RECOMMENDED method for extension OAuth based on Supabase documentation.
 *
 * How it works:
 * 1. Manually builds Google OAuth URL with response_type=id_token
 * 2. Opens a popup window for OAuth using getChromeApi().identity.launchWebAuthFlow
 * 3. Chrome handles the OAuth flow and redirect automatically
 * 4. Extracts id_token from callback URL hash
 * 5. Uses Supabase signInWithIdToken to exchange for session
 *
 * Supabase Configuration Required:
 * - Add Chrome Extension Client ID to Supabase Dashboard > Authentication > Providers > Google
 * - If you have multiple client IDs, concatenate them with comma (web ID first)
 *
 * @param config - OAuth configuration including Google Client ID
 * @param supabaseClient - Supabase client instance for signInWithIdToken
 * @param handleSessionPersistence - Function to handle session persistence
 * @param options - Configuration options
 * @returns Promise with success status and session tokens
 */
export async function openOAuthPopupExtIdentity(
  config: IExtensionOAuthConfig,
  supabaseClient: {
    auth: {
      signInWithIdToken: (params: {
        provider: 'google';
        token: string;
        nonce?: string;
      }) => Promise<{
        data: {
          session: { access_token: string; refresh_token: string } | null;
        };
        error: Error | null;
      }>;
    };
  },
  handleSessionPersistence: (
    params: IHandleOAuthSessionPersistenceParams,
  ) => Promise<void>,
  options: {
    persistSession: boolean;
  },
): Promise<IOAuthPopupResult> {
  const { persistSession } = options;
  const { googleClientId, scopes = DEFAULT_GOOGLE_SCOPES } = config;

  // Get chrome API and check if chrome.identity is available
  const chromeApi = getChromeApi();
  if (!chromeApi.identity) {
    throw new OneKeyLocalError(
      'chrome.identity API is not available. ' +
        'Make sure you are running in a Chrome Extension context (not content script) ' +
        'and the "identity" permission is added to manifest.json. ' +
        'Try rebuilding the extension and reloading it in chrome://extensions.',
    );
  }

  try {
    // Build Google OAuth URL manually with response_type=id_token
    // This is the key difference from the standard OAuth flow
    let redirectUrl = chromeApi.identity.getRedirectURL();
    // Remove trailing slash to match Google Cloud Console configuration
    if (redirectUrl.endsWith('/')) {
      redirectUrl = redirectUrl.slice(0, -1);
    }
    const authUrl = new URL('https://accounts.google.com/o/oauth2/auth');

    authUrl.searchParams.set('client_id', googleClientId);
    authUrl.searchParams.set('response_type', 'id_token');
    authUrl.searchParams.set('access_type', 'offline');
    authUrl.searchParams.set('redirect_uri', redirectUrl);
    authUrl.searchParams.set('scope', scopes.join(' '));
    // Generate a random nonce for security (optional but recommended)
    const nonce = crypto.randomUUID();
    authUrl.searchParams.set('nonce', nonce);
    // Force account selection
    authUrl.searchParams.set('prompt', 'select_account');

    // Launch the OAuth flow
    const callbackUrl = await chromeApi.identity.launchWebAuthFlow({
      url: authUrl.href,
      interactive: true,
    });

    if (!callbackUrl) {
      return {
        success: false,
        session: undefined,
      };
    }

    // Parse id_token from the callback URL hash
    const url = new URL(callbackUrl);
    const hashParams = new URLSearchParams(url.hash.substring(1));
    const idToken = hashParams.get('id_token');

    if (!idToken) {
      throw new OneKeyLocalError('No ID token received from Google OAuth');
    }

    // Exchange ID token for Supabase session using signInWithIdToken
    const { data, error } = await supabaseClient.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
      nonce,
    });

    if (error) {
      throw new OneKeyLocalError(error.message);
    }

    if (!data.session) {
      return {
        success: false,
        session: undefined,
      };
    }

    const accessToken = data.session.access_token;
    const refreshToken = data.session.refresh_token;

    // Handle session persistence
    await handleSessionPersistence({
      client: null as never, // Not needed for extension
      accessToken,
      refreshToken,
      persistSession,
    });

    return {
      success: true,
      session: {
        accessToken,
        refreshToken,
      },
    };
  } catch (error) {
    // User closed the popup or other error
    if (
      error instanceof Error &&
      error.message.includes('The user did not approve')
    ) {
      throw new OneKeyLocalError('OAuth sign-in was cancelled');
    }
    throw new OneKeyLocalError(
      error instanceof Error ? error.message : 'Extension OAuth failed',
    );
  }
}

/**
 * OAuth helper for Chrome Extension using getChromeApi().identity.getAuthToken
 *
 * This is an ALTERNATIVE method that uses Chrome's built-in OAuth via manifest oauth2 config.
 *
 * How it works:
 * 1. Uses getChromeApi().identity.getAuthToken to get Google Access Token (via manifest oauth2 config)
 * 2. Fetches user info from Google to get the ID Token
 * 3. Uses Supabase signInWithIdToken to exchange for session
 *
 * Prerequisites:
 * - manifest.json must have oauth2.client_id and oauth2.scopes configured
 * - Google Cloud Console: Create Chrome Extension type OAuth Client ID
 * - Supabase Dashboard: Add Chrome Extension Client ID to Google Provider
 *
 * manifest.json example:
 * {
 *   "oauth2": {
 *     "client_id": "YOUR_CHROME_CLIENT_ID.apps.googleusercontent.com",
 *     "scopes": ["openid", "email", "profile"]
 *   }
 * }
 *
 * @param supabaseClient - Supabase client instance for signInWithIdToken
 * @param handleSessionPersistence - Function to handle session persistence
 * @param options - Configuration options
 * @returns Promise with success status and session tokens
 */
export async function openOAuthPopupExtIdToken(
  supabaseClient: {
    auth: {
      signInWithIdToken: (params: {
        provider: 'google';
        token: string;
        access_token?: string;
      }) => Promise<{
        data: {
          session: { access_token: string; refresh_token: string } | null;
        };
        error: Error | null;
      }>;
    };
  },
  _handleSessionPersistence: (
    params: IHandleOAuthSessionPersistenceParams,
  ) => Promise<void>,
  _options: {
    persistSession: boolean;
  },
): Promise<IOAuthPopupResult> {
  void supabaseClient;

  // Get chrome API and check if chrome.identity is available
  const chromeApi = getChromeApi();
  if (!chromeApi.identity) {
    throw new OneKeyLocalError(
      'chrome.identity API is not available. ' +
        'Make sure you are running in a Chrome Extension context (not content script) ' +
        'and the "identity" permission is added to manifest.json. ' +
        'Try rebuilding the extension and reloading it in chrome://extensions.',
    );
  }

  try {
    // Step 1: Get Google Access Token using chrome.identity.getAuthToken
    // This requires oauth2 config in manifest.json
    const authResult = await chromeApi.identity.getAuthToken({
      interactive: true,
    });

    if (!authResult.token) {
      throw new OneKeyLocalError('Failed to get Google auth token');
    }

    const googleAccessToken = authResult.token;

    // Step 2: Fetch user info from Google to get the ID token
    // We need to use the tokeninfo endpoint to get additional token details
    const tokenInfoResponse = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?access_token=${googleAccessToken}`,
    );

    if (!tokenInfoResponse.ok) {
      throw new OneKeyLocalError('Failed to validate Google token');
    }

    // Step 3: Get the ID token by making an OAuth request
    // Since getAuthToken doesn't directly return id_token, we need to use a different approach
    // We'll use the access token to get user info and then exchange with Supabase
    const userInfoResponse = await fetch(
      'https://www.googleapis.com/oauth2/v3/userinfo',
      {
        headers: {
          Authorization: `Bearer ${googleAccessToken}`,
        },
      },
    );

    if (!userInfoResponse.ok) {
      throw new OneKeyLocalError('Failed to get user info from Google');
    }

    const userInfo = (await userInfoResponse.json()) as {
      sub: string;
      email: string;
      email_verified: boolean;
      name: string;
      picture: string;
    };

    // Note: getAuthToken doesn't provide id_token directly
    // We need to use launchWebAuthFlow with response_type=id_token for proper ID token
    // This method is kept as an alternative but openOAuthPopupExtIdentity is preferred

    // For now, we'll throw an error indicating this method needs the manifest oauth2 config
    // with proper setup to get id_token
    throw new OneKeyLocalError(
      'getAuthToken method requires id_token. Please use CHROME_IDENTITY_API method instead, ' +
        `or configure manifest oauth2. User email: ${userInfo.email}`,
    );

    // Uncomment below if you have a way to get id_token from getAuthToken flow:
    // const { data, error } = await supabaseClient.auth.signInWithIdToken({
    //   provider: 'google',
    //   token: idToken, // Need to get this from somewhere
    //   access_token: googleAccessToken,
    // });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('The user did not approve')
    ) {
      throw new OneKeyLocalError('OAuth sign-in was cancelled');
    }
    throw new OneKeyLocalError(
      error instanceof Error ? error.message : 'Extension OAuth failed',
    );
  }
}

/**
 * OAuth popup window helper for Chrome Extension platform
 *
 * ⚠️ WARNING: THIS METHOD DOES NOT WORK ⚠️
 *
 * This method attempts to use the direct chrome-extension:// scheme for OAuth callback,
 * but it FAILS because Chrome blocks external websites from redirecting to chrome-extension:// URLs.
 *
 * Error: ERR_BLOCKED_BY_CLIENT
 * Reason: Chrome security restriction prevents web pages from redirecting to extension URLs
 *         to protect users from malicious websites triggering extension actions.
 *
 * OAuth flow that fails:
 *   Google/Apple OAuth → Supabase → chrome-extension://xxx/ui-oauth-callback.html
 *                                   ↑ Chrome blocks this redirect
 *
 * RECOMMENDED: Use CHROME_IDENTITY_API method instead (openOAuthPopupExtIdentity)
 * - Uses getChromeApi().identity.launchWebAuthFlow API
 * - Redirect URL: https://<extension-id>.chromiumapp.org/auth/callback
 * - Chrome specially handles .chromiumapp.org URLs for extension OAuth
 *
 * This code is kept for reference but should NOT be used.
 *
 * ---
 * Original design (non-functional):
 * Uses getChromeApi().windows.create to open a popup window for OAuth authentication.
 * Monitors tab URL changes to detect the OAuth callback and extract tokens.
 *
 * This method uses the direct chrome-extension:// scheme:
 * - Opens a popup window for OAuth
 * - Monitors URL changes via getChromeApi().tabs.onUpdated
 * - Extracts tokens when URL matches chrome-extension://<id>/ui-oauth-callback.html
 *
 * Supabase Redirect URL to add:
 *   chrome-extension://<extension-id>/ui-oauth-callback.html
 *
 * @param authUrl - The OAuth authorization URL to open
 * @param handleSessionPersistence - Function to handle session persistence
 * @param options - Configuration options
 * @returns Promise with success status and session tokens
 * @deprecated Use openOAuthPopupExtIdentity instead - this method does not work due to Chrome security restrictions
 */
export function openOAuthPopupExtWindow(
  authUrl: string,
  handleSessionPersistence: (
    params: IHandleOAuthSessionPersistenceParams,
  ) => Promise<void>,
  options: {
    persistSession: boolean;
  },
): Promise<IOAuthPopupResult> {
  const { persistSession } = options;
  const chromeApi = getChromeApi();

  return new Promise((resolve, reject) => {
    // Popup window dimensions (same as web OAuth popup)
    const width = 500;
    const height = 700;
    let windowId: number | undefined;
    let resolved = false;

    // Helper to close window safely
    const closeWindow = () => {
      if (windowId !== undefined) {
        try {
          void chromeApi.windows.remove(windowId);
        } catch {
          // Window may already be closed
        }
      }
    };

    // Store listener references for cleanup
    const listeners = {
      onTabUpdated: null as
        | ((
            tabId: number,
            changeInfo: chrome.tabs.TabChangeInfo,
            tab: chrome.tabs.Tab,
          ) => void)
        | null,
      onWindowRemoved: null as ((removedWindowId: number) => void) | null,
    };

    // Helper to remove all listeners
    const cleanup = () => {
      if (listeners.onTabUpdated) {
        chromeApi.tabs.onUpdated.removeListener(listeners.onTabUpdated);
      }
      if (listeners.onWindowRemoved) {
        chromeApi.windows.onRemoved.removeListener(listeners.onWindowRemoved);
      }
    };

    // Listen for window close (user cancelled)
    listeners.onWindowRemoved = (removedWindowId: number) => {
      if (removedWindowId === windowId && !resolved) {
        resolved = true;
        cleanup();
        reject(new OneKeyLocalError('OAuth sign-in was cancelled'));
      }
    };

    // Listen for tab URL changes to detect OAuth callback
    listeners.onTabUpdated = (
      _tabId: number,
      changeInfo: chrome.tabs.TabChangeInfo,
      tab: chrome.tabs.Tab,
    ) => {
      // Only process tabs in our OAuth window
      if (tab.windowId !== windowId || resolved) {
        return;
      }

      // Check multiple URL sources:
      // - changeInfo.url: When URL changes during navigation
      // - tab.url: Current tab URL
      // - tab.pendingUrl: URL that the tab is navigating to (useful when navigation is blocked)
      const tabUrl =
        changeInfo.url ||
        tab.url ||
        (tab as chrome.tabs.Tab & { pendingUrl?: string }).pendingUrl;
      if (!tabUrl) {
        return;
      }

      // Check if URL is our callback URL with tokens
      if (
        tabUrl.startsWith(
          `chrome-extension://${chromeApi.runtime.id}/ui-oauth-callback.html`,
        )
      ) {
        resolved = true;
        cleanup();
        closeWindow();

        // Parse tokens from the URL
        try {
          const parsedUrl = new URL(tabUrl);
          const hashParams = new URLSearchParams(
            parsedUrl.hash.substring(1) || parsedUrl.search.substring(1),
          );

          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');

          if (accessToken && refreshToken) {
            void handleSessionPersistence({
              // Note: client is not needed for extension as we only call the persistence handler
              client: null as never,
              accessToken,
              refreshToken,
              persistSession,
            }).then(() => {
              resolve({
                success: true,
                session: {
                  accessToken,
                  refreshToken,
                },
              });
            });
          } else {
            resolve({
              success: false,
              session: undefined,
            });
          }
        } catch (error) {
          reject(
            new OneKeyLocalError(
              error instanceof Error
                ? error.message
                : 'Failed to process OAuth callback',
            ),
          );
        }
      }
    };

    // Add listeners before creating window
    chromeApi.tabs.onUpdated.addListener(listeners.onTabUpdated);
    chromeApi.windows.onRemoved.addListener(listeners.onWindowRemoved);

    // Create popup window for OAuth
    chromeApi.windows.create(
      {
        url: authUrl,
        type: 'popup',
        width,
        height,
        // Center the window on screen
        left: Math.round((globalThis.screen?.width || 1920) / 2 - width / 2),
        top: Math.round((globalThis.screen?.height || 1080) / 2 - height / 2),
      },
      (authWindow) => {
        if (!authWindow?.id) {
          cleanup();
          reject(new OneKeyLocalError('Failed to create OAuth window'));
          return;
        }

        windowId = authWindow.id;

        // Set timeout
        setTimeout(() => {
          if (!resolved) {
            resolved = true;
            cleanup();
            closeWindow();
            reject(new OneKeyLocalError('OAuth sign-in timed out'));
          }
        }, 5 * 60 * 1000); // 5 minutes timeout
      },
    );
  });
}

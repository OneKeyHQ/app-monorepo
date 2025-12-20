/* eslint-disable spellcheck/spell-checker */
import {
  EExtensionOAuthMethod,
  EXTENSION_OAUTH_USE_PKCE_FLOW,
  GOOGLE_OAUTH_AUTHORIZE_URL,
  GOOGLE_OAUTH_DEFAULT_SCOPES,
  GOOGLE_OAUTH_TOKENINFO_URL,
  GOOGLE_OAUTH_USERINFO_URL,
  OAUTH_FLOW_TIMEOUT_MS,
  OAUTH_POLL_INTERVAL_MS,
  OAUTH_POPUP_HEIGHT,
  OAUTH_POPUP_WIDTH,
  OAUTH_TOKEN_KEY_ACCESS_TOKEN,
  OAUTH_TOKEN_KEY_ID_TOKEN,
  OAUTH_TOKEN_KEY_REFRESH_TOKEN,
} from '@onekeyhq/shared/src/consts/authConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import type {
  IExtensionOAuthConfig,
  IHandleOAuthSessionPersistenceParams,
  IOAuthPopupResult,
} from './openOAuthPopupTypes';
import type { SupabaseClient } from '@supabase/supabase-js';

// ============================================================================
// Extension OAuth Methods
// ============================================================================

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
  return chrome.runtime.getURL('ui-oauth-callback.html');
}

/**
 * OAuth configuration for Google sign-in
 * These values should match your Google Cloud Console OAuth 2.0 Client ID settings
 */
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
 * @param options - Configuration options
 * @param options.config - OAuth configuration including Google Client ID
 * @param options.handleSessionPersistence - Function to handle session persistence
 * @param options.persistSession - Whether to persist the session
 * @returns Promise with success status and session tokens
 */
export async function openOAuthPopupExtIdentity(options: {
  client: SupabaseClient;
  config: IExtensionOAuthConfig;
  handleSessionPersistence: (
    params: IHandleOAuthSessionPersistenceParams,
  ) => Promise<void>;
  persistSession?: boolean;
}): Promise<IOAuthPopupResult> {
  const { client, config, handleSessionPersistence, persistSession } = options;
  const { googleClientId, scopes = GOOGLE_OAUTH_DEFAULT_SCOPES } = config;

  if (!chrome.identity) {
    throw new OneKeyLocalError(
      'chrome.identity API is not available. ' +
        'Make sure you are running in a Chrome Extension context (not content script) ' +
        'and the "identity" permission is added to manifest.json. ' +
        'Try rebuilding the extension and reloading it in chrome://extensions.',
    );
  }

  const getRedirectUrl = (): string => {
    // https://<extension-id>.chromiumapp.org/
    let redirectUrl = chrome.identity.getRedirectURL();
    // Remove trailing slash to match Google Cloud Console configuration (and existing behavior).
    if (redirectUrl.endsWith('/')) {
      redirectUrl = redirectUrl.slice(0, -1);
    }
    return redirectUrl;
  };

  type IExtensionOAuthFlowParams = { redirectUrl: string };
  type IExtensionOAuthFlowSignInParams = {
    rawNonce?: string;
    expectedState?: string;
  };
  type IExtensionOAuthFlowGetAuthUrlResult = {
    authUrl: string;
    signInParams: IExtensionOAuthFlowSignInParams;
  };
  type IExtensionOAuthFlowSignInInput = {
    callbackUrl: string;
    signInParams: IExtensionOAuthFlowSignInParams;
  };
  type IExtensionOAuthFlowBuilder = (params: IExtensionOAuthFlowParams) => {
    getAuthUrl: () => Promise<IExtensionOAuthFlowGetAuthUrlResult>;
    signIn: (
      input: IExtensionOAuthFlowSignInInput,
    ) => Promise<IOAuthPopupResult>;
  };

  const launchWebAuthFlowWithTimeout = async (url: string) => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    try {
      return await Promise.race([
        chrome.identity.launchWebAuthFlow({
          url,
          interactive: true,
        }),
        new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => {
            reject(new OneKeyLocalError('OAuth sign-in timed out'));
          }, OAUTH_FLOW_TIMEOUT_MS);
        }),
      ]);
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    }
  };

  const buildPkceFlowParams = ({ redirectUrl }: IExtensionOAuthFlowParams) => ({
    getAuthUrl: async () => {
      const oauthUrlResult = await client.auth.signInWithOAuth({
        provider: 'google',
        options: {
          skipBrowserRedirect: true,
          redirectTo: redirectUrl,
          queryParams: {
            prompt: 'select_account',
          },
        },
      });

      if (oauthUrlResult.error) {
        throw new OneKeyLocalError(oauthUrlResult.error.message);
      }
      const authUrl = oauthUrlResult.data?.url;
      if (!authUrl) {
        throw new OneKeyLocalError('Failed to create Supabase OAuth URL.');
      }
      let expectedState: string | undefined;
      try {
        expectedState = new URL(authUrl).searchParams.get('state') ?? undefined;
      } catch {
        expectedState = undefined;
      }
      return {
        authUrl,
        signInParams: { expectedState },
      };
    },
    signIn: async ({
      callbackUrl,
      signInParams,
    }: IExtensionOAuthFlowSignInInput) => {
      // https://<extension-id>.chromiumapp.org/?code=xxxx
      const url = new URL(callbackUrl);
      if (!callbackUrl.startsWith(redirectUrl)) {
        throw new OneKeyLocalError('Invalid OAuth redirect URL');
      }
      const error =
        url.searchParams.get('error') ||
        url.searchParams.get('error_description');
      if (error) {
        throw new OneKeyLocalError(error);
      }

      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      if (signInParams.expectedState) {
        if (!state) {
          throw new OneKeyLocalError('OAuth state is missing');
        }
        if (state !== signInParams.expectedState) {
          throw new OneKeyLocalError('OAuth state mismatch');
        }
      }
      if (!code) {
        return {
          success: false,
          session: undefined,
        };
      }

      const { data, error: exchangeError } =
        await client.auth.exchangeCodeForSession(code);
      if (exchangeError) {
        throw new OneKeyLocalError(exchangeError.message);
      }

      if (!data.session) {
        return {
          success: false,
          session: undefined,
        };
      }

      const accessToken = data.session.access_token;
      const refreshToken = data.session.refresh_token;

      await handleSessionPersistence({
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
    },
  });

  const processFlow = async ({
    redirectUrl,
    buildFlowParams,
  }: IExtensionOAuthFlowParams & {
    buildFlowParams: IExtensionOAuthFlowBuilder;
  }) => {
    const { getAuthUrl, signIn } = buildFlowParams({ redirectUrl });
    const { authUrl, signInParams } = await getAuthUrl();
    const callbackUrl = await launchWebAuthFlowWithTimeout(authUrl);

    if (!callbackUrl) {
      return {
        success: false,
        session: undefined,
      };
    }

    return signIn({ callbackUrl, signInParams });
  };

  const buildOidcFlowParams = ({ redirectUrl }: IExtensionOAuthFlowParams) => ({
    getAuthUrl: async () => {
      // Build Google OAuth URL manually with response_type=id_token
      // This is the key difference from the standard OAuth flow
      const authUrl = new URL(GOOGLE_OAUTH_AUTHORIZE_URL);

      authUrl.searchParams.set('client_id', googleClientId);
      authUrl.searchParams.set('response_type', 'id_token');
      authUrl.searchParams.set('access_type', 'offline');
      authUrl.searchParams.set('redirect_uri', redirectUrl);
      authUrl.searchParams.set('scope', scopes.join(' '));
      // Generate a random nonce for security
      // Supabase requires: hash the nonce before sending to Google, but pass raw nonce to Supabase
      const rawNonce = crypto.randomUUID();
      // Hash the nonce using SHA-256 for Google OAuth
      const encoder = new TextEncoder();
      const nonceData = encoder.encode(rawNonce);
      const hashBuffer = await crypto.subtle.digest('SHA-256', nonceData);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashedNonce = hashArray
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      // Pass hashed nonce to Google OAuth URL
      authUrl.searchParams.set('nonce', hashedNonce);
      // Force account selection
      authUrl.searchParams.set('prompt', 'select_account');

      return {
        authUrl: authUrl.href,
        signInParams: { rawNonce },
      };
    },
    signIn: async ({
      callbackUrl,
      signInParams,
    }: IExtensionOAuthFlowSignInInput) => {
      const rawNonce = signInParams.rawNonce;
      if (!rawNonce) {
        throw new OneKeyLocalError('Missing nonce for Google OAuth sign-in.');
      }
      // Parse id_token from the callback URL hash
      const url = new URL(callbackUrl);
      const hashParams = new URLSearchParams(url.hash.substring(1));
      const idToken = hashParams.get(OAUTH_TOKEN_KEY_ID_TOKEN);

      if (!idToken) {
        throw new OneKeyLocalError('No ID token received from Google OAuth');
      }

      // Exchange ID token for Supabase session using signInWithIdToken
      // Pass raw nonce to Supabase (not hashed)
      // Use a temporary client that doesn't persist sessions automatically
      // This allows us to get the session data without persisting it automatically
      const tempClient = client;
      const { data, error } = await tempClient.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
        nonce: rawNonce, // Pass raw nonce to Supabase
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

      // Handle session persistence (only if persistSession is true)
      await handleSessionPersistence({
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
    },
  });

  // Launch the OAuth flow
  // Note: chrome.identity.launchWebAuthFlow doesn't support window size/position options
  // Chrome controls the OAuth window and may not allow modifications
  // We'll set up a listener to try updating the window when it's created
  const width = OAUTH_POPUP_WIDTH;
  const height = OAUTH_POPUP_HEIGHT;
  const left = Math.round((globalThis.screen?.width || 1920) / 2 - width / 2);
  const top = Math.round((globalThis.screen?.height || 1080) / 2 - height / 2);

  // Set up a one-time listener to catch the OAuth window when it's created
  // Declare outside try block so it can be cleaned up in catch
  let windowUpdateListener: ((window: chrome.windows.Window) => void) | null =
    null;
  let focusInterval: ReturnType<typeof setInterval> | null = null;
  let oauthWindowId: number | null = null;

  windowUpdateListener = (window: chrome.windows.Window) => {
    if (window.type === 'popup' && window.id) {
      oauthWindowId = window.id;
      // Try to update window size and position
      // Note: Chrome may ignore these updates for OAuth windows
      chrome.windows
        .update(window.id, {
          width,
          height,
          left,
          top,
          focused: true, // Try to bring window to front
        })
        .catch(() => {
          // Ignore errors - Chrome may not allow updating OAuth windows
        });

      // Set up a polling interval to periodically focus the OAuth window
      // Similar to web OAuth popup behavior (openOAuthPopupWeb.tsx)
      // This ensures the OAuth window stays in front during the authentication flow
      focusInterval = setInterval(() => {
        if (oauthWindowId !== null) {
          chrome.windows.update(oauthWindowId, { focused: true }).catch(() => {
            // Ignore errors - window may be closed or Chrome may not allow focusing
          });
        }
      }, OAUTH_POLL_INTERVAL_MS); // Same cadence as web implementation

      // Remove listener after first window is found
      if (windowUpdateListener) {
        chrome.windows.onCreated.removeListener(windowUpdateListener);
      }
    }
  };

  chrome.windows.onCreated.addListener(windowUpdateListener);

  const cleanup = () => {
    if (windowUpdateListener) {
      chrome.windows.onCreated.removeListener(windowUpdateListener);
    }
    if (focusInterval !== null) {
      clearInterval(focusInterval);
      focusInterval = null;
    }
  };

  const redirectUrl = getRedirectUrl();

  try {
    // --------------------------------------------------------------------------
    // PKCE mode (Supabase OAuth URL + exchangeCodeForSession)
    //
    // Still uses:
    // - chrome.identity.launchWebAuthFlow()
    // so it matches the extension constraint and avoids relying on window.open().
    //
    // When true, use Supabase OAuth + PKCE code flow and exchange the returned code for a session.
    // When false (default), use Google OIDC id_token + nonce and exchange via signInWithIdToken().
    // --------------------------------------------------------------------------
    if (EXTENSION_OAUTH_USE_PKCE_FLOW) {
      return await processFlow({
        redirectUrl,
        buildFlowParams: buildPkceFlowParams,
      });
    }
    return await processFlow({
      redirectUrl,
      buildFlowParams: buildOidcFlowParams,
    });
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
  } finally {
    try {
      cleanup();
    } catch {
      // Ignore cleanup errors to avoid masking the original OAuth error.
    }
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
 * @param options - Configuration options
 * @param options.handleSessionPersistence - Function to handle session persistence
 * @param options.persistSession - Whether to persist the session
 * @returns Promise with success status and session tokens
 */
export async function openOAuthPopupExtIdToken(_options: {
  handleSessionPersistence: (
    params: IHandleOAuthSessionPersistenceParams,
  ) => Promise<void>;
  persistSession?: boolean;
}): Promise<IOAuthPopupResult> {
  if (!chrome.identity) {
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
    const authResult = await chrome.identity.getAuthToken({
      interactive: true,
    });

    if (!authResult.token) {
      throw new OneKeyLocalError('Failed to get Google auth token');
    }

    const googleAccessToken = authResult.token;

    // Step 2: Fetch user info from Google to get the ID token
    // We need to use the tokeninfo endpoint to get additional token details
    const tokenInfoResponse = await fetch(
      `${GOOGLE_OAUTH_TOKENINFO_URL}?${OAUTH_TOKEN_KEY_ACCESS_TOKEN}=${googleAccessToken}`,
    );

    if (!tokenInfoResponse.ok) {
      throw new OneKeyLocalError('Failed to validate Google token');
    }

    // Step 3: Get the ID token by making an OAuth request
    // Since getAuthToken doesn't directly return id_token, we need to use a different approach
    // We'll use the access token to get user info and then exchange with Supabase
    const userInfoResponse = await fetch(GOOGLE_OAUTH_USERINFO_URL, {
      headers: {
        Authorization: `Bearer ${googleAccessToken}`,
      },
    });

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
 * @param options - Configuration options
 * @param options.authUrl - The OAuth authorization URL to open
 * @param options.handleSessionPersistence - Function to handle session persistence
 * @param options.persistSession - Whether to persist the session
 * @returns Promise with success status and session tokens
 * @deprecated Use openOAuthPopupExtIdentity instead - this method does not work due to Chrome security restrictions
 */
export function openOAuthPopupExtWindow(options: {
  authUrl: string;
  handleSessionPersistence: (
    params: IHandleOAuthSessionPersistenceParams,
  ) => Promise<void>;
  persistSession?: boolean;
}): Promise<IOAuthPopupResult> {
  const { authUrl, handleSessionPersistence, persistSession } = options;

  return new Promise((resolve, reject) => {
    // Popup window dimensions (same as web OAuth popup)
    const width = OAUTH_POPUP_WIDTH;
    const height = OAUTH_POPUP_HEIGHT;
    let windowId: number | undefined;
    let resolved = false;

    // Helper to close window safely
    const closeWindow = () => {
      if (windowId !== undefined) {
        try {
          void chrome.windows.remove(windowId);
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
        chrome.tabs.onUpdated.removeListener(listeners.onTabUpdated);
      }
      if (listeners.onWindowRemoved) {
        chrome.windows.onRemoved.removeListener(listeners.onWindowRemoved);
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
          `chrome-extension://${chrome.runtime.id}/ui-oauth-callback.html`,
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

          const accessToken = hashParams.get(OAUTH_TOKEN_KEY_ACCESS_TOKEN);
          const refreshToken = hashParams.get(OAUTH_TOKEN_KEY_REFRESH_TOKEN);

          if (accessToken && refreshToken) {
            void handleSessionPersistence({
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
    chrome.tabs.onUpdated.addListener(listeners.onTabUpdated);
    chrome.windows.onRemoved.addListener(listeners.onWindowRemoved);

    // Create popup window for OAuth
    chrome.windows.create(
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
        }, OAUTH_FLOW_TIMEOUT_MS); // 5 minutes timeout
      },
    );
  });
}

import {
  EXTENSION_OAUTH_USE_PKCE_FLOW,
  GOOGLE_OAUTH_AUTHORIZE_URL,
  GOOGLE_OAUTH_CLIENT_IDS,
  GOOGLE_OAUTH_DEFAULT_SCOPES,
  OAUTH_FLOW_TIMEOUT_MS,
  OAUTH_POLL_INTERVAL_MS,
  OAUTH_POPUP_HEIGHT,
  OAUTH_POPUP_WIDTH,
  OAUTH_TOKEN_KEY_ID_TOKEN,
  ONEKEY_OAUTH_STATE_KEY,
} from '@onekeyhq/shared/src/consts/authConsts';
import {
  OAuthLoginCancelError,
  OneKeyLocalError,
} from '@onekeyhq/shared/src/errors';

import { OAuthPopupBase } from './OAuthPopupBase';

import type { IOAuthPopupOptions, IOAuthPopupResult } from './types';
import type { SupabaseClient } from '@supabase/supabase-js';

// ============================================================================
// Internal Types
// ============================================================================

interface IExtensionOAuthFlowSignInParams {
  rawNonce?: string;
  expectedState?: string;
  expectedOneKeyState?: string;
}

interface IExtensionOAuthFlowGetAuthUrlResult {
  authUrl: string;
  signInParams: IExtensionOAuthFlowSignInParams;
}

interface IExtensionOAuthFlowSignInInput {
  callbackUrl: string;
  signInParams: IExtensionOAuthFlowSignInParams;
}

interface IExtensionOAuthFlowBuilder {
  getAuthUrl: () => Promise<IExtensionOAuthFlowGetAuthUrlResult>;
  signIn: (input: IExtensionOAuthFlowSignInInput) => Promise<IOAuthPopupResult>;
}

// ============================================================================
// Extension OAuth Popup Implementation
// ============================================================================

/**
 * OAuth popup implementation for Chrome Extension platform.
 *
 * Uses chrome.identity.launchWebAuthFlow for OAuth authentication.
 * Supports two flows:
 * - PKCE flow: Supabase OAuth URL + exchangeCodeForSession
 * - OIDC flow: Google id_token + signInWithIdToken
 */
export class OAuthPopup extends OAuthPopupBase {
  // ============ Public API ============

  /**
   * Get OAuth redirect URL for Chrome Extension.
   *
   * Returns: https://<extension-id>.chromiumapp.org
   */
  static override getRedirectUrl(): Promise<string> {
    let redirectUrl = chrome.identity.getRedirectURL();
    // Remove trailing slash to match Google Cloud Console configuration
    if (redirectUrl.endsWith('/')) {
      redirectUrl = redirectUrl.slice(0, -1);
    }
    return Promise.resolve(redirectUrl);
  }

  /**
   * Open OAuth using chrome.identity.launchWebAuthFlow.
   *
   * Internally selects PKCE or OIDC flow based on EXTENSION_OAUTH_USE_PKCE_FLOW config.
   */
  static override async open(
    options: IOAuthPopupOptions,
  ): Promise<IOAuthPopupResult> {
    const { client, handleSessionPersistence, authUrl, redirectTo } = options;

    if (!chrome.identity) {
      throw new OneKeyLocalError(
        'chrome.identity API is not available. ' +
          'Make sure you are running in a Chrome Extension context (not content script) ' +
          'and the "identity" permission is added to manifest.json.',
      );
    }

    if (!redirectTo) {
      throw new OneKeyLocalError(
        'redirectTo is required. Call OAuthPopup.getRedirectUrl() first.',
      );
    }

    const redirectUrl = redirectTo;

    // Build flow params based on config
    const flowBuilder = EXTENSION_OAUTH_USE_PKCE_FLOW
      ? OAuthPopup.buildPkceFlowParams(redirectUrl, client, authUrl)
      : OAuthPopup.buildOidcFlowParams(redirectUrl, client);

    let originalWindowId: number | undefined;
    try {
      const currentWindow = await chrome.windows.getCurrent();
      originalWindowId = currentWindow.id;
    } catch {
      // Window may not exist in some contexts (e.g., service worker)
    }

    // Setup window focus listener
    const cleanupFocus = OAuthPopup.setupWindowFocusListener();

    try {
      const { authUrl: oauthUrl, signInParams } =
        await flowBuilder.getAuthUrl();
      const callbackUrl =
        await OAuthPopup.launchWebAuthFlowWithTimeout(oauthUrl);

      if (!callbackUrl) {
        throw new OneKeyLocalError(
          'OAuth authentication failed: callback URL is missing',
        );
      }

      const result = await flowBuilder.signIn({ callbackUrl, signInParams });

      // Handle session persistence
      if (result.success && result.session) {
        await handleSessionPersistence({
          accessToken: result.session.accessToken,
          refreshToken: result.session.refreshToken,
        });
      }

      await OAuthPopup.restoreFocusToOriginalWindow(originalWindowId);

      return result;
    } catch (error) {
      if (OAuthPopup.isUserCancelledError(error)) {
        throw new OAuthLoginCancelError();
      }
      throw OAuthPopup.wrapError(error, 'Extension OAuth failed');
    } finally {
      try {
        cleanupFocus();
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Restore focus to the original window after OAuth flow completes.
   * Fixes OK-49186: Mac Chrome fullscreen mode doesn't auto-focus back to extension.
   */
  private static async restoreFocusToOriginalWindow(
    originalWindowId: number | undefined,
  ): Promise<void> {
    try {
      if (originalWindowId !== undefined) {
        await chrome.windows.update(originalWindowId, { focused: true });
      }
    } catch {
      // Window may no longer exist
    }

    try {
      globalThis.window?.focus?.();
    } catch {
      // window.focus may not be available in service worker context
    }
  }

  // ============ Private Methods ============

  /**
   * Launch chrome.identity.launchWebAuthFlow with timeout.
   */
  private static async launchWebAuthFlowWithTimeout(
    url: string,
  ): Promise<string | undefined> {
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
      }
    }
  }

  /**
   * Build PKCE flow params (Supabase OAuth + exchangeCodeForSession).
   */
  private static buildPkceFlowParams(
    redirectUrl: string,
    client: SupabaseClient | undefined,
    externalAuthUrl: string | undefined,
  ): IExtensionOAuthFlowBuilder {
    return {
      getAuthUrl: async () => {
        if (!externalAuthUrl) {
          throw new OneKeyLocalError('Failed to create Supabase OAuth URL.');
        }

        const { expectedState, expectedOneKeyState } =
          OAuthPopup.parseExpectedStates(externalAuthUrl);

        return {
          authUrl: externalAuthUrl,
          signInParams: {
            expectedState: expectedState ?? undefined,
            expectedOneKeyState: expectedOneKeyState ?? undefined,
          },
        };
      },

      signIn: async ({ callbackUrl, signInParams }) => {
        if (!client) {
          throw new OneKeyLocalError(
            'Supabase client is required for PKCE flow',
          );
        }

        const url = new URL(callbackUrl);
        const expectedUrl = new URL(redirectUrl);

        // Extract onekey_oauth_state from both URLs for comparison
        const oneKeyState = url.searchParams.get(ONEKEY_OAUTH_STATE_KEY);
        const expectedOneKeyState = expectedUrl.searchParams.get(
          ONEKEY_OAUTH_STATE_KEY,
        );

        // Compare origin, pathname, and onekey_oauth_state
        // Query params order may differ, so we compare them separately
        if (
          url.origin !== expectedUrl.origin ||
          url.pathname !== expectedUrl.pathname ||
          oneKeyState !== expectedOneKeyState
        ) {
          throw new OneKeyLocalError(
            'OAuth callback URL does not match expected redirect URL',
          );
        }

        const error =
          url.searchParams.get('error') ||
          url.searchParams.get('error_description');
        if (error) {
          throw new OneKeyLocalError(error);
        }

        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');

        if (!code) {
          throw new OneKeyLocalError('Authorization code is missing');
        }

        // Validate states
        OAuthPopup.validateOneKeyState(
          signInParams.expectedOneKeyState ?? null,
          oneKeyState,
        );
        OAuthPopup.validateSupabaseState(
          signInParams.expectedState ?? null,
          state,
        );

        // Exchange code for session
        const { accessToken, refreshToken } =
          await OAuthPopup.exchangeCodeForSession(client, code);

        return {
          success: true,
          session: { accessToken, refreshToken },
        };
      },
    };
  }

  /**
   * Build OIDC flow params (Google id_token + signInWithIdToken).
   */
  private static buildOidcFlowParams(
    redirectUrl: string,
    client: SupabaseClient | undefined,
  ): IExtensionOAuthFlowBuilder {
    const scopes = GOOGLE_OAUTH_DEFAULT_SCOPES;

    return {
      getAuthUrl: async () => {
        // Build Google OAuth URL manually with response_type=id_token
        const authUrl = new URL(GOOGLE_OAUTH_AUTHORIZE_URL);

        authUrl.searchParams.set(
          'client_id',
          GOOGLE_OAUTH_CLIENT_IDS.EXTENSION,
        );
        authUrl.searchParams.set('response_type', 'id_token');
        authUrl.searchParams.set('access_type', 'offline');
        authUrl.searchParams.set('redirect_uri', redirectUrl);
        authUrl.searchParams.set('scope', scopes.join(' '));

        // Generate and hash nonce
        const rawNonce = crypto.randomUUID();
        const encoder = new TextEncoder();
        const nonceData = encoder.encode(rawNonce);
        const hashBuffer = await crypto.subtle.digest('SHA-256', nonceData);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashedNonce = hashArray
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');

        authUrl.searchParams.set('nonce', hashedNonce);
        authUrl.searchParams.set('prompt', 'select_account');

        return {
          authUrl: authUrl.href,
          signInParams: { rawNonce },
        };
      },

      signIn: async ({ callbackUrl, signInParams }) => {
        if (!client) {
          throw new OneKeyLocalError(
            'Supabase client is required for OIDC flow',
          );
        }

        const { rawNonce } = signInParams;
        if (!rawNonce) {
          throw new OneKeyLocalError('Missing nonce for Google OAuth sign-in.');
        }

        // Parse id_token from callback URL hash
        const url = new URL(callbackUrl);
        const hashParams = new URLSearchParams(url.hash.substring(1));
        const idToken = hashParams.get(OAUTH_TOKEN_KEY_ID_TOKEN);

        if (!idToken) {
          throw new OneKeyLocalError('No ID token received from Google OAuth');
        }

        // Exchange ID token for Supabase session
        const { data, error } = await client.auth.signInWithIdToken({
          provider: 'google',
          token: idToken,
          nonce: rawNonce,
        });

        if (error) {
          throw new OneKeyLocalError(error.message);
        }

        if (!data.session) {
          throw new OneKeyLocalError('Failed to exchange ID token for session');
        }

        return {
          success: true,
          session: {
            accessToken: data.session.access_token,
            refreshToken: data.session.refresh_token,
          },
        };
      },
    };
  }

  /**
   * Setup window focus listener for OAuth popup.
   * Returns cleanup function.
   */
  private static setupWindowFocusListener(): () => void {
    const width = OAUTH_POPUP_WIDTH;
    const height = OAUTH_POPUP_HEIGHT;
    const left = Math.round((globalThis.screen?.width || 1920) / 2 - width / 2);
    const top = Math.round(
      (globalThis.screen?.height || 1080) / 2 - height / 2,
    );

    let focusInterval: ReturnType<typeof setInterval> | null = null;
    let oauthWindowId: number | null = null;

    const windowUpdateListener = (window: chrome.windows.Window) => {
      if (window.type === 'popup' && window.id) {
        oauthWindowId = window.id;

        // Try to update window size and position
        chrome.windows
          .update(window.id, {
            width,
            height,
            left,
            top,
            focused: true,
          })
          .catch(() => {
            // Chrome may not allow updating OAuth windows
          });

        // Set up focus polling
        focusInterval = setInterval(() => {
          if (oauthWindowId !== null) {
            chrome.windows
              .update(oauthWindowId, { focused: true })
              .catch(() => {
                // Ignore focus errors
              });
          }
        }, OAUTH_POLL_INTERVAL_MS);

        chrome.windows.onCreated.removeListener(windowUpdateListener);
      }
    };

    chrome.windows.onCreated.addListener(windowUpdateListener);

    return () => {
      chrome.windows.onCreated.removeListener(windowUpdateListener);
      if (focusInterval !== null) {
        clearInterval(focusInterval);
      }
    };
  }
}

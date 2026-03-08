import {
  OAUTH_CALLBACK_WEB_PATH,
  OAUTH_FLOW_TIMEOUT_MS,
  OAUTH_POLL_INTERVAL_MS,
  OAUTH_POPUP_HEIGHT,
  OAUTH_POPUP_WIDTH,
  ONEKEY_OAUTH_STATE_KEY,
} from '@onekeyhq/shared/src/consts/authConsts';
import {
  OAuthLoginCancelError,
  OneKeyLocalError,
} from '@onekeyhq/shared/src/errors';

import { OAuthPopupBase } from './OAuthPopupBase';

import type { IOAuthPopupOptions, IOAuthPopupResult } from './types';

// ============================================================================
// Web OAuth Popup Implementation
// ============================================================================

/**
 * OAuth popup implementation for web platform.
 *
 * Uses a popup window for OAuth authentication.
 * Polls the popup URL to detect callback and extract authorization code.
 * Uses Supabase PKCE flow for secure token exchange.
 */
export class OAuthPopup extends OAuthPopupBase {
  // ============ Public API ============

  /**
   * Get OAuth redirect URL for web platform.
   *
   * Uses the current origin with /oauth_callback_web path.
   * Example: https://app.onekey.so/oauth_callback_web
   */
  static override getRedirectUrl(): Promise<string> {
    return Promise.resolve(
      `${globalThis.location?.origin || ''}${OAUTH_CALLBACK_WEB_PATH}`,
    );
  }

  /**
   * Open OAuth popup window and return result.
   *
   * Flow:
   * 1. Open popup window with OAuth URL
   * 2. Poll popup URL for authorization code
   * 3. Exchange code for session using Supabase PKCE
   * 4. Handle session persistence
   */
  static override async open(
    options: IOAuthPopupOptions,
  ): Promise<IOAuthPopupResult> {
    const { authUrl, client, handleSessionPersistence } = options;

    if (!authUrl) {
      throw new OneKeyLocalError('OAuth URL is required');
    }

    if (!client) {
      throw new OneKeyLocalError('Supabase client is required');
    }

    return new Promise((resolve, reject) => {
      let settled = false;
      let inFlight = false;
      let pollIntervalId: ReturnType<typeof setInterval> | null = null;
      let timeoutId: ReturnType<typeof setTimeout> | null = null;

      // Parse expected states for validation
      const { expectedState, expectedOneKeyState } =
        OAuthPopup.parseExpectedStates(authUrl);

      const cleanup = (popup: Window | null) => {
        if (pollIntervalId) {
          clearInterval(pollIntervalId);
          pollIntervalId = null;
        }
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        if (popup && !popup.closed) {
          OAuthPopup.closePopup(popup);
        }
      };

      const resolveOnce = (result: IOAuthPopupResult, popup: Window | null) => {
        if (settled) {
          return;
        }
        settled = true;
        cleanup(popup);
        resolve(result);
      };

      const rejectOnce = (error: unknown, popup: Window | null) => {
        if (settled) {
          return;
        }
        settled = true;
        cleanup(popup);
        reject(error);
      };

      // Calculate popup window position (centered)
      const width = OAUTH_POPUP_WIDTH;
      const height = OAUTH_POPUP_HEIGHT;
      const left = globalThis.screenX + (globalThis.outerWidth - width) / 2;
      const top = globalThis.screenY + (globalThis.outerHeight - height) / 2;

      // Open popup window
      const popup = globalThis.open(
        authUrl,
        'oauth_popup',
        `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no,scrollbars=yes,resizable=yes`,
      );

      if (!popup) {
        rejectOnce(
          new OneKeyLocalError(
            'Popup was blocked. Please allow popups and try again.',
          ),
          null,
        );
        return;
      }

      OAuthPopup.focusPopup(popup);

      // Poll for popup close and check for auth code (PKCE flow)
      pollIntervalId = setInterval(() => {
        if (inFlight) {
          return;
        }
        inFlight = true;

        void (async () => {
          try {
            if (settled) {
              return;
            }

            OAuthPopup.focusPopup(popup);

            // Check if popup is closed
            if (popup.closed) {
              // Check if we got a session after popup closed
              const { data } = await client.auth.getSession();
              if (data.session) {
                const accessToken = data.session.access_token;
                const refreshToken = data.session.refresh_token;

                await handleSessionPersistence({
                  accessToken,
                  refreshToken,
                });

                resolveOnce(
                  {
                    success: true,
                    session: { accessToken, refreshToken },
                  },
                  popup,
                );
              } else {
                rejectOnce(new OAuthLoginCancelError(), popup);
              }
              return;
            }

            // Try to read the popup URL to check for callback
            try {
              const popupUrl = popup.location.href;
              // PKCE flow: check for 'code' parameter in URL
              if (popupUrl && popupUrl.includes('code=')) {
                OAuthPopup.closePopup(popup);

                // Parse authorization code from URL query string
                const url = new URL(popupUrl);
                const code = url.searchParams.get('code');
                const state = url.searchParams.get('state');
                const oneKeyState = url.searchParams.get(
                  ONEKEY_OAUTH_STATE_KEY,
                );

                if (!code) {
                  rejectOnce(
                    new OneKeyLocalError('Authorization code is missing'),
                    popup,
                  );
                  return;
                }

                // Validate states
                OAuthPopup.validateOneKeyState(
                  expectedOneKeyState,
                  oneKeyState,
                );
                OAuthPopup.validateSupabaseState(expectedState, state);

                // Exchange code for session
                const { accessToken, refreshToken } =
                  await OAuthPopup.exchangeCodeForSession(client, code);

                await handleSessionPersistence({
                  accessToken,
                  refreshToken,
                });

                resolveOnce(
                  {
                    success: true,
                    session: { accessToken, refreshToken },
                  },
                  popup,
                );
              }
            } catch {
              // Cross-origin error - popup is on different domain, continue polling
            }
          } catch (error) {
            rejectOnce(error, popup);
          } finally {
            inFlight = false;
          }
        })();
      }, OAUTH_POLL_INTERVAL_MS);

      // Cleanup after timeout
      timeoutId = setTimeout(() => {
        rejectOnce(new OneKeyLocalError('OAuth sign-in timed out'), popup);
      }, OAUTH_FLOW_TIMEOUT_MS);
    });
  }

  // ============ Private Methods ============

  /**
   * Focus the popup window to bring it to front.
   */
  private static focusPopup(win: Window | null): void {
    try {
      win?.focus();
    } catch {
      // Focusing may fail, silently ignore
    }
  }

  /**
   * Close the popup window safely.
   */
  private static closePopup(win: Window | null): void {
    try {
      win?.close();
    } catch {
      // Closing may fail, silently ignore
    }
  }
}

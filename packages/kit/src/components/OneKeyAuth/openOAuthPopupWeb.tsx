import {
  OAUTH_FLOW_TIMEOUT_MS,
  OAUTH_POLL_INTERVAL_MS,
  OAUTH_POPUP_HEIGHT,
  OAUTH_POPUP_WIDTH,
} from '@onekeyhq/shared/src/consts/authConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import type {
  IHandleOAuthSessionPersistenceParams,
  IOAuthPopupResult,
} from './openOAuthPopupTypes';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Get OAuth redirect URL for web platform
 *
 * Uses the current origin with /auth/callback path
 * Example: https://app.onekey.so/auth/callback
 *
 * @returns The redirect URL for web OAuth
 */
export function getOAuthRedirectUrlWeb(): string {
  return `${globalThis.location?.origin || ''}/auth/callback`;
}

// Focus the popup window to bring it to front, with error handling
function focusPopup(win: Window | null) {
  try {
    win?.focus();
  } catch (e) {
    // Focusing may fail (e.g., popup not allowed or browser restrictions)
    // We silently ignore the error as it does not affect auth flow
  }
}

// Close the popup window safely, with error handling
function closePopup(win: Window | null) {
  try {
    win?.close();
  } catch (e) {
    // Closing may fail (e.g., popup already closed or browser restrictions)
    // We silently ignore the error as the popup is either already closed or inaccessible
  }
}

/**
 * OAuth popup window helper for web platform
 *
 * Opens a popup window for OAuth authentication and monitors for the callback URL.
 * Extracts tokens from the URL when authentication is complete.
 *
 * @param options - Configuration options
 * @param options.authUrl - The OAuth authorization URL to open
 * @param options.client - Supabase client instance
 * @param options.handleSessionPersistence - Function to handle session persistence
 * @param options.persistSession - Whether to persist the session (default: false)
 * @returns Promise with success status and session tokens
 */
export async function openOAuthPopupWeb(options: {
  authUrl: string;
  client: SupabaseClient;
  handleSessionPersistence: (
    params: IHandleOAuthSessionPersistenceParams,
  ) => Promise<void>;
  persistSession?: boolean;
}): Promise<IOAuthPopupResult> {
  const { authUrl, client, handleSessionPersistence, persistSession } = options;
  return new Promise((resolve, reject) => {
    let settled = false;
    let inFlight = false;
    let pollIntervalId: ReturnType<typeof setInterval> | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let expectedState: string | null = null;

    try {
      expectedState = new URL(authUrl).searchParams.get('state');
    } catch {
      expectedState = null;
    }

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
        closePopup(popup);
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

    // Open popup window without address bar and toolbar
    // Note: Web browsers don't allow forcing popups to stay on top (alwaysOnTop)
    // for security reasons. We can only focus the popup when it opens.
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

    focusPopup(popup);

    // Poll for popup close and check for auth code (PKCE flow)
    pollIntervalId = setInterval(async () => {
      if (inFlight) {
        return;
      }
      inFlight = true;
      try {
        if (settled) {
          return;
        }
        focusPopup(popup);
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
              persistSession,
              loginToPrime: false, // openOAuthPopupWeb doesn't handle Prime login
            });

            resolveOnce(
              {
                success: true,
                session: {
                  accessToken,
                  refreshToken,
                },
              },
              popup,
            );
          } else {
            resolveOnce(
              {
                success: false,
                session: undefined,
              },
              popup,
            );
          }
          return;
        }

        // Try to read the popup URL to check for callback with authorization code
        try {
          const popupUrl = popup.location.href;
          // PKCE flow: check for 'code' parameter in URL (not access_token)
          if (popupUrl && popupUrl.includes('code=')) {
            closePopup(popup);

            // Parse authorization code from URL query string
            const url = new URL(popupUrl);
            const code = url.searchParams.get('code');
            const state = url.searchParams.get('state');

            // Validate state (anti-CSRF / anti-injection). Supabase OAuth URLs should include `state=...`
            // and the redirect callback should echo it back.
            if (expectedState) {
              if (!state) {
                rejectOnce(
                  new OneKeyLocalError('OAuth state is missing'),
                  popup,
                );
                return;
              }
              if (state !== expectedState) {
                rejectOnce(new OneKeyLocalError('OAuth state mismatch'), popup);
                return;
              }
            }

            if (code) {
              // Exchange authorization code for session tokens using PKCE
              // The Supabase client automatically uses the stored code_verifier
              const { data, error } = await client.auth.exchangeCodeForSession(
                code,
              );

              if (error) {
                rejectOnce(new OneKeyLocalError(error.message), popup);
                return;
              }

              const session = data.session;
              if (session) {
                const accessToken = session.access_token;
                const refreshToken = session.refresh_token;

                await handleSessionPersistence({
                  accessToken,
                  refreshToken,
                  persistSession,
                  loginToPrime: false, // openOAuthPopupWeb doesn't handle Prime login
                });

                resolveOnce(
                  {
                    success: true,
                    session: {
                      accessToken,
                      refreshToken,
                    },
                  },
                  popup,
                );
              } else {
                resolveOnce(
                  {
                    success: false,
                    session: undefined,
                  },
                  popup,
                );
              }
            } else {
              resolveOnce(
                {
                  success: false,
                  session: undefined,
                },
                popup,
              );
            }
          }
        } catch {
          // Cross-origin error - popup is on different domain, continue polling
        }
      } catch (error) {
        rejectOnce(error, popup);
      } finally {
        inFlight = false;
      }
    }, OAUTH_POLL_INTERVAL_MS);

    // Cleanup after timeout (5 minutes)
    timeoutId = setTimeout(() => {
      resolveOnce(
        {
          success: false,
          session: undefined,
        },
        popup,
      );
    }, OAUTH_FLOW_TIMEOUT_MS);
  });
}

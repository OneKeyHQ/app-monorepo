import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import type { SupabaseClient } from '@supabase/supabase-js';

export type IHandleOAuthSessionPersistenceParams = {
  accessToken: string;
  refreshToken: string;
  persistSession?: boolean;
  // Whether to also login to Prime service (default: true)
  loginToPrime?: boolean;
};

export type IOAuthPopupResult = {
  success: boolean;
  session?: {
    accessToken: string;
    refreshToken: string;
  };
};

export type IOpenOAuthPopupOptions = {
  // Whether to persist the session to storage
  // When false (default): Only return tokens, don't call setSession
  persistSession?: boolean;
};

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
    // Calculate popup window position (centered)
    const width = 500;
    const height = 700;
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
      reject(
        new OneKeyLocalError(
          'Popup was blocked. Please allow popups and try again.',
        ),
      );
      return;
    }

    // Focus the popup window to bring it to front
    popup.focus();

    // Poll for popup close and check for auth tokens
    const pollInterval = setInterval(async () => {
      try {
        popup.focus();
        // Check if popup is closed
        if (popup.closed) {
          clearInterval(pollInterval);

          // Check if we got a session after popup closed
          const { data } = await client.auth.getSession();
          if (data.session) {
            resolve({
              success: true,
              session: {
                accessToken: data.session.access_token,
                refreshToken: data.session.refresh_token,
              },
            });
          } else {
            resolve({
              success: false,
              session: undefined,
            });
          }
          return;
        }

        // Try to read the popup URL to check for callback
        try {
          const popupUrl = popup.location.href;
          if (popupUrl && popupUrl.includes('access_token=')) {
            clearInterval(pollInterval);
            popup.close();

            // Parse tokens from URL
            const url = new URL(popupUrl);
            const hashParams = new URLSearchParams(
              url.hash.substring(1) || url.search.substring(1),
            );

            const accessToken = hashParams.get('access_token');
            const refreshToken = hashParams.get('refresh_token');

            if (accessToken && refreshToken) {
              await handleSessionPersistence({
                accessToken,
                refreshToken,
                persistSession,
                loginToPrime: false, // openOAuthPopupWeb doesn't handle Prime login
              });

              resolve({
                success: true,
                session: {
                  accessToken,
                  refreshToken,
                },
              });
            } else {
              resolve({
                success: false,
                session: undefined,
              });
            }
          }
        } catch {
          // Cross-origin error - popup is on different domain, continue polling
        }
      } catch (error) {
        clearInterval(pollInterval);
        popup.close();
        reject(error);
      }
    }, 500);

    // Cleanup after timeout (5 minutes)
    setTimeout(() => {
      clearInterval(pollInterval);
      if (popup && !popup.closed) {
        popup.close();
      }
      resolve({
        success: false,
        session: undefined,
      });
    }, 5 * 60 * 1000);
  });
}

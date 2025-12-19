import { Dialog } from '@onekeyhq/components';
import {
  OAUTH_CALLBACK_DESKTOP_CHANNEL,
  OAUTH_FLOW_TIMEOUT_MS,
} from '@onekeyhq/shared/src/consts/authConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type {
  IHandleOAuthSessionPersistenceParams,
  IOAuthPopupResult,
} from './openOAuthPopupTypes';

/**
 * OAuth helper for Desktop (Electron) platform using localhost HTTP server
 * with Supabase OAuth redirecting back to localhost (fixed port range).
 *
 * This method uses Supabase as the OAuth intermediary:
 * Google -> Supabase -> localhost callback (tokens in URL hash)
 *
 * How it works:
 * 1. Main process starts a localhost HTTP server on a fixed port range
 * 2. Renderer opens Supabase OAuth URL in system browser (skipBrowserRedirect=true)
 * 3. Supabase handles Google OAuth and exchanges code on server side
 * 4. Supabase redirects back to localhost callback with tokens in URL hash
 * 5. Main process extracts tokens and sends them to renderer via IPC
 * 6. Renderer persists session via Supabase client auth.setSession
 *
 * Supabase Configuration:
 * - Add Redirect URLs (fixed port range), e.g.:
 *   http://127.0.0.1:19800/callback
 *   http://127.0.0.1:19801/callback
 *   http://127.0.0.1:19802/callback
 *   http://127.0.0.1:19803/callback
 *   http://127.0.0.1:19804/callback
 *
 * @param options - Configuration options
 * @param options.authUrl - Supabase OAuth URL (skipBrowserRedirect=true)
 * @param options.handleSessionPersistence - Function to handle session persistence
 * @param options.persistSession - Whether to persist the session
 * @returns Promise with success status and session tokens
 */
export async function openOAuthPopupDesktopLocalhost(options: {
  authUrl: string;
  handleSessionPersistence: (
    params: IHandleOAuthSessionPersistenceParams,
  ) => Promise<void>;
  persistSession: boolean;
}): Promise<IOAuthPopupResult> {
  const { authUrl, handleSessionPersistence, persistSession } = options;

  // Check if desktopApiProxy is available
  if (!platformEnv.isDesktop || !globalThis.desktopApiProxy?.oauthLocalServer) {
    throw new OneKeyLocalError(
      'Desktop OAuth Local Server API is not available',
    );
  }

  return new Promise((resolve, reject) => {
    void (async () => {
      try {
        // Listen for callback with tokens (access_token / refresh_token) via IPC
        const handleCallback = async (
          _event: Electron.IpcRendererEvent,
          data: {
            accessToken?: string;
            refreshToken?: string;
            idToken?: string;
          },
        ) => {
          // Remove listener using desktopApi (for IPC events)
          if (globalThis.desktopApi) {
            globalThis.desktopApi.removeIpcEventListener(
              OAUTH_CALLBACK_DESKTOP_CHANNEL,
              handleCallback,
            );
          }

          try {
            const accessToken = data.accessToken;
            const refreshToken = data.refreshToken;

            if (!accessToken || !refreshToken) {
              resolve({ success: false, session: undefined });
              return;
            }

            // Handle session persistence
            await handleSessionPersistence({
              accessToken,
              refreshToken,
              persistSession,
            });

            resolve({
              success: true,
              session: { accessToken, refreshToken },
            });
          } catch (error) {
            reject(
              new OneKeyLocalError(
                error instanceof Error ? error.message : 'OAuth failed',
              ),
            );
          }
        };

        // Add listener using desktopApi (for IPC events)
        if (globalThis.desktopApi) {
          globalThis.desktopApi.addIpcEventListener(
            OAUTH_CALLBACK_DESKTOP_CHANNEL,
            handleCallback,
          );
        }

        // Open Supabase OAuth in system browser
        await globalThis.desktopApiProxy.oauthLocalServer.openBrowser(authUrl);

        // Timeout after 5 minutes
        setTimeout(() => {
          if (globalThis.desktopApi) {
            globalThis.desktopApi.removeIpcEventListener(
              OAUTH_CALLBACK_DESKTOP_CHANNEL,
              handleCallback,
            );
          }
          void globalThis.desktopApiProxy.oauthLocalServer.stopServer();
          reject(new OneKeyLocalError('OAuth sign-in timed out'));
        }, OAUTH_FLOW_TIMEOUT_MS);
      } catch (error) {
        Dialog.debugMessage({
          title: 'OAuth',
          debugMessage:
            error instanceof Error ? error.message : 'OAuth setup failed',
        });
        reject(
          new OneKeyLocalError(
            error instanceof Error ? error.message : 'OAuth setup failed',
          ),
        );
      }
    })();
  });
}

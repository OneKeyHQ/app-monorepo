import { Dialog } from '@onekeyhq/components';
import type { IDialogInstance } from '@onekeyhq/components';
import {
  OAUTH_CALLBACK_DESKTOP_CHANNEL,
  OAUTH_CALLBACK_DESKTOP_PATH,
  OAUTH_FLOW_TIMEOUT_MS,
} from '@onekeyhq/shared/src/consts/authConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { OAuthPopupBase } from './OAuthPopupBase';

import type { IOAuthPopupOptions, IOAuthPopupResult } from './types';

// ============================================================================
// Desktop OAuth Popup Implementation
// ============================================================================

/**
 * OAuth popup implementation for Desktop (Electron) platform.
 *
 * Uses localhost HTTP server for OAuth callback (primary method).
 * Opens OAuth URL in system browser and listens for callback via IPC.
 *
 * Flow:
 * 1. Start localhost HTTP server on system-assigned port
 * 2. Open Supabase OAuth URL in system browser
 * 3. User completes OAuth in browser
 * 4. Browser redirects to localhost callback with authorization code
 * 5. Exchange code for session using Supabase PKCE
 */
export class OAuthPopup extends OAuthPopupBase {
  // ============ Public API ============

  /**
   * Get OAuth redirect URL for Desktop platform.
   *
   * Starts localhost OAuth server and returns callback URL.
   * Returns: http://127.0.0.1:{port}/oauth_callback_desktop
   */
  static override async getRedirectUrl(): Promise<string> {
    if (
      !platformEnv.isDesktop ||
      !globalThis.desktopApiProxy?.oauthLocalServer
    ) {
      throw new OneKeyLocalError(
        'Desktop OAuth Local Server API is not available',
      );
    }

    let port = 0;
    try {
      const serverResult =
        await globalThis.desktopApiProxy.oauthLocalServer.startServer();
      port = serverResult.port;
    } catch {
      throw new OneKeyLocalError(
        'Failed to start OAuth local server. Please try again.',
      );
    }

    if (!port) {
      throw new OneKeyLocalError('OAuth local server returned invalid port.');
    }

    return `http://127.0.0.1:${port}${OAUTH_CALLBACK_DESKTOP_PATH}`;
  }

  /**
   * Open OAuth using localhost HTTP server.
   *
   * Opens OAuth URL in system browser and listens for callback via IPC.
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

    if (
      !platformEnv.isDesktop ||
      !globalThis.desktopApiProxy?.oauthLocalServer
    ) {
      throw new OneKeyLocalError(
        'Desktop OAuth Local Server API is not available',
      );
    }

    // Parse expected states for validation
    const { expectedState, expectedOneKeyState } =
      OAuthPopup.parseExpectedStates(authUrl);

    return new Promise((resolve, reject) => {
      void (async () => {
        let settled = false;
        let timeoutId: ReturnType<typeof setTimeout> | null = null;
        let dialogClosed = false;
        let waitingDialog: IDialogInstance | null = null;

        // Define cleanup first to avoid "used before defined" error
        const cleanupFn = {
          cleanup: async () => {},
        };

        // IPC callback handler
        const handleCallback = async (
          _event: Electron.IpcRendererEvent,
          data: {
            code?: string;
            state?: string;
            oneKeyState?: string;
          },
        ) => {
          if (settled) {
            return;
          }
          settled = true;

          // Remove listener
          if (globalThis.desktopApi) {
            globalThis.desktopApi.removeIpcEventListener(
              OAUTH_CALLBACK_DESKTOP_CHANNEL,
              handleCallback,
            );
          }

          try {
            dialogClosed = true;
            await Promise.resolve(waitingDialog?.close());

            const { code, state, oneKeyState } = data;

            if (!code) {
              await cleanupFn.cleanup();
              reject(new OneKeyLocalError('Authorization code is missing'));
              return;
            }

            // Validate states
            OAuthPopup.validateOneKeyState(
              expectedOneKeyState,
              oneKeyState ?? null,
            );
            OAuthPopup.validateSupabaseState(expectedState, state ?? null);

            // Exchange code for session
            const { accessToken, refreshToken } =
              await OAuthPopup.exchangeCodeForSession(client, code);

            // Handle session persistence
            await handleSessionPersistence({
              accessToken,
              refreshToken,
            });

            await cleanupFn.cleanup();
            resolve({
              success: true,
              session: { accessToken, refreshToken },
            });
          } catch (error) {
            await cleanupFn.cleanup();
            reject(OAuthPopup.wrapError(error, 'OAuth failed'));
          }
        };

        // Assign cleanup implementation
        cleanupFn.cleanup = async () => {
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }
          if (globalThis.desktopApi) {
            globalThis.desktopApi.removeIpcEventListener(
              OAUTH_CALLBACK_DESKTOP_CHANNEL,
              handleCallback,
            );
          }
          try {
            await globalThis.desktopApiProxy.oauthLocalServer.stopServer();
          } catch {
            // Ignore stop errors
          }
          try {
            if (!dialogClosed) {
              await Promise.resolve(waitingDialog?.close());
            }
          } catch {
            // Ignore close errors
          }
        };

        try {
          // Show waiting dialog
          waitingDialog = Dialog.show({
            title: 'Sign in',
            description:
              'Complete sign-in in your browser, then return to OneKey.',
            showFooter: true,
            showConfirmButton: false,
            showCancelButton: true,
            onCancel: async (close) => {
              if (settled) {
                await close();
                return;
              }
              settled = true;
              dialogClosed = true;
              await close();
              await cleanupFn.cleanup();
              reject(new OneKeyLocalError('OAuth sign-in was cancelled'));
            },
            onClose: async (extra) => {
              if (extra?.flag === 'cancel' && !settled) {
                settled = true;
                dialogClosed = true;
                await cleanupFn.cleanup();
                reject(new OneKeyLocalError('OAuth sign-in was cancelled'));
              }
            },
          });

          // Add IPC listener
          if (globalThis.desktopApi) {
            globalThis.desktopApi.addIpcEventListener(
              OAUTH_CALLBACK_DESKTOP_CHANNEL,
              handleCallback,
            );
          }

          // Open OAuth URL in system browser
          await globalThis.desktopApiProxy.oauthLocalServer.openBrowser(
            authUrl,
          );

          // Setup timeout
          timeoutId = setTimeout(() => {
            if (settled) {
              return;
            }
            settled = true;
            void cleanupFn.cleanup().finally(() => {
              reject(new OneKeyLocalError('OAuth sign-in timed out'));
            });
          }, OAUTH_FLOW_TIMEOUT_MS);
        } catch (error) {
          Dialog.debugMessage({
            title: 'OAuth',
            debugMessage:
              error instanceof Error ? error.message : 'OAuth setup failed',
          });
          reject(OAuthPopup.wrapError(error, 'OAuth setup failed'));
        }
      })();
    });
  }
}

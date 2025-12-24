import { Dialog } from '@onekeyhq/components';
import type { IDialogInstance } from '@onekeyhq/components';
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
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * OAuth helper for Desktop (Electron) platform using localhost HTTP server
 * with Supabase OAuth redirecting back to localhost (fixed port range).
 *
 * This method uses Supabase as the OAuth intermediary with PKCE flow:
 * Google -> Supabase -> localhost callback (authorization code in URL query)
 *
 * How it works:
 * 1. Main process starts a localhost HTTP server on a fixed port range
 * 2. Renderer opens Supabase OAuth URL in system browser (skipBrowserRedirect=true)
 * 3. Supabase handles Google OAuth and redirects back with authorization code
 * 4. Main process extracts code from URL query and sends it to renderer via IPC
 * 5. Renderer exchanges code for session tokens using Supabase client
 * 6. Renderer persists session via handleSessionPersistence
 *
 * Supabase Configuration:
 * - Add Redirect URLs (fixed port range)
 *
 * @param options - Configuration options
 * @param options.authUrl - Supabase OAuth URL (skipBrowserRedirect=true)
 * @param options.client - Supabase client instance for exchanging code
 * @param options.handleSessionPersistence - Function to handle session persistence
 * @param options.persistSession - Whether to persist the session
 * @returns Promise with success status and session tokens
 */
export async function openOAuthPopupDesktopLocalhost(options: {
  authUrl: string;
  client: SupabaseClient;
  handleSessionPersistence: (
    params: IHandleOAuthSessionPersistenceParams,
  ) => Promise<void>;
  persistSession?: boolean;
}): Promise<IOAuthPopupResult> {
  const { authUrl, client, handleSessionPersistence, persistSession } = options;

  // Check if desktopApiProxy is available
  if (!platformEnv.isDesktop || !globalThis.desktopApiProxy?.oauthLocalServer) {
    throw new OneKeyLocalError(
      'Desktop OAuth Local Server API is not available',
    );
  }

  return new Promise((resolve, reject) => {
    void (async () => {
      try {
        let settled = false;
        let timeoutId: ReturnType<typeof setTimeout> | null = null;
        let dialogClosed = false;
        let waitingDialog: IDialogInstance | null = null;
        let expectedState: string | null = null;

        try {
          expectedState = new URL(authUrl).searchParams.get('state');
        } catch {
          expectedState = null;
        }

        const cleanupFn = {
          cleanup: async () => {},
        };

        // Listen for callback with authorization code via IPC (PKCE flow)
        const handleCallback = async (
          _event: Electron.IpcRendererEvent,
          data: {
            code?: string;
            state?: string;
          },
        ) => {
          if (settled) {
            return;
          }
          settled = true;
          // Remove listener using desktopApi (for IPC events)
          if (globalThis.desktopApi) {
            globalThis.desktopApi.removeIpcEventListener(
              OAUTH_CALLBACK_DESKTOP_CHANNEL,
              handleCallback,
            );
          }

          try {
            dialogClosed = true;
            await Promise.resolve(waitingDialog?.close());
            const code = data.code;
            const state = data.state;

            if (!code) {
              await cleanupFn.cleanup();
              resolve({ success: false, session: undefined });
              return;
            }

            // Validate state (anti-CSRF / anti-injection). This does not change the redirect URI.
            // Supabase OAuth URLs should include `state=...` and the redirect callback should echo it back.
            if (expectedState) {
              if (!state) {
                await cleanupFn.cleanup();
                reject(new OneKeyLocalError('OAuth state is missing'));
                return;
              }
              if (state !== expectedState) {
                await cleanupFn.cleanup();
                reject(new OneKeyLocalError('OAuth state mismatch'));
                return;
              }
            }

            // Exchange authorization code for session tokens using PKCE
            // The Supabase client automatically uses the stored code_verifier
            const { data: exchangeData, error } =
              await client.auth.exchangeCodeForSession(code);

            if (error) {
              await cleanupFn.cleanup();
              reject(new OneKeyLocalError(error.message));
              return;
            }

            const session = exchangeData.session;
            if (!session) {
              await cleanupFn.cleanup();
              resolve({ success: false, session: undefined });
              return;
            }

            const accessToken = session.access_token;
            const refreshToken = session.refresh_token;

            // Handle session persistence
            await handleSessionPersistence({
              accessToken,
              refreshToken,
              persistSession,
            });

            await cleanupFn.cleanup();
            resolve({
              success: true,
              session: { accessToken, refreshToken },
            });
          } catch (error) {
            await cleanupFn.cleanup();
            reject(
              new OneKeyLocalError(
                error instanceof Error ? error.message : 'OAuth failed',
              ),
            );
          }
        };

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
            // Ignore stop errors.
          }
          try {
            if (!dialogClosed) {
              await Promise.resolve(waitingDialog?.close());
            }
          } catch {
            // Ignore close errors.
          }
        };

        // Show an in-app "waiting" dialog so users can cancel immediately.
        // Note: When opening **external system browsers**, we cannot reliably detect
        // whether the browser window/tab was closed. Cancel is the only reliable way.
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
            // Treat manual dialog dismissal as cancel.
            if (extra?.flag === 'cancel' && !settled) {
              settled = true;
              dialogClosed = true;
              await cleanupFn.cleanup();
              reject(new OneKeyLocalError('OAuth sign-in was cancelled'));
            }
          },
        });

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
        reject(
          new OneKeyLocalError(
            error instanceof Error ? error.message : 'OAuth setup failed',
          ),
        );
      }
    })();
  });
}

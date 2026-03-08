import { Dialog } from '@onekeyhq/components';
import type { IDialogInstance } from '@onekeyhq/components';
import type { IAppleSignInResult } from '@onekeyhq/kit-bg/src/desktopApis/DesktopApiAppleAuth';
import {
  MAC_DESKTOP_USE_NATIVE_APPLE_SIGNIN,
  OAUTH_CALLBACK_DESKTOP_CHANNEL,
  OAUTH_CALLBACK_DESKTOP_PATH,
  OAUTH_FLOW_TIMEOUT_MS,
} from '@onekeyhq/shared/src/consts/authConsts';
import {
  OAuthLoginCancelError,
  OneKeyLocalError,
} from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { OAuthPopupBase } from './OAuthPopupBase';

import type { IOAuthPopupOptions, IOAuthPopupResult } from './types';

// ============================================================================
// Desktop OAuth Popup Implementation
// ============================================================================

/**
 * OAuth popup implementation for Desktop (Electron) platform.
 *
 * Supports two methods:
 * - Native Apple Sign-In (macOS only): Uses ASAuthorizationController for native UI
 * - Browser OAuth (default): Opens system browser with localhost callback
 *
 * Flow (Browser method):
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
   * Open OAuth popup.
   *
   * Routes to the appropriate sign-in method based on provider and platform:
   * - Apple on macOS: Uses native Apple Sign-In via DesktopApiAppleAuth (if available)
   * - Other providers: Uses browser OAuth with localhost callback
   */
  static override async open(
    options: IOAuthPopupOptions,
  ): Promise<IOAuthPopupResult> {
    const { provider, client } = options;

    if (!client) {
      throw new OneKeyLocalError('Supabase client is required');
    }

    // Apple Sign-In on macOS: Try native method first (if enabled)
    if (
      provider === 'apple' &&
      platformEnv.isDesktopMac &&
      MAC_DESKTOP_USE_NATIVE_APPLE_SIGNIN
    ) {
      try {
        // TODO: macOS Native Apple Sign-In requirements:
        // 1. Build native module: cd apps/desktop/native-modules/apple-auth-macos && npx node-gyp rebuild
        // 2. Add entitlement to apps/desktop/entitlements.mac.plist and entitlements.mas.plist:
        //    <key>com.apple.developer.applesignin</key>
        //    <array><string>Default</string></array>
        // 3. App must be code signed with proper provisioning profile
        // 4. Apple Developer account must have "Sign in with Apple" capability enabled
        // 5. Supabase Apple provider must include the app's bundle ID in "Client IDs"

        return await OAuthPopup.openWithNativeAppleSignIn(options);
      } catch (error) {
        // If native Apple Sign-In fails due to module not available, fall back to browser
        if (OAuthPopup.shouldFallbackToBrowser(error)) {
          console.warn(
            'Native Apple Sign-In not available, falling back to browser:',
            error instanceof Error ? error.message : error,
          );
          // Fall through to browser method
        } else {
          throw error;
        }
      }
    }

    // Browser OAuth method
    return OAuthPopup.openWithBrowser(options);
  }

  // ============ Private Methods - Native Apple Sign-In ============

  /**
   * Check if error indicates native Apple Sign-In is not available
   * and we should fall back to browser.
   */
  private static shouldFallbackToBrowser(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return (
        message.includes('not available') ||
        message.includes('not loaded') ||
        message.includes('native module')
      );
    }
    return false;
  }

  /**
   * Open OAuth using native Apple Sign-In (macOS only).
   *
   * Uses DesktopApiAppleAuth to perform native Apple Sign-In
   * with ASAuthorizationController (system UI, no browser).
   */
  private static async openWithNativeAppleSignIn(
    options: IOAuthPopupOptions,
  ): Promise<IOAuthPopupResult> {
    const { client, handleSessionPersistence } = options;

    if (!client) {
      throw new OneKeyLocalError('Supabase client is required');
    }

    if (!globalThis.desktopApiProxy?.appleAuth) {
      throw new OneKeyLocalError(
        'Desktop Apple Auth API is not available. Native module may not be built.',
      );
    }

    // Check if native Apple Sign-In is available
    const appleAuth = globalThis.desktopApiProxy.appleAuth as {
      isAvailable: () => boolean;
      signIn: () => Promise<IAppleSignInResult>;
    };

    const isAvailable = appleAuth.isAvailable();
    if (!isAvailable) {
      throw new OneKeyLocalError(
        'Native Apple Sign-In requires macOS 10.15 or later and the native module to be built.',
      );
    }

    // Perform native Apple Sign-In
    const result: IAppleSignInResult = await appleAuth.signIn();

    if (!result.identityToken) {
      throw new OneKeyLocalError(
        'No identity token received from Apple Sign-In',
      );
    }

    // Exchange Apple ID token for Supabase session
    // The raw nonce is passed to Supabase to validate against the hashed nonce in the ID token
    const { data, error } = await client.auth.signInWithIdToken({
      provider: 'apple',
      token: result.identityToken,
      nonce: result.rawNonce,
    });

    if (error) {
      throw new OneKeyLocalError(error.message);
    }

    if (!data.session) {
      throw new OneKeyLocalError(
        'Failed to exchange Apple ID token for session',
      );
    }

    const accessToken = data.session.access_token;
    const refreshToken = data.session.refresh_token;

    // Handle session persistence
    await handleSessionPersistence({
      accessToken,
      refreshToken,
    });

    return {
      success: true,
      session: { accessToken, refreshToken },
    };
  }

  // ============ Private Methods - Browser OAuth ============

  /**
   * Open OAuth using localhost HTTP server and system browser.
   */
  private static async openWithBrowser(
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
            title: appLocale.intl.formatMessage({
              id: ETranslations.logging_you_in,
            }),
            description: appLocale.intl.formatMessage({
              id: ETranslations.logging_you_in_desc,
            }),
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
              reject(new OAuthLoginCancelError());
            },
            onClose: async (extra) => {
              // Treat closing the dialog (including clicking the "X") as a cancel action,
              // otherwise the OAuth promise may never settle and the UI loading state can get stuck.
              if (settled) {
                return;
              }
              // Keep backward compatibility: some close paths may still pass `flag: 'cancel'`.
              if (extra?.flag === 'cancel' || !extra?.flag) {
                settled = true;
                dialogClosed = true;
                await cleanupFn.cleanup();
                reject(new OAuthLoginCancelError());
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

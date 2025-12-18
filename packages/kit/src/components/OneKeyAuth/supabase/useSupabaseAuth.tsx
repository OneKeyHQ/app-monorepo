import { useCallback, useMemo } from 'react';

import * as WebBrowser from 'expo-web-browser';
import { useIntl } from 'react-intl';

import type { IDesktopOpenUrlEventData } from '@onekeyhq/desktop/app/app';
import { ipcMessageKeys } from '@onekeyhq/desktop/app/config';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ONEKEY_APP_DEEP_LINK } from '@onekeyhq/shared/src/consts/deeplinkConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { getSupabaseClient } from './getSupabaseClient';
import { useSupabaseAuthContext } from './SupabaseAuthContext';

import type { AuthResponse, SupabaseClient } from '@supabase/supabase-js';

// ============================================================================
// Extension OAuth Configuration
// ============================================================================
//
// There are two methods for handling OAuth in Chrome extensions:
//
// METHOD 1: chrome.identity.launchWebAuthFlow (RECOMMENDED)
// ---------------------------------------------------------
// Uses: https://<extension-id>.chromiumapp.org/auth/callback
// Pros:
//   - Official Chrome API, handles popup lifecycle automatically
//   - No need to create callback page in extension
//   - More reliable token extraction
// Cons:
//   - Requires adding https://<extension-id>.chromiumapp.org/* to Supabase Redirect URLs
//
// Supabase Dashboard Configuration:
//   Redirect URLs: https://<extension-id>.chromiumapp.org/auth/callback
//   Or wildcard:   https://*.chromiumapp.org/*
//
// METHOD 2: Direct chrome-extension:// scheme
// --------------------------------------------
// Uses: chrome-extension://<extension-id>/auth/callback
// Pros:
//   - Simpler redirect URL format
//   - Uses extension's own URL scheme
// Cons:
//   - Requires creating a callback page (auth/callback.html) in extension
//   - Need to handle popup/tab communication manually
//   - More complex implementation
//
// Supabase Dashboard Configuration:
//   Redirect URLs: chrome-extension://<extension-id>/auth/callback
//   Or wildcard:   chrome-extension://*/*
//
// ============================================================================

enum EExtensionOAuthMethod {
  // Use chrome.identity.launchWebAuthFlow API (recommended)
  // Redirect URL format: https://<extension-id>.chromiumapp.org/auth/callback
  CHROME_IDENTITY_API = 'CHROME_IDENTITY_API',

  // Use direct chrome-extension:// scheme with tabs
  // Redirect URL format: chrome-extension://<extension-id>/auth/callback
  DIRECT_EXTENSION_SCHEME = 'DIRECT_EXTENSION_SCHEME',
}

// Configure which OAuth method to use for extensions
// Change this value to switch between methods
// const EXTENSION_OAUTH_METHOD: EExtensionOAuthMethod =
// EExtensionOAuthMethod.CHROME_IDENTITY_API;
const EXTENSION_OAUTH_METHOD: EExtensionOAuthMethod =
  EExtensionOAuthMethod.DIRECT_EXTENSION_SCHEME;

// ============================================================================
// Desktop OAuth Configuration
// ============================================================================
//
// There are two methods for handling OAuth in Electron desktop app:
//
// METHOD 1: WEBVIEW (RECOMMENDED)
// --------------------------------
// Uses an in-app webview to load OAuth URL and intercept the redirect
// Pros:
//   - Better UX - OAuth happens within the app
//   - No need for system deep link registration
//   - More reliable token extraction
//   - No external browser switching
// Cons:
//   - Requires webview component to be loaded
//
// METHOD 2: DEEP_LINK
// -------------------
// Opens OAuth URL in system browser and listens for deep link callback
// Pros:
//   - Uses native browser, some users may prefer this
//   - Works even if webview has issues
// Cons:
//   - Switches to external browser, less seamless UX
//   - Depends on system deep link protocol registration
//   - May have issues if deep link is not properly registered
//
// ============================================================================

enum EDesktopOAuthMethod {
  // Use in-app webview to handle OAuth (recommended)
  // Intercepts navigation to onekey-wallet://auth/callback
  WEBVIEW = 'WEBVIEW',

  // Use system browser + deep link callback
  // Requires onekey-wallet:// protocol to be registered
  DEEP_LINK = 'DEEP_LINK',
}

// Configure which OAuth method to use for desktop
// Change this value to switch between methods
const DESKTOP_OAUTH_METHOD: EDesktopOAuthMethod = EDesktopOAuthMethod.WEBVIEW;

// Helper function to handle OAuth session persistence
// This function is called after successfully extracting tokens from OAuth callback
async function handleOAuthSessionPersistence({
  client,
  accessToken,
  refreshToken,
  persistSession,
  loginToPrime,
}: {
  client: SupabaseClient;
  accessToken: string;
  refreshToken: string;
  persistSession: boolean;
  // Whether to also login to Prime service (default: true)
  loginToPrime?: boolean;
}): Promise<void> {
  if (persistSession) {
    // Persist session to Supabase client storage
    await client.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    // Login to Prime service
    if (loginToPrime) {
      await backgroundApiProxy.servicePrime.apiLogin({
        accessToken,
      });
    }
  }
}

// OAuth popup window helper for web platform
async function openOAuthPopup(
  authUrl: string,
  client: SupabaseClient,
  options?: {
    // Whether to persist the session to storage
    // When false (default): Only return tokens, don't call setSession
    persistSession?: boolean;
  },
): Promise<{
  success: boolean;
  session?: {
    accessToken: string;
    refreshToken: string;
  };
}> {
  const { persistSession = false } = options ?? {};
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
              await handleOAuthSessionPersistence({
                client,
                accessToken,
                refreshToken,
                persistSession,
                loginToPrime: false, // openOAuthPopup doesn't handle Prime login
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

export function useSupabaseAuth() {
  const ctx = useSupabaseAuthContext();
  const supabaseUser = ctx?.session?.user;
  const isReady = !ctx?.isLoading;
  const isLoggedIn = ctx?.isLoggedIn;
  const intl = useIntl();

  void supabaseUser?.id;

  const signOut = useCallback(async () => {
    const res = await getSupabaseClient().client.auth.signOut({
      scope: 'local',
    });
    console.log('useSupabaseAuth_signOut', res);
    if (res.error) {
      console.error('Error signing out:', res.error);
    }
    return res;
  }, []);

  // ============ OAuth Sign In Methods ============

  const performOAuthSignIn = useCallback(
    async (
      provider: 'google' | 'apple',
      options?: {
        // Whether to persist the session to storage and set it in Supabase client
        // When false (default): Only return tokens in memory, don't call setSession
        // When true: Call setSession to persist and enable auto-refresh
        persistSession?: boolean;
      },
    ): Promise<{
      success: boolean;
      session?: {
        accessToken: string;
        refreshToken: string;
      };
    }> => {
      const { persistSession = false } = options ?? {};
      const { client } = getSupabaseClient();

      // Build redirect URL based on platform
      // - Native (iOS/Android): Use deep link scheme (onekey-wallet://auth/callback)
      // - Desktop (Electron): Depends on DESKTOP_OAUTH_METHOD:
      //   - WEBVIEW: Uses deep link scheme (intercepted by webview before navigation)
      //   - DEEP_LINK: Uses deep link scheme (handled by system protocol)
      //   Desktop registers onekey-wallet:// via app.setAsDefaultProtocolClient() in apps/desktop/app/app.ts
      // - Extension: Depends on EXTENSION_OAUTH_METHOD configuration
      //   - CHROME_IDENTITY_API: https://<extension-id>.chromiumapp.org/auth/callback
      //   - DIRECT_EXTENSION_SCHEME: chrome-extension://<extension-id>/auth/callback
      // - Web: Use current origin (https://app.onekey.so/auth/callback)
      let redirectTo: string;
      if (platformEnv.isNative) {
        // Native uses deep link protocol
        redirectTo = `${ONEKEY_APP_DEEP_LINK}auth/callback`;
      } else if (platformEnv.isDesktop) {
        // Desktop: both methods use deep link scheme as redirect URL
        // - WEBVIEW: The webview intercepts navigation to this URL before it actually navigates
        // - DEEP_LINK: The system handles this URL via registered protocol
        redirectTo = `${ONEKEY_APP_DEEP_LINK}auth/callback`;
      } else if (platformEnv.isExtension) {
        if (
          EXTENSION_OAUTH_METHOD === EExtensionOAuthMethod.CHROME_IDENTITY_API
        ) {
          // Method 1: Use chrome.identity API redirect URL
          // Format: https://<extension-id>.chromiumapp.org/auth/callback
          redirectTo = chrome.identity.getRedirectURL('auth/callback');
        } else {
          // Method 2: Use direct chrome-extension:// scheme
          // Format: chrome-extension://<extension-id>/auth/callback
          redirectTo = `${chrome.runtime.getURL('auth/callback')}`;
        }
      } else {
        redirectTo = `${globalThis.location?.origin || ''}/auth/callback`;
      }

      const oauthUrlResult = await client.auth.signInWithOAuth({
        provider,
        options: {
          skipBrowserRedirect: true,
          redirectTo,
          queryParams: {
            // Google OAuth prompt options:
            // - select_account: Force show account picker (let user choose which account to use)
            // - consent: Force show authorization consent screen (re-request permissions)
            // Combined: Show both account picker and consent screen
            prompt: 'select_account', // 'select_account consent'  'select_account'
          },
        },
      });

      if (oauthUrlResult.error) {
        throw new OneKeyLocalError(oauthUrlResult.error.message);
      }

      const authUrl = oauthUrlResult.data.url;
      if (!authUrl) {
        throw new OneKeyLocalError('Failed to get OAuth URL');
      }

      // Open the OAuth URL
      if (platformEnv.isNative) {
        // Use expo-web-browser for native platforms
        // eslint-disable-next-line spellcheck/spell-checker
        const browserResult = await WebBrowser.openAuthSessionAsync(
          authUrl,
          redirectTo,
          {
            // eslint-disable-next-line spellcheck/spell-checker
            showInRecents: true,
            preferEphemeralSession: false,
          },
        );

        if (browserResult.type === 'success' && browserResult.url) {
          // Extract tokens from the callback URL
          const url = new URL(browserResult.url);
          const hashParams = new URLSearchParams(
            url.hash.substring(1) || url.search.substring(1),
          );

          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');

          if (accessToken && refreshToken) {
            await handleOAuthSessionPersistence({
              client,
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
          }
        }

        if (browserResult.type === 'cancel') {
          throw new OneKeyLocalError('OAuth sign-in was cancelled');
        }

        throw new OneKeyLocalError('OAuth sign-in failed');
      }

      // For desktop (Electron), handle OAuth based on configured method
      if (platformEnv.isDesktop) {
        if (DESKTOP_OAUTH_METHOD === EDesktopOAuthMethod.WEBVIEW) {
          // ====================================================================
          // Method 1: WEBVIEW (RECOMMENDED)
          // ====================================================================
          // Opens OAuth in an in-app webview dialog and intercepts the redirect
          // The webview monitors navigation and extracts tokens when the URL
          // matches our redirect pattern (onekey-wallet://auth/callback)
          //
          // Pros:
          //   - Better UX - OAuth happens within the app
          //   - No need for system deep link registration
          //   - More reliable token extraction
          //
          // Note: The webview will intercept navigation to onekey-wallet://
          // before it actually tries to load (which would fail since custom
          // protocols can't be loaded in webview)
          // ====================================================================
          return new Promise((resolve, reject) => {
            // Create a container for the OAuth webview
            const container = document.createElement('div');
            container.id = 'oauth-webview-container';
            container.style.cssText = `
              position: fixed;
              top: 0;
              left: 0;
              right: 0;
              bottom: 0;
              background: rgba(0, 0, 0, 0.5);
              display: flex;
              justify-content: center;
              align-items: center;
              z-index: 99999;
            `;

            // Create webview wrapper
            const wrapper = document.createElement('div');
            wrapper.style.cssText = `
              width: 480px;
              height: 640px;
              background: white;
              border-radius: 12px;
              overflow: hidden;
              box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
              display: flex;
              flex-direction: column;
            `;

            // Create header with close button
            const header = document.createElement('div');
            header.style.cssText = `
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding: 12px 16px;
              border-bottom: 1px solid #e5e5e5;
              background: #f5f5f5;
            `;

            const title = document.createElement('span');
            title.textContent = 'Sign in';
            title.style.cssText = 'font-weight: 600; font-size: 14px;';

            const closeButton = document.createElement('button');
            closeButton.textContent = '✕';
            closeButton.style.cssText = `
              border: none;
              background: none;
              font-size: 18px;
              cursor: pointer;
              padding: 4px 8px;
              border-radius: 4px;
            `;
            closeButton.onmouseover = () => {
              closeButton.style.background = '#e0e0e0';
            };
            closeButton.onmouseout = () => {
              closeButton.style.background = 'none';
            };
            closeButton.onclick = () => {
              container.remove();
              reject(new OneKeyLocalError('OAuth sign-in was cancelled'));
            };

            header.appendChild(title);
            header.appendChild(closeButton);

            // Create webview element
            const webview = document.createElement('webview');
            webview.setAttribute('src', authUrl);
            webview.setAttribute('partition', 'persist:onekey-oauth');
            webview.style.cssText = 'flex: 1; width: 100%;';

            // Handle navigation events to intercept OAuth callback
            const handleDidStartNavigation = async (event: Event) => {
              const navEvent = event as unknown as {
                url: string;
                isMainFrame: boolean;
              };
              const { url: navUrl, isMainFrame } = navEvent;

              // Check if this is our OAuth callback
              if (
                isMainFrame &&
                navUrl?.startsWith(`${ONEKEY_APP_DEEP_LINK}auth/callback`)
              ) {
                // Stop loading - we can't actually navigate to onekey-wallet://
                (webview as unknown as { stop: () => void }).stop?.();

                // Remove the container
                container.remove();

                try {
                  // Parse tokens from the callback URL
                  const parsedUrl = new URL(navUrl);
                  const hashParams = new URLSearchParams(
                    parsedUrl.hash.substring(1) ||
                      parsedUrl.search.substring(1),
                  );

                  const accessToken = hashParams.get('access_token');
                  const refreshToken = hashParams.get('refresh_token');

                  if (accessToken && refreshToken) {
                    await handleOAuthSessionPersistence({
                      client,
                      accessToken,
                      refreshToken,
                      persistSession,
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
                } catch (error) {
                  reject(error);
                }
              }
            };

            webview.addEventListener(
              'did-start-navigation',
              handleDidStartNavigation,
            );

            // Handle webview load errors (e.g., if OAuth page fails to load)
            webview.addEventListener('did-fail-load', (event: Event) => {
              const failEvent = event as unknown as {
                errorCode: number;
                errorDescription: string;
                validatedURL: string;
                isMainFrame: boolean;
              };
              // Ignore aborted loads (e.g., when we stop navigation to callback URL)
              if (failEvent.errorCode === -3) {
                return;
              }
              // Only handle main frame errors
              if (failEvent.isMainFrame) {
                container.remove();
                reject(
                  new OneKeyLocalError(
                    `OAuth page failed to load: ${failEvent.errorDescription}`,
                  ),
                );
              }
            });

            // Assemble the UI
            wrapper.appendChild(header);
            wrapper.appendChild(webview);
            container.appendChild(wrapper);
            document.body.appendChild(container);

            // Click outside to close
            container.onclick = (e) => {
              if (e.target === container) {
                container.remove();
                reject(new OneKeyLocalError('OAuth sign-in was cancelled'));
              }
            };

            // Set a timeout
            setTimeout(() => {
              if (document.body.contains(container)) {
                container.remove();
                reject(new OneKeyLocalError('OAuth sign-in timed out'));
              }
            }, 5 * 60 * 1000); // 5 minutes timeout
          });
        }
        // ====================================================================
        // Method 2: DEEP_LINK
        // ====================================================================
        // Opens OAuth URL in system browser and listens for deep link callback
        // Requires onekey-wallet:// protocol to be registered with the system
        //
        // How it works:
        // 1. Opens OAuth URL in system browser via shell.openExternal
        // 2. User completes OAuth in browser
        // 3. Browser redirects to onekey-wallet://auth/callback?tokens...
        // 4. System routes this URL to our Electron app
        // 5. App receives the URL via IPC and extracts tokens
        // ====================================================================
        return new Promise((resolve, reject) => {
          // Set up deep link listener for OAuth callback
          const handleOAuthCallback = async (
            _event: Event,
            data: IDesktopOpenUrlEventData,
          ) => {
            const { url } = data;
            // Check if this is our OAuth callback
            if (url?.startsWith(`${ONEKEY_APP_DEEP_LINK}auth/callback`)) {
              // Remove listener once we got the callback
              globalThis.desktopApi.removeIpcEventListener(
                ipcMessageKeys.EVENT_OPEN_URL,
                handleOAuthCallback,
              );

              try {
                // Parse tokens from the callback URL
                const parsedUrl = new URL(url);
                const hashParams = new URLSearchParams(
                  parsedUrl.hash.substring(1) || parsedUrl.search.substring(1),
                );

                const accessToken = hashParams.get('access_token');
                const refreshToken = hashParams.get('refresh_token');

                if (accessToken && refreshToken) {
                  await handleOAuthSessionPersistence({
                    client,
                    accessToken,
                    refreshToken,
                    persistSession,
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
              } catch (error) {
                reject(error);
              }
            }
          };

          // Add the listener
          globalThis.desktopApi.addIpcEventListener(
            ipcMessageKeys.EVENT_OPEN_URL,
            handleOAuthCallback,
          );

          // Open OAuth URL in system browser
          // On Electron, window.open with _blank target is intercepted and opens via shell.openExternal
          window.open(authUrl, '_blank');

          // Set a timeout to clean up listener if OAuth takes too long
          setTimeout(() => {
            globalThis.desktopApi.removeIpcEventListener(
              ipcMessageKeys.EVENT_OPEN_URL,
              handleOAuthCallback,
            );
            reject(new OneKeyLocalError('OAuth sign-in timed out'));
          }, 5 * 60 * 1000); // 5 minutes timeout
        });
      }

      // For extension, handle OAuth based on configured method
      if (platformEnv.isExtension) {
        if (
          EXTENSION_OAUTH_METHOD === EExtensionOAuthMethod.CHROME_IDENTITY_API
        ) {
          // ====================================================================
          // Method 1: chrome.identity.launchWebAuthFlow (RECOMMENDED)
          // ====================================================================
          // This method opens a popup for OAuth and automatically handles the
          // redirect. The callback URL with tokens is returned directly.
          //
          // Supabase Redirect URL to add:
          //   https://<extension-id>.chromiumapp.org/auth/callback
          // ====================================================================
          try {
            const callbackUrl = await chrome.identity.launchWebAuthFlow({
              url: authUrl,
              interactive: true,
            });

            if (callbackUrl) {
              // Parse tokens from the callback URL
              const url = new URL(callbackUrl);
              const hashParams = new URLSearchParams(
                url.hash.substring(1) || url.search.substring(1),
              );

              const accessToken = hashParams.get('access_token');
              const refreshToken = hashParams.get('refresh_token');

              if (accessToken && refreshToken) {
                await handleOAuthSessionPersistence({
                  client,
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
              }
            }

            return {
              success: false,
              session: undefined,
            };
          } catch (error) {
            // User closed the popup or other error
            throw new OneKeyLocalError(
              error instanceof Error ? error.message : 'Extension OAuth failed',
            );
          }
        } else {
          // ====================================================================
          // Method 2: Direct chrome-extension:// scheme
          // ====================================================================
          // This method opens a new tab for OAuth. After authentication,
          // Supabase redirects to chrome-extension://<id>/auth/callback
          // with tokens in the URL hash.
          //
          // IMPORTANT: You need to create an auth/callback.html file in your
          // extension that:
          // 1. Extracts tokens from the URL hash
          // 2. Sends tokens back to the popup via chrome.runtime.sendMessage
          // 3. Closes itself
          //
          // Example auth/callback.html:
          // ```html
          // <script>
          //   const hash = window.location.hash.substring(1);
          //   const params = new URLSearchParams(hash);
          //   const accessToken = params.get('access_token');
          //   const refreshToken = params.get('refresh_token');
          //   if (accessToken && refreshToken) {
          //     chrome.runtime.sendMessage({
          //       type: 'OAUTH_CALLBACK',
          //       accessToken,
          //       refreshToken,
          //     });
          //   }
          //   window.close();
          // </script>
          // ```
          //
          // Supabase Redirect URL to add:
          //   chrome-extension://<extension-id>/auth/callback
          // ====================================================================
          return new Promise((resolve, reject) => {
            // Set up message listener for callback
            const messageListener = async (message: {
              type: string;
              accessToken?: string;
              refreshToken?: string;
            }) => {
              if (message.type === 'OAUTH_CALLBACK') {
                chrome.runtime.onMessage.removeListener(messageListener);

                const { accessToken, refreshToken } = message;
                if (accessToken && refreshToken) {
                  try {
                    await handleOAuthSessionPersistence({
                      client,
                      accessToken,
                      refreshToken,
                      persistSession,
                    });

                    resolve({
                      success: true,
                      session: {
                        accessToken,
                        refreshToken,
                      },
                    });
                  } catch (error) {
                    reject(
                      new OneKeyLocalError(
                        error instanceof Error
                          ? error.message
                          : 'Failed to set session',
                      ),
                    );
                  }
                } else {
                  resolve({
                    success: false,
                    session: undefined,
                  });
                }
              }
            };

            chrome.runtime.onMessage.addListener(messageListener);

            // Open OAuth URL in new tab
            void chrome.tabs.create({ url: authUrl });

            // Set timeout to clean up listener if callback doesn't happen
            setTimeout(() => {
              chrome.runtime.onMessage.removeListener(messageListener);
              reject(
                new OneKeyLocalError('OAuth timeout - no callback received'),
              );
            }, 5 * 60 * 1000); // 5 minutes timeout
          });
        }
      }

      // Open OAuth popup window for web
      const popupResult = await openOAuthPopup(authUrl, client, {
        persistSession,
      });
      return popupResult;
    },
    [],
  );

  const signInWithGoogle = useCallback(
    async (options?: {
      // Whether to persist the session to storage (default: false)
      persistSession?: boolean;
    }): Promise<{
      success: boolean;
      session?: {
        accessToken: string;
        refreshToken: string;
      };
    }> => {
      // Perform the OAuth flow
      const oauthResult = await performOAuthSignIn('google', options);
      return oauthResult;
    },
    [performOAuthSignIn],
  );

  const signInWithApple = useCallback(
    async (options?: {
      // Whether to persist the session to storage (default: false)
      persistSession?: boolean;
    }): Promise<{
      success: boolean;
      session?: {
        accessToken: string;
        refreshToken: string;
      };
    }> => {
      // Perform the OAuth flow
      const oauthResult = await performOAuthSignIn('apple', options);
      return oauthResult;
    },
    [performOAuthSignIn],
  );

  // ============ Email OTP Methods ============

  const signInWithOtp = useCallback(
    async ({ email }: { email: string }) => {
      const res = await getSupabaseClient().client.auth.signInWithOtp({
        email,
        options: {
          // set this to false if you do not want the user to be automatically signed up
          shouldCreateUser: true,
        },
      });
      console.log('useSupabaseAuth_signInWithOtp', res);
      if (res.error && res.error.message) {
        // For security purposes, you can only request this after 48 seconds.
        if (
          res.error.message?.includes(
            'For security purposes, you can only request this after',
          )
        ) {
          const rateLimitMatch = res.error.message.match(
            /you can only request this after (\d+) seconds?/i,
          );
          if (rateLimitMatch) {
            const seconds = rateLimitMatch[1];
            const rateLimitMessage = intl.formatMessage(
              {
                id: ETranslations.email_verification_rate_limit,
              },
              { rest: seconds },
            );
            throw new OneKeyLocalError(rateLimitMessage);
          }
        }

        throw new OneKeyLocalError(res.error.message);
      }
      return res;
    },
    [intl],
  );

  const verifyOtp = useCallback(
    async ({ email, otp }: { email: string; otp: string }) => {
      let res: AuthResponse | undefined;
      const isPrivyEmail = email.endsWith('@privy.io');
      // Special handling for privy.io emails
      if (isPrivyEmail) {
        let phoneOtpData:
          | {
              phone: string;
              otp: string;
            }
          | undefined;
        try {
          phoneOtpData = await backgroundApiProxy.servicePrime.apiFetchPhoneOtp(
            {
              email,
              otp,
            },
          );
        } catch (error) {
          console.error('Error fetching phone OTP:', error);
        }

        if (phoneOtpData?.phone && phoneOtpData?.otp) {
          res = await getSupabaseClient().client.auth.verifyOtp({
            phone: phoneOtpData.phone,
            token: phoneOtpData.otp,
            type: 'sms',
          });
        }
      }

      if (!res) {
        // Default email OTP verification
        res = await getSupabaseClient().client.auth.verifyOtp({
          email,
          token: otp,
          type: 'email',
        });
      }

      console.log('useSupabaseAuth_verifyOtp', res);
      if (res.error && res.error.message) {
        throw new OneKeyLocalError(res.error.message);
      }
      return res;
    },
    [],
  );

  // ============ Session Management Methods ============

  const getAccessToken = useCallback(async () => {
    const res = await getSupabaseClient().client.auth.getSession();
    return res.data.session?.access_token;
  }, []);

  const getSession = useCallback(async () => {
    const { client } = getSupabaseClient();
    const result = await client.auth.getSession();

    if (result.error) {
      throw new OneKeyLocalError(result.error.message);
    }

    const session = result.data.session;

    if (!session) {
      return {
        accessToken: null,
        refreshToken: null,
        expiresAt: null,
        user: null,
      };
    }

    return {
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      expiresAt: session.expires_at ?? null,
      user: session.user
        ? {
            id: session.user.id,
            email: session.user.email,
          }
        : null,
    };
  }, []);

  const getUser = useCallback(async () => {
    const { client } = getSupabaseClient();
    const result = await client.auth.getUser();

    if (result.error) {
      // User not logged in is not an error
      if (result.error.message?.includes('not authenticated')) {
        return null;
      }
      throw new OneKeyLocalError(result.error.message);
    }

    const user = result.data.user;

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      emailConfirmedAt: user.email_confirmed_at,
      phone: user.phone,
      createdAt: user.created_at,
      updatedAt: user.updated_at ?? user.created_at,
    };
  }, []);

  const refreshSession = useCallback(async () => {
    const { client } = getSupabaseClient();
    const result = await client.auth.refreshSession();

    if (result.error) {
      throw new OneKeyLocalError(result.error.message);
    }

    return {
      success: true,
      accessToken: result.data.session?.access_token,
    };
  }, []);

  return useMemo(
    () => ({
      signOut,
      signInWithOtp,
      signInWithGoogle,
      signInWithApple,
      performOAuthSignIn,
      verifyOtp,
      getSupabaseClient,
      getAccessToken,
      getSession,
      getUser,
      refreshSession,
      supabaseUser,
      isReady,
      isLoggedIn,
    }),
    [
      signOut,
      signInWithOtp,
      signInWithGoogle,
      signInWithApple,
      performOAuthSignIn,
      verifyOtp,
      getAccessToken,
      getSession,
      getUser,
      refreshSession,
      supabaseUser,
      isReady,
      isLoggedIn,
    ],
  );
}

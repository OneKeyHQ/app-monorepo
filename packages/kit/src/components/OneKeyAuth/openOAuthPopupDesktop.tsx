import type { IDesktopOpenUrlEventData } from '@onekeyhq/desktop/app/app';
import { ipcMessageKeys } from '@onekeyhq/desktop/app/config';
import {
  EDesktopOAuthMethod,
  OAUTH_DESKTOP_WEBVIEW_HEIGHT,
  OAUTH_DESKTOP_WEBVIEW_WIDTH,
  OAUTH_FLOW_TIMEOUT_MS,
  OAUTH_TOKEN_KEY_ACCESS_TOKEN,
  OAUTH_TOKEN_KEY_REFRESH_TOKEN,
} from '@onekeyhq/shared/src/consts/authConsts';
import { ONEKEY_APP_DEEP_LINK } from '@onekeyhq/shared/src/consts/deeplinkConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import type {
  IHandleOAuthSessionPersistenceParams,
  IOAuthPopupResult,
} from './openOAuthPopupTypes';

// ============================================================================
// Desktop OAuth Methods
// ============================================================================

/**
 * Get OAuth redirect URL for desktop platform (Electron)
 *
 * Both WEBVIEW and DEEP_LINK methods use the same deep link scheme.
 * - WEBVIEW: The webview intercepts navigation to this URL before it actually navigates
 * - DEEP_LINK: The system handles this URL via registered protocol
 *
 * Desktop registers onekey-wallet:// via app.setAsDefaultProtocolClient() in apps/desktop/app/app.ts
 *
 * @param _method - The desktop OAuth method (currently both methods use the same URL)
 * @returns The redirect URL for desktop OAuth
 */
export async function getOAuthRedirectUrlDesktop(
  method: EDesktopOAuthMethod,
): Promise<string> {
  // Desktop LOCALHOST: use Supabase OAuth (skipBrowserRedirect) and a localhost callback.
  // Flow: Google -> Supabase -> localhost (`code` in query, PKCE) -> app persists session.
  if (method === EDesktopOAuthMethod.LOCALHOST_SERVER) {
    if (!globalThis.desktopApiProxy?.oauthLocalServer) {
      throw new OneKeyLocalError(
        'Desktop OAuth Local Server API is not available',
      );
    }
    let port = 0;
    try {
      const serverResult =
        await globalThis.desktopApiProxy.oauthLocalServer.startServer();
      port = serverResult.port;
    } catch (e) {
      throw new OneKeyLocalError(
        'OAuth local ports are occupied. Please close conflicting apps and try again.',
      );
    }
    if (!port) {
      throw new OneKeyLocalError('OAuth local server returned invalid port.');
    }
    return `http://127.0.0.1:${port}/callback`;
  }

  // Both WEBVIEW and DEEP_LINK methods use the same deep link URL
  // The difference is how the URL is handled:
  // - WEBVIEW: Intercepted by webview navigation event
  // - DEEP_LINK: Handled by system protocol registration
  return `${ONEKEY_APP_DEEP_LINK}auth/callback`;
}

/**
 * OAuth webview helper for Desktop (Electron) platform - WEBVIEW method
 *
 * Opens OAuth in an in-app webview dialog and intercepts the redirect.
 * The webview monitors navigation and extracts tokens when the URL
 * matches our redirect pattern (onekey-wallet://auth/callback)
 *
 * Pros:
 *   - Better UX - OAuth happens within the app
 *   - No need for system deep link registration
 *   - More reliable token extraction
 *
 * @param options - Configuration options
 * @param options.authUrl - The OAuth authorization URL to open
 * @param options.handleSessionPersistence - Function to handle session persistence
 * @param options.persistSession - Whether to persist the session
 * @returns Promise with success status and session tokens
 */
export function openOAuthPopupDesktopWebview(options: {
  authUrl: string;
  handleSessionPersistence: (
    params: IHandleOAuthSessionPersistenceParams,
  ) => Promise<void>;
  persistSession?: boolean;
}): Promise<IOAuthPopupResult> {
  const { authUrl, handleSessionPersistence, persistSession } = options;

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
      width: ${OAUTH_DESKTOP_WEBVIEW_WIDTH}px;
      height: ${OAUTH_DESKTOP_WEBVIEW_HEIGHT}px;
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
            parsedUrl.hash.substring(1) || parsedUrl.search.substring(1),
          );

          const accessToken = hashParams.get(OAUTH_TOKEN_KEY_ACCESS_TOKEN);
          const refreshToken = hashParams.get(OAUTH_TOKEN_KEY_REFRESH_TOKEN);

          if (accessToken && refreshToken) {
            await handleSessionPersistence({
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

    webview.addEventListener('did-start-navigation', handleDidStartNavigation);

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
    }, OAUTH_FLOW_TIMEOUT_MS); // 5 minutes timeout
  });
}

/**
 * OAuth helper for Desktop (Electron) platform - DEEP_LINK method
 *
 * Opens OAuth URL in system browser and listens for deep link callback.
 * Requires onekey-wallet:// protocol to be registered with the system.
 *
 * How it works:
 * 1. Opens OAuth URL in system browser via shell.openExternal
 * 2. User completes OAuth in browser
 * 3. Browser redirects to onekey-wallet://auth/callback?tokens...
 * 4. System routes this URL to our Electron app
 * 5. App receives the URL via IPC and extracts tokens
 *
 * @param options - Configuration options
 * @param options.authUrl - The OAuth authorization URL to open
 * @param options.handleSessionPersistence - Function to handle session persistence
 * @param options.persistSession - Whether to persist the session
 * @returns Promise with success status and session tokens
 */
export function openOAuthPopupDesktopDeepLink(options: {
  authUrl: string;
  handleSessionPersistence: (
    params: IHandleOAuthSessionPersistenceParams,
  ) => Promise<void>;
  persistSession?: boolean;
}): Promise<IOAuthPopupResult> {
  const { authUrl, handleSessionPersistence, persistSession } = options;

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

          const accessToken = hashParams.get(OAUTH_TOKEN_KEY_ACCESS_TOKEN);
          const refreshToken = hashParams.get(OAUTH_TOKEN_KEY_REFRESH_TOKEN);

          if (accessToken && refreshToken) {
            await handleSessionPersistence({
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
    }, OAUTH_FLOW_TIMEOUT_MS); // 5 minutes timeout
  });
}

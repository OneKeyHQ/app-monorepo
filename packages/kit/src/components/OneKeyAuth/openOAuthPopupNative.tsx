import * as WebBrowser from 'expo-web-browser';

import { ONEKEY_APP_DEEP_LINK } from '@onekeyhq/shared/src/consts/deeplinkConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import type {
  IHandleOAuthSessionPersistenceParams,
  IOAuthPopupResult,
} from './openOAuthPopupWeb';

/**
 * Get OAuth redirect URL for native platforms (iOS/Android)
 *
 * Uses the deep link scheme: onekey-wallet://auth/callback
 *
 * @returns The redirect URL for native OAuth
 */
export function getOAuthRedirectUrlNative(): string {
  return `${ONEKEY_APP_DEEP_LINK}auth/callback`;
}

/**
 * OAuth helper for native platforms (iOS/Android)
 *
 * Uses expo-web-browser to open an in-app browser for OAuth authentication.
 * The browser will redirect to the deep link callback URL when complete.
 *
 * @param options - Configuration options
 * @param options.authUrl - The OAuth authorization URL to open
 * @param options.redirectTo - The redirect URL for OAuth callback
 * @param options.handleSessionPersistence - Function to handle session persistence
 * @param options.persistSession - Whether to persist the session
 * @returns Promise with success status and session tokens
 */
export async function openOAuthPopupNative(options: {
  authUrl: string;
  redirectTo: string | undefined;
  handleSessionPersistence: (
    params: IHandleOAuthSessionPersistenceParams,
  ) => Promise<void>;
  persistSession: boolean;
}): Promise<IOAuthPopupResult> {
  const { authUrl, redirectTo, handleSessionPersistence, persistSession } =
    options;

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
      await handleSessionPersistence({
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

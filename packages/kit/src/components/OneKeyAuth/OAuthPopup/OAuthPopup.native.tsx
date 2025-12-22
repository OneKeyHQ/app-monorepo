/* eslint-disable spellcheck/spell-checker */
import * as WebBrowser from 'expo-web-browser';

import {
  DEFAULT_NATIVE_OAUTH_METHOD,
  ENativeOAuthMethod,
  OAUTH_CALLBACK_NATIVE_PATH,
  OAUTH_TOKEN_KEY_ACCESS_TOKEN,
  OAUTH_TOKEN_KEY_REFRESH_TOKEN,
  ONEKEY_OAUTH_STATE_KEY,
} from '@onekeyhq/shared/src/consts/authConsts';
import { ONEKEY_APP_DEEP_LINK } from '@onekeyhq/shared/src/consts/deeplinkConsts';
import {
  GoogleSignInConfigure,
  GoogleSignInConfigureIOS,
} from '@onekeyhq/shared/src/consts/googleSignConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { OAuthPopupBase } from './OAuthPopupBase';

import type { IOAuthPopupOptions, IOAuthPopupResult } from './types';
import type { GoogleSignin as GoogleSigninType } from '@react-native-google-signin/google-signin';

// Lazy load GoogleSignin to avoid crash if native module is not available
async function getGoogleSignin(): Promise<typeof GoogleSigninType> {
  try {
    const module = await import('@react-native-google-signin/google-signin');
    return module.GoogleSignin;
  } catch (error) {
    throw new OneKeyLocalError(
      'Google Sign-In is not available. Please use web browser authentication.',
    );
  }
}

// ============================================================================
// Native OAuth Popup Implementation
// ============================================================================

/**
 * OAuth popup implementation for native platforms (iOS/Android).
 *
 * Supports two methods:
 * - GOOGLE_SIGNIN (default): Uses @react-native-google-signin for native Google Sign-In
 * - WEB_BROWSER (fallback): Uses expo-web-browser for in-app browser OAuth
 *
 * The GOOGLE_SIGNIN method provides better UX with native UI and is recommended
 * per Supabase documentation for React Native:
 * https://supabase.com/docs/guides/auth/social-login/auth-google?platform=react-native
 */
export class OAuthPopup extends OAuthPopupBase {
  // ============ Public API ============

  /**
   * Get OAuth redirect URL for native platforms.
   *
   * Uses the deep link scheme: onekey-wallet://oauth_callback_native
   * Note: This is only used for WEB_BROWSER method.
   * GOOGLE_SIGNIN method doesn't need a redirect URL.
   */
  static override getRedirectUrl(): Promise<string> {
    return Promise.resolve(
      `${ONEKEY_APP_DEEP_LINK}${OAUTH_CALLBACK_NATIVE_PATH}`,
    );
  }

  /**
   * Open OAuth and return result.
   *
   * Uses GOOGLE_SIGNIN method by default for native Google Sign-In experience.
   * Falls back to WEB_BROWSER method if GoogleSignin is not available.
   */
  static override async open(
    options: IOAuthPopupOptions,
  ): Promise<IOAuthPopupResult> {
    const method = DEFAULT_NATIVE_OAUTH_METHOD;

    // Try GoogleSignin first (default)
    if (method === ENativeOAuthMethod.GOOGLE_SIGNIN) {
      try {
        return await OAuthPopup.openWithGoogleSignin(options);
      } catch (error) {
        // If GoogleSignin fails due to setup issues, fall back to WebBrowser
        if (OAuthPopup.shouldFallbackToWebBrowser(error)) {
          console.warn(
            'GoogleSignin not available, falling back to WebBrowser:',
            error instanceof Error ? error.message : error,
          );
          return OAuthPopup.openWithWebBrowser(options);
        }
        throw error;
      }
    }

    // Use WebBrowser method
    return OAuthPopup.openWithWebBrowser(options);
  }

  // ============ Private Methods - GoogleSignin ============

  /**
   * Check if error indicates GoogleSignin is not properly configured
   * and we should fall back to WebBrowser.
   */
  private static shouldFallbackToWebBrowser(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      // Common GoogleSignin setup errors that indicate fallback is needed
      return (
        message.includes('developer_error') ||
        message.includes('sign_in_required') ||
        message.includes('play services') ||
        message.includes('not configured') ||
        message.includes('google sign in not available')
      );
    }
    return false;
  }

  /**
   * Configure GoogleSignin with the provided options.
   * Returns the GoogleSignin instance for further use.
   */
  private static async configureGoogleSignin(): Promise<
    typeof GoogleSigninType
  > {
    const GoogleSignin = await getGoogleSignin();

    const configOptions = platformEnv.isNativeIOS
      ? GoogleSignInConfigureIOS
      : GoogleSignInConfigure;

    GoogleSignin.configure(configOptions);
    return GoogleSignin;
  }

  /**
   * Open OAuth using @react-native-google-signin/google-signin.
   *
   * Flow:
   * 1. Configure GoogleSignin with client IDs
   * 2. Call GoogleSignin.signIn() for native Google Sign-In UI
   * 3. Get Google ID token from result
   * 4. Exchange ID token for Supabase session using signInWithIdToken
   * 5. Handle session persistence
   */
  private static async openWithGoogleSignin(
    options: IOAuthPopupOptions,
  ): Promise<IOAuthPopupResult> {
    const { client, handleSessionPersistence } = options;

    if (!client) {
      throw new OneKeyLocalError('Supabase client is required');
    }

    // Configure GoogleSignin (lazy loaded)
    const GoogleSignin = await OAuthPopup.configureGoogleSignin();

    try {
      // Check if Google Play Services is available (Android only)
      if (platformEnv.isNativeAndroid) {
        await GoogleSignin.hasPlayServices({
          showPlayServicesUpdateDialog: true,
        });
      }

      // Perform Google Sign-In
      // The signIn() method returns different types based on library version:
      // - v9+: SignInResponse with { type: 'success' | 'cancelled', data?: User }
      // - older: User directly
      // We handle both cases for compatibility
      const signInResult = await GoogleSignin.signIn();

      // Extract idToken - handle both v9+ and older API
      // v9+: signInResult may have .type and .data properties
      // older: signInResult has .idToken directly
      let idToken: string | null = null;

      // Type guard for v9+ API response
      const resultWithType = signInResult as {
        type?: string;
        data?: { idToken?: string | null };
        idToken?: string | null;
      };

      if (resultWithType.type === 'cancelled') {
        throw new OneKeyLocalError('OAuth sign-in was cancelled');
      }

      if (resultWithType.data?.idToken) {
        // v9+ API: { type: 'success', data: { idToken: '...' } }
        idToken = resultWithType.data.idToken;
      } else if (resultWithType.idToken) {
        // Older API: { idToken: '...' }
        idToken = resultWithType.idToken;
      }

      if (!idToken) {
        throw new OneKeyLocalError(
          'No ID token received from Google Sign-In. ' +
            'Make sure webClientId is configured correctly.',
        );
      }

      // Exchange Google ID token for Supabase session
      // Per Supabase docs: https://supabase.com/docs/guides/auth/social-login/auth-google
      const { data, error } = await client.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      });

      if (error) {
        throw new OneKeyLocalError(error.message);
      }

      if (!data.session) {
        throw new OneKeyLocalError(
          'Failed to exchange Google ID token for session',
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
    } catch (error) {
      // Handle specific GoogleSignin errors
      if (OAuthPopup.isUserCancelledError(error)) {
        throw new OneKeyLocalError('OAuth sign-in was cancelled');
      }
      throw OAuthPopup.wrapError(error, 'Google Sign-In failed');
    }
  }

  // ============ Private Methods - WebBrowser ============

  /**
   * Open OAuth using expo-web-browser.openAuthSessionAsync.
   *
   * This is the fallback method that opens an in-app browser.
   * Uses PKCE flow: extracts authorization code and exchanges for session.
   */
  private static async openWithWebBrowser(
    options: IOAuthPopupOptions,
  ): Promise<IOAuthPopupResult> {
    const {
      authUrl,
      redirectTo: redirectToFromOptions,
      handleSessionPersistence,
      client,
    } = options;

    if (!authUrl) {
      throw new OneKeyLocalError('OAuth URL is required for WebBrowser method');
    }

    if (!redirectToFromOptions) {
      throw new OneKeyLocalError(
        'redirectTo is required. Call OAuthPopup.getRedirectUrl() first.',
      );
    }

    if (!client) {
      throw new OneKeyLocalError(
        'Supabase client is required for WebBrowser method',
      );
    }

    const redirectTo = redirectToFromOptions;

    // Parse expected states for validation
    const { expectedState, expectedOneKeyState } =
      OAuthPopup.parseExpectedStates(authUrl);

    // Open in-app browser for OAuth
    const browserResult = await WebBrowser.openAuthSessionAsync(
      authUrl,
      redirectTo,
      {
        showInRecents: true,
        preferEphemeralSession: false,
      },
    );

    if (browserResult.type === 'success' && browserResult.url) {
      const url = new URL(browserResult.url);

      // Check for error in callback
      const error =
        url.searchParams.get('error') ||
        url.searchParams.get('error_description');
      if (error) {
        throw new OneKeyLocalError(error);
      }

      // PKCE flow: extract authorization code
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const oneKeyState = url.searchParams.get(ONEKEY_OAUTH_STATE_KEY);

      if (code) {
        // Validate states
        OAuthPopup.validateOneKeyState(expectedOneKeyState, oneKeyState);
        OAuthPopup.validateSupabaseState(expectedState, state);

        // Exchange code for session using PKCE
        const { accessToken, refreshToken } =
          await OAuthPopup.exchangeCodeForSession(client, code);

        await handleSessionPersistence({
          accessToken,
          refreshToken,
        });

        return {
          success: true,
          session: { accessToken, refreshToken },
        };
      }

      // Fallback: try to extract tokens directly from URL (implicit flow)
      const { accessToken, refreshToken } = OAuthPopup.parseCallbackUrl(
        browserResult.url,
      );

      if (accessToken && refreshToken) {
        await handleSessionPersistence({
          accessToken,
          refreshToken,
        });

        return {
          success: true,
          session: { accessToken, refreshToken },
        };
      }
    }

    if (browserResult.type === 'cancel') {
      throw new OneKeyLocalError('OAuth sign-in was cancelled');
    }

    throw new OneKeyLocalError('OAuth sign-in failed');
  }

  /**
   * Parse tokens from callback URL (for WebBrowser method).
   */
  private static parseCallbackUrl(url: string): {
    accessToken: string | null;
    refreshToken: string | null;
  } {
    const parsedUrl = new URL(url);
    const hashParams = new URLSearchParams(
      parsedUrl.hash.substring(1) || parsedUrl.search.substring(1),
    );

    return {
      accessToken: hashParams.get(OAUTH_TOKEN_KEY_ACCESS_TOKEN),
      refreshToken: hashParams.get(OAUTH_TOKEN_KEY_REFRESH_TOKEN),
    };
  }
}

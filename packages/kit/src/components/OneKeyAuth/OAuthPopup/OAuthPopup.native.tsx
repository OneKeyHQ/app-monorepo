/* eslint-disable @typescript-eslint/no-unused-vars */
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import {
  AppState,
  type AppStateStatus,
  type EmitterSubscription,
  Linking,
  type NativeEventSubscription,
} from 'react-native';

import { Dialog } from '@onekeyhq/components';
import { devSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  APPLE_SIGNIN_USE_NONCE,
  DEFAULT_NATIVE_OAUTH_METHOD,
  ENativeOAuthMethod,
  OAUTH_CALLBACK_NATIVE_PATH,
  ONEKEY_OAUTH_STATE_KEY,
} from '@onekeyhq/shared/src/consts/authConsts';
import {
  ONEKEY_APP_DEEP_LINK,
  WalletConnectUniversalLinkFull,
} from '@onekeyhq/shared/src/consts/deeplinkConsts';
import {
  GoogleSignInConfigure,
  GoogleSignInConfigureIOS,
} from '@onekeyhq/shared/src/consts/googleSignConsts';
import {
  OAuthLoginCancelError,
  OneKeyLocalError,
} from '@onekeyhq/shared/src/errors';
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
   * Note: This is only used for WEB_BROWSER method.
   * GOOGLE_SIGNIN method doesn't need a redirect URL.
   *
   * IMPORTANT: Arbitrary HTTPS URLs (e.g., https://oauth-callback.onekey.so/...)
   * will NOT work as callback URLs on native platforms.
   *
   * - iOS uses ASWebAuthenticationSession which only recognizes:
   *   1. Custom URL Schemes (e.g., onekey-wallet://...)
   *   2. Universal Links (requires apple-app-site-association on server)
   *
   * - Android uses Chrome Custom Tabs + Linking API which only catches:
   *   1. Custom URL Schemes (e.g., onekey-wallet://...)
   *   2. Android App Links (requires assetlinks.json on server)
   *
   * Using an arbitrary HTTPS URL will cause the browser to navigate to that URL
   * instead of returning control to the app. The user would have to manually
   * close the browser, resulting in a "cancel" error.
   */
  static override getRedirectUrl(): Promise<string> {
    // ❌ Does NOT work - arbitrary HTTPS URL, not recognized by native platforms
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const callbackUrl = `https://oauth-callback.onekey.so/${OAUTH_CALLBACK_NATIVE_PATH}`;

    // ✅ Works - Custom URL Scheme registered in app
    const callbackUrlDeepLink = `${ONEKEY_APP_DEEP_LINK}${OAUTH_CALLBACK_NATIVE_PATH}`;

    // ✅ Works - Universal Link (if properly configured with apple-app-site-association)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const callbackUrlUniversalLink = `${WalletConnectUniversalLinkFull}${OAUTH_CALLBACK_NATIVE_PATH}`;

    return Promise.resolve(callbackUrlDeepLink);
  }

  /**
   * Open OAuth and return result.
   *
   * Routes to the appropriate sign-in method based on provider and platform:
   * - Apple on iOS: Uses native Apple Sign-In via expo-apple-authentication
   * - Apple on Android: Uses WebBrowser method (Apple Sign-In via web OAuth)
   * - Google: Uses @react-native-google-signin for native Google Sign-In
   * - Fallback: Uses expo-web-browser for in-app browser OAuth
   */
  static override async open(
    options: IOAuthPopupOptions,
  ): Promise<IOAuthPopupResult> {
    const { provider } = options;
    const method = DEFAULT_NATIVE_OAUTH_METHOD;
    if (method === ENativeOAuthMethod.WEB_BROWSER) {
      // Use WebBrowser method
      return OAuthPopup.openWithWebBrowser(options);
    }

    // Apple Sign-In: Use native on iOS, WebBrowser on Android
    // Supabase Apple provider Client IDs must include: so.onekey.wallet (iOS Bundle ID)
    if (provider === 'apple') {
      if (platformEnv.isNativeIOS) {
        try {
          return await OAuthPopup.openWithAppleSignin(options);
        } catch (error) {
          // If Apple Sign-In fails due to setup issues, fall back to WebBrowser
          if (OAuthPopup.shouldFallbackToWebBrowserForApple(error)) {
            console.warn(
              'Apple Sign-In not available, falling back to WebBrowser:',
              error instanceof Error ? error.message : error,
            );
            return OAuthPopup.openWithWebBrowser(options);
          }
          throw error;
        }
      }
      // Android: Use WebBrowser for Apple Sign-In
      return OAuthPopup.openWithWebBrowser(options);
    }

    // Google Sign-In: Try native GoogleSignin first (default)
    if (provider === 'google') {
      try {
        return await OAuthPopup.openWithGoogleSignin(options);
      } catch (error) {
        // If GoogleSignin fails due to setup issues, fall back to WebBrowser
        if (OAuthPopup.shouldFallbackToWebBrowserForGoogle(error)) {
          console.warn(
            'GoogleSignin not available, falling back to WebBrowser:',
            error instanceof Error ? error.message : error,
          );
          return OAuthPopup.openWithWebBrowser(options);
        }
        throw error;
      }
    }

    throw new OneKeyLocalError(
      `Unsupported provider: ${provider || 'unknown'}`,
    );
  }

  // ============ Private Methods - Shared ============

  /**
   * Generate a random nonce and its SHA-256 hash.
   * The hash is passed to OAuth provider, and the raw nonce to Supabase.
   * This is required for ID token validation.
   */
  private static async generateNonce({
    options,
  }: {
    options: IOAuthPopupOptions;
  }): Promise<{
    rawNonce: string | undefined;
    hashedNonce: string | undefined;
  }> {
    const rawNonce = Crypto.randomUUID();
    const hashedNonce = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      rawNonce,
    );
    if (platformEnv.isNativeIOS && options.provider === 'google') {
      return { rawNonce: undefined, hashedNonce: undefined };
    }
    return { rawNonce, hashedNonce };
  }

  // ============ Private Methods - GoogleSignin ============

  /**
   * Check if error indicates GoogleSignin is not properly configured
   * and we should fall back to WebBrowser.
   */
  private static shouldFallbackToWebBrowserForGoogle(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      // Common GoogleSignin setup errors that indicate fallback is needed.
      // Note: some messages contain "Google Sign-In" (with hyphen) and/or "is not available".
      return (
        message.includes('developer_error') ||
        message.includes('sign_in_required') ||
        message.includes('play services') ||
        message.includes('not configured') ||
        message.includes('google sign in not available') ||
        message.includes('google sign-in not available') ||
        message.includes('google sign in is not available') ||
        message.includes('google sign-in is not available')
      );
    }
    return false;
  }

  // ============ Private Methods - Apple Sign-In ============

  /**
   * Check if error indicates Apple Sign-In is not properly configured
   * and we should fall back to WebBrowser.
   */
  private static shouldFallbackToWebBrowserForApple(error: unknown): boolean {
    if (error instanceof Error) {
      const errorWithCode = error as Error & { code?: string };
      const code = errorWithCode.code || '';
      const message = error.message.toLowerCase();
      // Common Apple Sign-In setup errors that indicate fallback is needed
      return (
        code === 'ERR_REQUEST_NOT_HANDLED' ||
        message.includes('not available') ||
        message.includes('not configured') ||
        message.includes('capability') ||
        message.includes('entitlement') ||
        message.includes('authorization attempt failed') ||
        message.includes('unknown reason')
      );
    }
    return false;
  }

  /**
   * Open OAuth using expo-apple-authentication (iOS only).
   *
   * Flow:
   * 1. Check if Apple Sign-In is available on this device
   * 2. Call Apple Sign-In with requested scopes
   * 3. Get Apple ID token from result
   * 4. Exchange ID token for Supabase session using signInWithIdToken
   * 5. Handle session persistence
   *
   * Reference: https://supabase.com/docs/guides/auth/social-login/auth-apple
   */
  private static async openWithAppleSignin(
    options: IOAuthPopupOptions,
  ): Promise<IOAuthPopupResult> {
    const { client, handleSessionPersistence } = options;

    if (!client) {
      throw new OneKeyLocalError('Supabase client is required');
    }

    // Check if Apple Sign-In is available on this device
    const isAvailable = await AppleAuthentication.isAvailableAsync();
    if (!isAvailable) {
      throw new OneKeyLocalError(
        'Apple Sign-In is not available on this device. ' +
          'Make sure you are running iOS 13+ and have Sign in with Apple capability enabled.',
      );
    }

    try {
      // Generate nonce for security validation if enabled
      // The hashed nonce is passed to Apple, raw nonce is passed to Supabase
      // Reference: https://developer.apple.com/documentation/authenticationservices/asauthorizationopenidrequest/nonce
      let rawNonce: string | undefined;
      let hashedNonce: string | undefined;

      if (APPLE_SIGNIN_USE_NONCE) {
        const nonceResult = await OAuthPopup.generateNonce({ options });
        rawNonce = nonceResult.rawNonce;
        hashedNonce = nonceResult.hashedNonce;
      }

      // Perform Apple Sign-In with optional nonce
      const credential = await OAuthPopup.performAppleSignIn(hashedNonce);

      // Get the identity token (JWT) from Apple
      const idToken = credential.identityToken;

      if (!idToken) {
        throw new OneKeyLocalError(
          'No identity token received from Apple Sign-In. ' +
            'Make sure Sign in with Apple is properly configured.',
        );
      }

      // Exchange Apple ID token for Supabase session
      // Reference: https://supabase.com/docs/guides/auth/social-login/auth-apple?platform=react-native
      // The raw nonce is passed to Supabase to validate against the hashed nonce in the ID token
      const { data, error } = await client.auth.signInWithIdToken({
        provider: 'apple',
        token: idToken,
        ...(rawNonce && { nonce: rawNonce }),
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
    } catch (error) {
      // Handle specific Apple Sign-In errors
      if (OAuthPopup.isAppleUserCancelledError(error)) {
        throw new OAuthLoginCancelError();
      }

      throw error;
      // Provide more helpful error messages for common Apple Sign-In issues
      // const wrappedError = OAuthPopup.wrapAppleSignInError(error);
      // throw wrappedError;
    }
  }

  /**
   * Perform the actual Apple Sign-In request.
   * Optionally uses nonce for replay attack protection when APPLE_SIGNIN_USE_NONCE is enabled.
   * Reference: https://developer.apple.com/documentation/authenticationservices/asauthorizationopenidrequest/nonce
   */
  private static async performAppleSignIn(
    hashedNonce?: string,
  ): Promise<AppleAuthentication.AppleAuthenticationCredential> {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      ...(hashedNonce && { nonce: hashedNonce }),
    });
    return credential;
  }

  /**
   * Check if error indicates user cancelled Apple Sign-In.
   */
  private static isAppleUserCancelledError(error: unknown): boolean {
    // expo-apple-authentication throws an error with code 'ERR_CANCELED' when user cancels
    if (error instanceof Error) {
      const errorWithCode = error as Error & { code?: string };
      if (errorWithCode.code === 'ERR_REQUEST_CANCELED') {
        return true;
      }
      if (errorWithCode.code === 'ERR_CANCELED') {
        return true;
      }
      // Also check message for cancellation indicators
      const message = error.message.toLowerCase();
      return (
        message.includes('cancelled') ||
        message.includes('canceled') ||
        message.includes('user canceled')
      );
    }
    return false;
  }

  /**
   * Wrap Apple Sign-In errors with more helpful messages.
   */
  private static wrapAppleSignInError(error: unknown): Error {
    if (error instanceof OneKeyLocalError) {
      return error;
    }

    if (error instanceof Error) {
      const errorWithCode = error as Error & { code?: string };
      const code = errorWithCode.code || '';
      const message = error.message.toLowerCase();

      // Handle specific Apple error cases
      // "The authorization attempt failed for an unknown reason" - generic Apple error
      if (
        message.includes('authorization attempt failed') ||
        message.includes('unknown reason')
      ) {
        return new OneKeyLocalError(
          'Apple Sign-In failed. Please ensure:\n' +
            '1. You are signed in to iCloud on this device\n' +
            '2. Sign in with Apple is enabled in Settings > Apple ID > Sign-In & Security\n' +
            '3. You are not running on a simulator without Apple ID configured',
        );
      }

      // ERR_REQUEST_FAILED - generic request failure
      if (code === 'ERR_REQUEST_FAILED') {
        return new OneKeyLocalError(
          'Apple Sign-In request failed. Please check your network connection and try again.',
        );
      }

      // ERR_INVALID_RESPONSE - invalid response from Apple
      if (code === 'ERR_INVALID_RESPONSE') {
        return new OneKeyLocalError(
          'Invalid response from Apple Sign-In. Please try again.',
        );
      }

      // ERR_REQUEST_NOT_HANDLED - not properly configured
      if (code === 'ERR_REQUEST_NOT_HANDLED') {
        return new OneKeyLocalError(
          'Apple Sign-In is not properly configured. ' +
            'Please ensure Sign in with Apple capability is enabled.',
        );
      }

      // Default: return the original error message
      return new OneKeyLocalError(`Apple Sign-In failed: ${error.message}`);
    }

    return new OneKeyLocalError('Apple Sign-In failed for an unknown reason');
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

    // Generate nonce for security validation (required for iOS)
    // The hashed nonce is passed to Google, raw nonce is passed to Supabase
    const { rawNonce, hashedNonce } = await OAuthPopup.generateNonce({
      options,
    });

    try {
      // Check if Google Play Services is available (Android only)
      if (platformEnv.isNativeAndroid) {
        await GoogleSignin.hasPlayServices({
          showPlayServicesUpdateDialog: true,
        });
      }

      // Clear any stale OAuth state before signing in
      // This fixes 400 errors when a previous OAuth flow was cancelled
      // and left stale state (e.g., different nonce configuration) in the SDK
      try {
        await GoogleSignin.signOut();
      } catch {
        // Ignore signOut errors - user may not have been signed in
      }

      // Perform Google Sign-In with hashed nonce
      // The signIn() method returns different types based on library version:
      // - v9+: SignInResponse with { type: 'success' | 'cancelled', data?: User }
      // - older: User directly
      // We handle both cases for compatibility
      // Note: nonce is supported by the native SDK but not typed in current library version
      const signInResult = await GoogleSignin.signIn({
        nonce: hashedNonce,
      } as Parameters<typeof GoogleSignin.signIn>[0]);

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
        throw new OAuthLoginCancelError();
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
      // The raw nonce must be passed to Supabase to validate against the hashed nonce in the ID token
      const { data, error } = await client.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
        // check generateNonce() function
        // if rawNonce=undefined:
        //     Passed nonce and nonce in id_token should either both exist or not.
        // if rawNonce exists:
        //     Nonces mismatch
        nonce: rawNonce,
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
        throw new OAuthLoginCancelError();
      }
      throw OAuthPopup.wrapError(error, 'Google Sign-In failed');
    }
  }

  // ============ Private Methods - WebBrowser ============

  /**
   * Compare callback URL against redirectTo by base components (scheme/host/path),
   * ignoring query/hash ordering differences.
   *
   * Why: On Android, OAuth providers may reorder query params (e.g. put `code` first),
   * so matching via `startsWith(redirectTo)` is unreliable when `redirectTo` includes
   * query params such as `onekey_oauth_state`.
   */
  private static isOAuthCallbackUrlMatch({
    callbackUrl,
    redirectTo,
  }: {
    callbackUrl: string;
    redirectTo: string;
  }): boolean {
    try {
      const cb = new URL(callbackUrl);
      const rt = new URL(redirectTo);

      const normalizePath = (p: string) => (p === '' ? '/' : p);

      return (
        cb.protocol === rt.protocol &&
        cb.host === rt.host &&
        normalizePath(cb.pathname) === normalizePath(rt.pathname)
      );
    } catch {
      return false;
    }
  }

  /**
   * Set up Linking + AppState listeners for Android to catch OAuth callback.
   * Chrome Custom Tabs on Android has timing issues where Linking.addEventListener
   * may miss the deep link. We use AppState to detect app foreground and check getInitialURL.
   * Reference: Expo issue #23781, #6289
   */
  private static setupAndroidLinkingListener(redirectTo: string): {
    cleanup: () => void;
    urlPromise: Promise<string | null> | null;
  } {
    if (!platformEnv.isNativeAndroid) {
      return { cleanup: () => {}, urlPromise: null };
    }

    const subscriptionRef: { current: EmitterSubscription | null } = {
      current: null,
    };
    const appStateSubscriptionRef: {
      current: NativeEventSubscription | null;
    } = {
      current: null,
    };
    let resolved = false;

    const urlPromise = new Promise<string | null>((resolve) => {
      const resolveOnce = (url: string | null) => {
        if (!resolved && url) {
          resolved = true;
          resolve(url);
        }
      };

      // Method 1: Linking.addEventListener - catches deep links in some cases
      subscriptionRef.current = Linking.addEventListener('url', (event) => {
        if (
          event.url &&
          OAuthPopup.isOAuthCallbackUrlMatch({
            callbackUrl: event.url,
            redirectTo,
          })
        ) {
          resolveOnce(event.url);
        }
      });

      // Method 2: AppState + getInitialURL - catches deep links when app returns to foreground
      // This is critical for Chrome Custom Tabs where the intent is delivered via onNewIntent
      const handleAppStateChange = async (nextAppState: AppStateStatus) => {
        if (nextAppState === 'active' && !resolved) {
          // Small delay to ensure Intent is processed by React Native Linking module
          await new Promise((r) => setTimeout(r, 100));
          const initialUrl = await Linking.getInitialURL();
          if (
            initialUrl &&
            OAuthPopup.isOAuthCallbackUrlMatch({
              callbackUrl: initialUrl,
              redirectTo,
            })
          ) {
            resolveOnce(initialUrl);
          }
        }
      };

      appStateSubscriptionRef.current = AppState.addEventListener(
        'change',
        handleAppStateChange,
      );
    });

    return {
      cleanup: () => {
        subscriptionRef.current?.remove();
        appStateSubscriptionRef.current?.remove();
      },
      urlPromise,
    };
  }

  private static async processOAuthCallbackUrl(
    callbackUrl: URL,
    options: IOAuthPopupOptions & {
      expectedState: string | null;
      expectedOneKeyState: string | null;
    },
  ): Promise<IOAuthPopupResult> {
    const {
      client,
      handleSessionPersistence,
      expectedState,
      expectedOneKeyState,
    } = options;

    // Check for error in callback
    const error =
      callbackUrl.searchParams.get('error') ||
      callbackUrl.searchParams.get('error_description');
    if (error) {
      throw new OneKeyLocalError(error);
    }

    // PKCE flow: extract authorization code
    const code = callbackUrl.searchParams.get('code');
    const state = callbackUrl.searchParams.get('state');
    const oneKeyState = callbackUrl.searchParams.get(ONEKEY_OAUTH_STATE_KEY);

    if (code && client) {
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

    // NOTE: We intentionally do NOT support Implicit Flow fallback here.
    // Implicit Flow returns access_token directly in URL hash, which is less secure.
    // Since Supabase is configured with flowType: 'pkce', only authorization codes
    // are returned, and this fallback would never be triggered anyway.
    // If we reach here without a code, the OAuth flow has failed.
    throw new OneKeyLocalError(
      'OAuth callback missing authorization code. PKCE flow required.',
    );
  }

  /**
   * Open OAuth using expo-web-browser.openAuthSessionAsync.
   *
   * This is the fallback method that opens an in-app browser.
   * Uses PKCE flow: extracts authorization code and exchanges for session.
   *
   * Android Workaround:
   * On Android, expo-web-browser uses a polyfill that may return 'dismiss' even when
   * OAuth completes successfully. This is a known issue (Expo #23781, #6289).
   * To handle this, we set up a Linking listener BEFORE opening the browser to catch
   * the deep link callback even if browserResult.type is 'dismiss'.
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

    const devSettingsPersist = await devSettingsPersistAtom.get();
    const enableKeylessDebugInfo =
      !!devSettingsPersist.enabled &&
      !!devSettingsPersist.settings?.enableKeylessDebugInfo;

    const redirectTo = redirectToFromOptions;

    // Parse expected states for validation
    const { expectedState, expectedOneKeyState } =
      OAuthPopup.parseExpectedStates(authUrl);

    // =========================================================================
    // Android Workaround: Set up Linking listener BEFORE opening browser
    // =========================================================================
    // On Android, Chrome Custom Tabs may close before the deep link intent fires,
    // causing openAuthSessionAsync to return 'dismiss' even on successful OAuth.
    // We set up a Linking listener to catch the callback URL independently.
    // Reference: Expo issue #23781, #6289
    // =========================================================================
    const androidLinkingState =
      OAuthPopup.setupAndroidLinkingListener(redirectTo);

    try {
      // Open in-app browser for OAuth
      const browserResult = await WebBrowser.openAuthSessionAsync(
        authUrl,
        redirectTo,
        {
          showInRecents: true,
          preferEphemeralSession: false,
          createTask: false,
        },
      );

      if (enableKeylessDebugInfo) {
        Dialog.debugMessage({
          title: 'WebBrowser_openAuthSessionAsync___result',
          debugMessage: {
            browserResult,
          },
        });
      }

      // Case 1: Browser returned success with URL
      if (browserResult.type === 'success' && browserResult.url) {
        const url = new URL(browserResult.url);
        return await OAuthPopup.processOAuthCallbackUrl(url, {
          ...options,
          expectedState,
          expectedOneKeyState,
        });
      }

      // Case 2: Android dismiss workaround - check if Linking caught the URL
      if (
        platformEnv.isNativeAndroid &&
        (browserResult.type === WebBrowser.WebBrowserResultType.DISMISS ||
          browserResult.type === WebBrowser.WebBrowserResultType.CANCEL)
      ) {
        // Try multiple methods to catch the deep link URL
        // Method 1: Check addEventListener promise (may have already resolved)
        // Method 2: Check getInitialURL (for cold start scenarios)
        // Method 3: Wait for addEventListener with timeout
        const LINKING_TIMEOUT_MS = 2000;

        const getUrlFromMethods = async (): Promise<string | null> => {
          // Try getInitialURL first - this catches URLs that launched/resumed the app
          const initialUrl = await Linking.getInitialURL();
          if (
            initialUrl &&
            OAuthPopup.isOAuthCallbackUrlMatch({
              callbackUrl: initialUrl,
              redirectTo,
            })
          ) {
            return initialUrl;
          }

          // Wait for addEventListener to fire
          if (androidLinkingState.urlPromise) {
            const linkedUrl = await Promise.race([
              androidLinkingState.urlPromise,
              new Promise<null>((resolve) =>
                setTimeout(() => resolve(null), LINKING_TIMEOUT_MS),
              ),
            ]);
            if (linkedUrl) {
              return linkedUrl;
            }
          }

          return null;
        };

        const linkedUrl = await getUrlFromMethods();

        if (enableKeylessDebugInfo) {
          Dialog.debugMessage({
            title: 'Android_Linking_fallback___result',
            debugMessage: {
              linkedUrl,
              browserResultType: browserResult.type,
            },
          });
        }

        if (linkedUrl) {
          const url = new URL(linkedUrl);
          return await OAuthPopup.processOAuthCallbackUrl(url, {
            ...options,
            expectedState,
            expectedOneKeyState,
          });
        }

        // If no URL from Linking either, it's a real cancellation
        throw new OAuthLoginCancelError();
      }

      // Case 3: Non-Android cancel/dismiss - user actually cancelled
      if (
        browserResult.type === WebBrowser.WebBrowserResultType.CANCEL ||
        browserResult.type === WebBrowser.WebBrowserResultType.DISMISS
      ) {
        throw new OAuthLoginCancelError();
      }

      throw new OneKeyLocalError('OAuth sign-in failed: 77732');
    } finally {
      androidLinkingState.cleanup();
    }
  }
}

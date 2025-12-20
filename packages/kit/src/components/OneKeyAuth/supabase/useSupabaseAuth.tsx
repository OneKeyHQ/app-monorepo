/* eslint-disable spellcheck/spell-checker */
import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  EDesktopOAuthMethod,
  getOAuthRedirectUrlDesktop,
  openOAuthPopupDesktopDeepLink,
  openOAuthPopupDesktopWebview,
} from '../openOAuthPopupDesktop';
import {
  EExtensionOAuthMethod,
  getOAuthRedirectUrlExt,
  openOAuthPopupExtIdToken,
  openOAuthPopupExtIdentity,
  openOAuthPopupExtWindow,
} from '../openOAuthPopupExt';
import {
  getOAuthRedirectUrlNative,
  openOAuthPopupNative,
} from '../openOAuthPopupNative';
import {
  getOAuthRedirectUrlWeb,
  openOAuthPopupWeb,
} from '../openOAuthPopupWeb';

import { getSupabaseClient } from './getSupabaseClient';
import { useSupabaseAuthContext } from './SupabaseAuthContext';

import type { AuthResponse } from '@supabase/supabase-js';

// Configure which OAuth method to use for extensions
// See EExtensionOAuthMethod in openOAuthPopupExt.tsx for options
// - CHROME_IDENTITY_API: Recommended - uses launchWebAuthFlow + signInWithIdToken
// - CHROME_GET_AUTH_TOKEN: Alternative - uses getAuthToken (requires manifest oauth2 config)
// - DIRECT_EXTENSION_SCHEME: Does NOT work - Chrome blocks chrome-extension:// redirects
const EXTENSION_OAUTH_METHOD: EExtensionOAuthMethod =
  EExtensionOAuthMethod.CHROME_IDENTITY_API;

// Google OAuth Client ID for Chrome Extension
//
// IMPORTANT: Different OAuth methods require different OAuth Client types in Google Cloud Console:
//
// - CHROME_IDENTITY_API (launchWebAuthFlow): Must use "Web Application" type OAuth Client
//   Redirect URI: https://<extension-id>.chromiumapp.org (without trailing slash)
//
// - CHROME_GET_AUTH_TOKEN (getAuthToken): Must use "Chrome Extension" type OAuth Client
//   Uses manifest.json oauth2.client_id, no redirect URI config needed
//
// TODO: Move this to environment variables or config
const GOOGLE_CHROME_EXTENSION_CLIENT_ID =
  process.env.GOOGLE_CHROME_EXTENSION_CLIENT_ID ||
  // Web Application type (for CHROME_IDENTITY_API / launchWebAuthFlow)
  '244450898872-d22ubafv8ca38s6fp0kflhdr6e3s386u.apps.googleusercontent.com';
// Chrome Extension type (for CHROME_GET_AUTH_TOKEN / getAuthToken)
// '244450898872-foi2b6mtfqus1ed46hu5j03abne6b04s.apps.googleusercontent.com'

// Configure which OAuth method to use for desktop
// See EDesktopOAuthMethod in openOAuthPopupDesktop.tsx for options
const DESKTOP_OAUTH_METHOD: EDesktopOAuthMethod = EDesktopOAuthMethod.WEBVIEW;

// Helper function to handle OAuth session persistence
// This function is called after successfully extracting tokens from OAuth callback
async function handleOAuthSessionPersistence({
  accessToken,
  refreshToken,
  persistSession,
  loginToPrime,
}: {
  accessToken: string;
  refreshToken: string;
  persistSession?: boolean;
  // Whether to also login to Prime service
  loginToPrime?: boolean;
}): Promise<void> {
  if (persistSession) {
    // Persist session to Supabase client storage
    await getSupabaseClient().client.auth.setSession({
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

      // For extension with CHROME_IDENTITY_API or CHROME_GET_AUTH_TOKEN methods,
      // we don't need Supabase OAuth URL - these methods build their own Google OAuth URL
      // and use signInWithIdToken instead
      if (platformEnv.isExtension) {
        if (
          EXTENSION_OAUTH_METHOD === EExtensionOAuthMethod.CHROME_IDENTITY_API
        ) {
          // Use launchWebAuthFlow + signInWithIdToken (Supabase recommended)
          // This method builds its own Google OAuth URL with response_type=id_token
          return openOAuthPopupExtIdentity({
            config: { googleClientId: GOOGLE_CHROME_EXTENSION_CLIENT_ID },
            handleSessionPersistence: handleOAuthSessionPersistence,
            persistSession,
          });
        }
        if (
          EXTENSION_OAUTH_METHOD === EExtensionOAuthMethod.CHROME_GET_AUTH_TOKEN
        ) {
          // Use getAuthToken (requires manifest oauth2 config)
          // Chrome handles OAuth internally, no redirect URL needed
          return openOAuthPopupExtIdToken({
            handleSessionPersistence: handleOAuthSessionPersistence,
            persistSession,
          });
        }
      }

      // For other platforms and DIRECT_EXTENSION_SCHEME, we need Supabase OAuth URL
      // Build redirect URL based on platform
      let redirectTo: string | undefined;
      if (platformEnv.isNative) {
        redirectTo = getOAuthRedirectUrlNative();
      } else if (platformEnv.isDesktop) {
        redirectTo = getOAuthRedirectUrlDesktop(DESKTOP_OAUTH_METHOD);
      } else if (platformEnv.isExtension) {
        redirectTo = getOAuthRedirectUrlExt(EXTENSION_OAUTH_METHOD);
      } else {
        redirectTo = getOAuthRedirectUrlWeb();
      }

      const oauthUrlResult =
        await getSupabaseClient().client.auth.signInWithOAuth({
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

      // Open the OAuth URL based on platform
      if (platformEnv.isNative) {
        return openOAuthPopupNative({
          authUrl,
          redirectTo,
          handleSessionPersistence: handleOAuthSessionPersistence,
          persistSession,
        });
      }

      // For desktop (Electron), handle OAuth based on configured method
      if (platformEnv.isDesktop) {
        if (DESKTOP_OAUTH_METHOD === EDesktopOAuthMethod.WEBVIEW) {
          return openOAuthPopupDesktopWebview({
            authUrl,
            handleSessionPersistence: handleOAuthSessionPersistence,
            persistSession,
          });
        }
        return openOAuthPopupDesktopDeepLink({
          authUrl,
          handleSessionPersistence: handleOAuthSessionPersistence,
          persistSession,
        });
      }

      // For extension with DIRECT_EXTENSION_SCHEME (does not work, kept for reference)
      if (platformEnv.isExtension) {
        return openOAuthPopupExtWindow({
          authUrl,
          handleSessionPersistence: handleOAuthSessionPersistence,
          persistSession,
        });
      }

      // Open OAuth popup window for web
      const popupResult = await openOAuthPopupWeb({
        authUrl,
        client: getSupabaseClient().client,
        handleSessionPersistence: handleOAuthSessionPersistence,
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
    const result = await getSupabaseClient().client.auth.getSession();

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
    const result = await getSupabaseClient().client.auth.getUser();

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
    const result = await getSupabaseClient().client.auth.refreshSession();

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

import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Dialog } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { EOAuthSocialLoginProvider } from '@onekeyhq/shared/src/consts/authConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  createTemporarySupabaseClient,
  getSupabaseClient,
} from '@onekeyhq/shared/src/utils/supabaseClientUtils';

import { OAuthPopup } from '../OAuthPopup';
import { ensureOneKeyOAuthState } from '../oauthUtils';

import { useSupabaseAuthContext } from './SupabaseAuthContext';

import type { AuthResponse, SupabaseClient } from '@supabase/supabase-js';

export type IOAuthSignInResult = {
  success: boolean;
  session?: {
    accessToken: string;
    refreshToken: string;
  };
};

export type IOAuthSignInOptions = {
  // Whether to persist the session to storage and set it in Supabase client
  // When false (default): Only return tokens in memory, don't call setSession
  // When true: Call setSession to persist and enable auto-refresh
  persistSession?: boolean;
};

export function useSupabaseAuth() {
  const ctx = useSupabaseAuthContext();
  const supabaseUser = ctx?.session?.user;
  const isReady = !ctx?.isLoading;
  const isLoggedIn = ctx?.isLoggedIn;
  const intl = useIntl();
  const [devSettingsPersist] = useDevSettingsPersistAtom();
  const enableKeylessDebugInfo =
    !!devSettingsPersist.enabled &&
    !!devSettingsPersist.settings?.enableKeylessDebugInfo;

  void supabaseUser?.id;

  // ============ OAuth Sign In Methods ============

  const performOAuthSignIn = useCallback(
    async (
      provider: EOAuthSocialLoginProvider,
      options?: IOAuthSignInOptions,
    ): Promise<IOAuthSignInResult> => {
      const { persistSession } = options ?? {};
      const clientTemp: SupabaseClient = createTemporarySupabaseClient();

      const handleOAuthSessionPersistence = async ({
        accessToken,
        refreshToken,
      }: {
        accessToken: string;
        refreshToken: string;
      }): Promise<void> => {
        if (persistSession) {
          // Persist session to Supabase client storage
          await getSupabaseClient().client.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          // Login to Prime service
          // if (loginToPrime) {
          //   await backgroundApiProxy.servicePrime.apiLogin({
          //     accessToken,
          //   });
          // }
        }
      };

      // Get platform-specific redirect URL
      // Note: Some platforms return Promise<string> (e.g., desktop needs to start server)
      let redirectTo: string | undefined = await Promise.resolve(
        OAuthPopup.getRedirectUrl(),
      );

      // Defense-in-depth: Supabase PKCE URL may not include `state`. We embed our own
      // nonce into redirectTo so the callback must carry it back to us.
      if (redirectTo) {
        redirectTo = ensureOneKeyOAuthState(redirectTo);
      }

      // Get Supabase OAuth URL
      const oauthUrlResult = await clientTemp.auth.signInWithOAuth({
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
      /*
        iOS: 
        {
            "authUrl": "https://wtspqckturkzhstyjabx.supabase.co/auth/v1/authorize?provider=apple&redirect_to=https%3A%2F%2Foauth-callback.onekey.so%2Foauth_callback_native%3Fonekey_oauth_state%3D3af5c82abbfb19da14a00f6035828bdf&code_challenge=xxxx&code_challenge_method=plain&prompt=select_account",
            "provider": "apple",
            "redirectTo": "https://oauth-callback.onekey.so/oauth_callback_native?onekey_oauth_state=3af5c82abbfb19da14a00f6035828bdf"
        }
        https://oauth-callback.onekey.so/oauth_callback_native?code=xxxx&onekey_oauth_state=3af5c82abbfb19da14a00f6035828bdf

        Desktop:
        {
            "authUrl": "https://wtspqckturkzhstyjabx.supabase.co/auth/v1/authorize?provider=apple&redirect_to=http%3A%2F%2F127.0.0.1%3A62416%2Foauth_callback_desktop%3Fonekey_oauth_state%3D2fd6480e3004ad6aef7d6a72dc37455b&code_challenge=xxxx&code_challenge_method=s256&prompt=select_account",
            "provider": "apple",
            "redirectTo": "http://127.0.0.1:62416/oauth_callback_desktop?onekey_oauth_state=2fd6480e3004ad6aef7d6a72dc37455b"
        }
        http://127.0.0.1:62416/oauth_callback_desktop?code=xxxx&onekey_oauth_state=2fd6480e3004ad6aef7d6a72dc37455b
      */

      if (enableKeylessDebugInfo) {
        Dialog.debugMessage({
          title: 'performOAuthSignIn__params',
          debugMessage: {
            provider,
            redirectTo,
            authUrl,
          },
        });
      }

      // Open OAuth popup using platform-specific implementation
      return OAuthPopup.open({
        provider,
        authUrl,
        redirectTo,
        client: clientTemp,
        handleSessionPersistence: handleOAuthSessionPersistence,
      });
    },
    [enableKeylessDebugInfo],
  );

  const signInWithSocialLogin = useCallback(
    async (
      provider: EOAuthSocialLoginProvider,
      options?: IOAuthSignInOptions,
    ): Promise<IOAuthSignInResult> => {
      return errorToastUtils.withErrorAutoToast(async () => {
        const oauthResult = await performOAuthSignIn(provider, options);
        return oauthResult;
      });
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
      signInWithSocialLogin,
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
      signInWithSocialLogin,
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

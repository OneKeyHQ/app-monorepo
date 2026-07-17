import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Dialog } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { markOneKeyIdFailureServerLogged } from '@onekeyhq/kit/src/views/Prime/components/oneKeyIdLoginToastUtils';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings';
import type { EOAuthSocialLoginProvider } from '@onekeyhq/shared/src/consts/authConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { OAuthPopup } from '../OAuthPopup';
import { ensureOneKeyOAuthState } from '../oauthUtils';

import { useSupabaseAuthContext } from './SupabaseAuthContext';

import type { AuthResponse, SupabaseClient } from '@supabase/supabase-js';

type ISupabaseClientUtils =
  typeof import('@onekeyhq/shared/src/utils/supabaseClientUtils');

let supabaseClientUtilsPromise: Promise<ISupabaseClientUtils> | undefined;

const loadSupabaseClientUtils = () => {
  if (!supabaseClientUtilsPromise) {
    const promise =
      import('@onekeyhq/shared/src/utils/supabaseClientUtils').catch(
        (error: unknown) => {
          if (supabaseClientUtilsPromise === promise) {
            supabaseClientUtilsPromise = undefined;
          }
          throw error;
        },
      );
    supabaseClientUtilsPromise = promise;
  }
  return supabaseClientUtilsPromise;
};

const getSupabaseClient = async () =>
  (await loadSupabaseClientUtils()).getSupabaseClient();

const createTemporarySupabaseClient = async () =>
  (await loadSupabaseClientUtils()).createTemporarySupabaseClient();

const getKeylessSupabaseClient = async () =>
  (await loadSupabaseClientUtils()).getKeylessSupabaseClient();

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

  // Persist a Keyless OAuth session into the shared Supabase session storage.
  // There is a single keyless session slot (one shared native store; the bg
  // runtime re-reads it from storage), so persisting overwrites any currently
  // active keyless session. Flows that verify an existing keyless wallet MUST
  // validate the OAuth account first and only persist after validation passes.
  const persistKeylessOAuthSession = useCallback(
    async ({
      accessToken,
      refreshToken,
    }: {
      accessToken: string;
      refreshToken: string;
    }): Promise<void> => {
      const { data, error } = await (
        await getKeylessSupabaseClient()
      ).client.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      // setSession returns AuthErrors instead of throwing them. Swallowing
      // one leaves the shared keyless session slot EMPTY while the caller
      // continues as if the login stuck — apiOAuthLogin then commits on the
      // server but the local commit cannot read the token back, surfacing
      // only as a generic "unknown error" much later. Fail here with the
      // underlying reason instead (setSession internally performs
      // GET /auth/v1/user, so e.g. a gateway/WAF rejection of that endpoint
      // shows up as its HTTP status).
      if (error || !data?.session) {
        // Check the type, not truthiness: AuthRetryableFetchError (produced
        // when sessionPreservingSupabaseFetch masks an intercepted response)
        // carries status 0, which a truthiness check would silently drop.
        const statusPart =
          typeof error?.status === 'number' ? ` status=${error.status}` : '';
        const codePart = error?.code ? ` code=${error.code}` : '';
        const reason = `Failed to persist Keyless OAuth session: ${
          error?.message || 'no session returned'
        }${statusPart}${codePart}`;
        // Mirror into exported logs at the failure source — this covers paths
        // where the error is later swallowed and never reaches the fallback
        // toast (e.g. useKeylessWallet's apiOAuthLogin try/catch).
        defaultLogger.prime.subscription.onekeyIdSessionPersistFailed({
          reason,
        });
        // autoToast so callers WITHOUT their own catch/toast (e.g. the
        // verify-PIN flow, whose onPress rethrows into a voided promise) still
        // surface the failure via the global handler instead of dying
        // silently; httpStatusCode kept for transient-vs-definitive
        // classification. Mark it server-logged so the fallback toast does not
        // emit a duplicate @LogToServer event for the same failure.
        const persistError = new OneKeyLocalError({
          message: reason,
          autoToast: true,
          httpStatusCode:
            typeof error?.status === 'number' ? error.status : undefined,
        });
        markOneKeyIdFailureServerLogged(persistError);
        throw persistError;
      }
    },
    [],
  );

  const performOAuthSignIn = useCallback(
    async (
      provider: EOAuthSocialLoginProvider,
      options?: IOAuthSignInOptions,
    ): Promise<IOAuthSignInResult> => {
      // Last-resort guard: Chrome destroys the action popup on focus loss,
      // so the launchWebAuthFlow window opened below would silently kill
      // this whole pending flow. Callers must redirect to the expand tab
      // first (see extOneKeyIdAuthExpandTab); fail loudly if one slips
      // through instead of dying without any feedback.
      if (platformEnv.isExtensionUiPopup) {
        // TODO: i18n
        throw new OneKeyLocalError(
          'OAuth sign-in cannot run in the extension popup. Please continue in the expanded view.',
        );
      }
      const { persistSession } = options ?? {};
      const clientTemp: SupabaseClient = await createTemporarySupabaseClient();

      const handleOAuthSessionPersistence = async ({
        accessToken,
        refreshToken,
      }: {
        accessToken: string;
        refreshToken: string;
      }): Promise<void> => {
        if (persistSession) {
          // Persist session to Supabase client storage
          await persistKeylessOAuthSession({ accessToken, refreshToken });

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
    [enableKeylessDebugInfo, persistKeylessOAuthSession],
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
      const res = await (
        await getSupabaseClient()
      ).client.auth.signInWithOtp({
        email,
        options: {
          // Email sign-in is a legacy fallback for EXISTING accounts only —
          // the OAuth-first policy (and the fallback dialog copy) forbids
          // creating a new OneKey ID via email. Maps to `create_user` in the
          // GoTrue /otp request; the server-side signup closure is the
          // authoritative control, this keeps the client consistent with it
          // and fails at send-code time instead of after the OTP round-trip.
          shouldCreateUser: false,
        },
      });
      if (res.error && res.error.message) {
        // With shouldCreateUser=false (or sign-up disabled server-side),
        // GoTrue rejects unknown emails with the sign-up-not-allowed
        // rejection (error code `otp_disabled`) — surface it as
        // account-not-found guidance instead of the raw GoTrue message.
        if (
          (res.error as { code?: string }).code === 'otp_disabled' ||
          res.error.message.includes('Signups not allowed')
        ) {
          // TODO: i18n
          throw new OneKeyLocalError(
            'No OneKey ID uses this email. Email sign-in is only available for existing accounts — use Google or Apple to create a new OneKey ID.',
          );
        }
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
          res = await (
            await getSupabaseClient()
          ).client.auth.verifyOtp({
            phone: phoneOtpData.phone,
            token: phoneOtpData.otp,
            type: 'sms',
          });
        }
      }

      if (!res) {
        // Default email OTP verification
        res = await (
          await getSupabaseClient()
        ).client.auth.verifyOtp({
          email,
          token: otp,
          type: 'email',
        });
      }

      if (res.error && res.error.message) {
        throw new OneKeyLocalError(res.error.message);
      }
      return res;
    },
    [],
  );

  // ============ Session Management Methods ============

  const legacySignOut = useCallback(async () => {
    const res = await (
      await getSupabaseClient()
    ).client.auth.signOut({
      scope: 'local',
    });
    if (res.error) {
      console.error('Error signing out legacy auth:', res.error);
    }
    return res;
  }, []);

  const signOut = useCallback(async () => {
    const res = await legacySignOut();
    const keylessRes = await (
      await getKeylessSupabaseClient()
    ).client.auth.signOut({
      scope: 'local',
    });
    if (keylessRes.error) {
      console.error('Error signing out keyless auth:', keylessRes.error);
    }
    return res;
  }, [legacySignOut]);

  const keylessSignOut = useCallback(async () => {
    const keylessRes = await (
      await getKeylessSupabaseClient()
    ).client.auth.signOut({
      scope: 'local',
    });
    if (keylessRes.error) {
      console.error('Error signing out keyless auth:', keylessRes.error);
    }
    return keylessRes;
  }, []);

  // INTERACTIVE-FLOW READ ONLY (e.g. capturing the token right after an OTP
  // sign-in, dev/debug panels). NEVER use for steady-state token reads: this
  // runs client.auth.getSession() in the UI runtime, whose on-demand refresh
  // of an EXPIRED session is NOT disabled by autoRefreshToken:false and
  // would race the bg runtime's token rotation (spurious full logout — see
  // isSupabaseTokenRefreshRuntime in supabaseClientUtils). Steady-state
  // reads must use backgroundApiProxy.simpleDb.prime.getSupabaseAuthToken /
  // getKeylessSupabaseAuthToken / getActiveAuthToken instead.
  const getAccessToken = useCallback(async () => {
    const res = await (await getSupabaseClient()).client.auth.getSession();
    return res.data.session?.access_token;
  }, []);

  // Dev-gallery/debug helper — same UI-runtime refresh caveat as
  // getAccessToken above; do not use for steady-state reads.
  const getSession = useCallback(async () => {
    const result = await (await getSupabaseClient()).client.auth.getSession();

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

  // Dev-gallery/debug helper — same UI-runtime refresh caveat as
  // getAccessToken above; do not use for steady-state reads.
  const getUser = useCallback(async () => {
    const result = await (await getSupabaseClient()).client.auth.getUser();

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

  // Dev-gallery/debug helper — performs an explicit UI-runtime token
  // rotation. Only for manual debugging; production refreshes are owned by
  // the bg runtime (see isSupabaseTokenRefreshRuntime).
  const refreshSession = useCallback(async () => {
    const result = await (
      await getSupabaseClient()
    ).client.auth.refreshSession();

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
      legacySignOut,
      keylessSignOut,
      signInWithOtp,
      signInWithSocialLogin,
      performOAuthSignIn,
      persistKeylessOAuthSession,
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
      legacySignOut,
      keylessSignOut,
      signInWithOtp,
      signInWithSocialLogin,
      performOAuthSignIn,
      persistKeylessOAuthSession,
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

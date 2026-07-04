import type { ReactNode } from 'react';
import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Dialog, Spinner, Stack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { LazyLoadPage } from '@onekeyhq/kit/src/components/LazyLoadPage';
import { useSupabaseAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/supabase/useSupabaseAuth';
import { usePrimePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { EPrimeEmailOTPScene } from '@onekeyhq/shared/src/consts/primeConsts';
import { PrimeLoginDialogCancelError } from '@onekeyhq/shared/src/errors';
import {
  EOneKeyIdLoginWithLocalKeylessPrepareStatus,
  type IOneKeyIdLoginWithLocalKeylessPrepareResult,
} from '@onekeyhq/shared/src/keylessWallet/keylessWalletTypes';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EPrimePages } from '@onekeyhq/shared/src/routes/prime';
import supabaseStorageInstance from '@onekeyhq/shared/src/storage/instance/supabaseStorageInstance';
import { getSupabaseClient } from '@onekeyhq/shared/src/utils/supabaseClientUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IPrimeUserInfo } from '@onekeyhq/shared/types/prime/primeTypes';

import useAppNavigation from '../../hooks/useAppNavigation';
import { logoutPurchasesSdk } from '../../views/Prime/hooks/purchasesSdkLogout';

import { getDisplayEmailOrUnknown } from './oneKeyIdDisplayEmailUtils';

// import PrimeLoginEmailDialogV2 from '../../views/Prime/components/PrimeLoginEmailDialogV2/PrimeLoginEmailDialogV2';

const EmailOTPDialog = LazyLoadPage(
  () => import('@onekeyhq/kit/src/components/OneKeyAuth/EmailOTPDialog'),
  0,
  true,
  <Stack>
    <Spinner size="large" />
  </Stack>,
);

const PrimeLoginEmailDialogV2 = LazyLoadPage(
  () =>
    import('@onekeyhq/kit/src/views/Prime/components/PrimeLoginEmailDialogV2/PrimeLoginEmailDialogV2'),
  0,
  true,
  <Stack>
    <Spinner size="large" />
  </Stack>,
);

const PrimeLoginOAuthDialog = LazyLoadPage(
  () =>
    import('@onekeyhq/kit/src/views/Prime/components/PrimeLoginOAuthDialog/PrimeLoginOAuthDialog'),
  0,
  true,
  <Stack>
    <Spinner size="large" />
  </Stack>,
);

export function useOneKeyAuthMethods() {
  const [user] = usePrimePersistAtom();

  const {
    signInWithSocialLogin,
    persistKeylessOAuthSession,
    keylessSignOut,
    legacySignOut,
    signOut: supabaseSignOut,
    getAccessToken,
    isReady,
    isLoggedIn: isSupabaseLoggedIn,
    supabaseUser,
    signInWithOtp: supabaseSignInWithOtp,
    verifyOtp: supabaseVerifyOtp,
  } = useSupabaseAuth();

  const apiLogout = useCallback(
    async (params?: { preserveLocalKeylessAuth?: boolean }) => {
      await backgroundApiProxy.servicePrime.apiLogout(params);
    },
    [],
  );

  const clearLocalSupabaseSessions = useCallback(async () => {
    try {
      await supabaseSignOut();
    } catch {
      // do nothing
    }
    try {
      await supabaseStorageInstance.clear();
    } catch {
      // do nothing
    }
  }, [supabaseSignOut]);

  const clearLegacySupabaseSession = useCallback(async () => {
    try {
      await legacySignOut();
    } catch {
      // do nothing
    }
    supabaseStorageInstance.clearCache();
  }, [legacySignOut]);

  const logout = useCallback(
    async (params?: { preserveLocalKeylessAuth?: boolean }) => {
      const preserveLocalKeylessAuth = params?.preserveLocalKeylessAuth;
      let apiLogoutFailed = false;
      try {
        await apiLogout({ preserveLocalKeylessAuth });
      } catch (e) {
        apiLogoutFailed = true;
        defaultLogger.prime.subscription.onekeyIdLogout({
          reason: `useOneKeyAuth.logout: apiLogout threw, will force-clear local state: ${String(
            e,
          )}`,
        });
      }
      // Defensive fallback: if apiLogout threw before its finally block ran
      // (e.g., getAuthToken / getPrimeClient threw), force-clear local state here
      // so the UI cannot keep rendering the previously-logged-in account.
      if (apiLogoutFailed) {
        try {
          await backgroundApiProxy.servicePrime.clearOneKeyIdAuthState({
            preserveLocalKeylessAuth,
            callerName: 'useOneKeyAuth.logout',
          });
          defaultLogger.prime.subscription.onekeyIdLogout({
            reason:
              'useOneKeyAuth.logout: force-cleared local state after apiLogout failure',
          });
        } catch (e) {
          defaultLogger.prime.subscription.onekeyIdLogout({
            reason: `useOneKeyAuth.logout: force-clear local state also failed: ${String(
              e,
            )}`,
          });
        }
      }
      if (preserveLocalKeylessAuth) {
        await clearLegacySupabaseSession();
      } else {
        await clearLocalSupabaseSessions();
      }
    },
    [apiLogout, clearLegacySupabaseSession, clearLocalSupabaseSessions],
  );

  const logoutWithPurchasesSdk = useCallback(
    async (params?: { preserveLocalKeylessAuth?: boolean }) => {
      await logout(params);
      try {
        await logoutPurchasesSdk();
      } catch {
        // do nothing
      }
    },
    [logout],
  );

  return useMemo(() => {
    return {
      isLoggedIn: user?.isLoggedIn && user?.isLoggedInOnServer,
      isPrimeSubscriptionActive:
        user?.isLoggedIn &&
        user?.isLoggedInOnServer &&
        user?.primeSubscription?.isActive,
      // Subscription active flag only, independent of login state. Use this for
      // analytics enrichment; use isPrimeSubscriptionActive for gating features.
      isPrimeActive: user?.primeSubscription?.isActive === true,
      user,
      logout,
      logoutWithPurchasesSdk,
      // apiLogout,
      // sdkLogout,
      getAccessToken,
      isReady,
      isSupabaseLoggedIn,
      getSupabaseClient,
      supabaseUser,
      supabaseSignInWithOtp,
      supabaseVerifyOtp,
      supabaseSignOut,
      legacySupabaseSignOut: legacySignOut,
      keylessSupabaseSignOut: keylessSignOut,
      clearLocalSupabaseSessions,
      clearLegacySupabaseSession,
      signInWithSocialLogin,
      persistKeylessOAuthSession,
    };
  }, [
    getAccessToken,
    isReady,
    isSupabaseLoggedIn,
    logout,
    logoutWithPurchasesSdk,
    user,
    supabaseUser,
    supabaseSignInWithOtp,
    supabaseVerifyOtp,
    supabaseSignOut,
    legacySignOut,
    keylessSignOut,
    clearLocalSupabaseSessions,
    clearLegacySupabaseSession,
    signInWithSocialLogin,
    persistKeylessOAuthSession,
  ]);
}

export function useOneKeyAuth() {
  const navigation = useAppNavigation();
  const intl = useIntl();

  const methods = useOneKeyAuthMethods();
  const {
    logout,
    clearLegacySupabaseSession,
    supabaseSignInWithOtp,
    supabaseVerifyOtp,
  } = methods;

  const toOneKeyIdPage = useCallback(() => {
    navigation.pushModal(EModalRoutes.PrimeModal, {
      screen: EPrimePages.OneKeyId,
    });
  }, [navigation]);

  const showOneKeyIdLoginDialog = useCallback(
    async ({
      toOneKeyIdPageOnLoginSuccess,
      preserveLocalKeylessAuth,
      renderContent,
    }: {
      toOneKeyIdPageOnLoginSuccess?: boolean;
      preserveLocalKeylessAuth?: boolean;
      renderContent: (params: {
        onComplete: () => void;
        onLoginSuccess: () => Promise<void>;
        onCancel: () => void;
      }) => ReactNode;
    }) => {
      const isLoggedIn = await backgroundApiProxy.servicePrime.isLoggedIn();

      if (isLoggedIn) {
        await timerUtils.wait(200);
        if (toOneKeyIdPageOnLoginSuccess) {
          toOneKeyIdPage();
        }
        return;
      }

      if (preserveLocalKeylessAuth) {
        defaultLogger.prime.subscription.onekeyIdLogout({
          reason:
            'useLoginOneKeyId.loginOneKeyId(): clear OneKeyID local state before showing login dialog, preserving local Keyless auth',
        });
        await backgroundApiProxy.servicePrime.clearOneKeyIdAuthState({
          preserveLocalKeylessAuth: true,
          callerName: 'useOneKeyAuth.showOneKeyIdLoginDialog',
        });
        // The bg clear does not touch the main-runtime legacy Supabase
        // client's in-memory session; sign it out here so the React auth
        // context stays consistent even if the user cancels the dialog.
        await clearLegacySupabaseSession();
      } else {
        defaultLogger.prime.subscription.onekeyIdLogout({
          reason:
            'useLoginOneKeyId.loginOneKeyId(): call logout() before showing login dialog',
        });
        // logout before login, make sure local supabase storage cache is cleared
        await logout();
      }

      return new Promise<void>((resolve, reject) => {
        let isClosedByNextStep = false;
        let isResolved = false;
        const onLoginSuccessFn = async () => {
          isResolved = true;
          await timerUtils.wait(200);
          if (toOneKeyIdPageOnLoginSuccess) {
            toOneKeyIdPage();
          }
          resolve();
        };
        const onCancelFn = () => {
          if (isResolved) {
            return;
          }
          reject(new PrimeLoginDialogCancelError());
        };
        const onCancelFirstStepFn = () => {
          if (isClosedByNextStep) {
            return;
          }
          onCancelFn();
        };
        const loginDialog = Dialog.show({
          onCancel: onCancelFirstStepFn,
          onClose: onCancelFirstStepFn,
          renderContent: renderContent({
            onComplete: () => {
              isClosedByNextStep = true;
              void loginDialog.close();
            },
            onLoginSuccess: onLoginSuccessFn,
            onCancel: onCancelFn,
          }),
        });
      });
    },
    [clearLegacySupabaseSession, logout, toOneKeyIdPage],
  );

  const loginOneKeyId = useCallback(
    async ({
      toOneKeyIdPageOnLoginSuccess,
    }: {
      toOneKeyIdPageOnLoginSuccess?: boolean;
    } = {}) => {
      const localKeylessLoginPrepareResult: IOneKeyIdLoginWithLocalKeylessPrepareResult =
        await backgroundApiProxy.serviceKeylessWallet.prepareOneKeyIdLoginWithLocalKeyless();
      const preserveLocalKeylessAuth =
        localKeylessLoginPrepareResult.status !==
        EOneKeyIdLoginWithLocalKeylessPrepareStatus.NoLocalKeyless;
      return showOneKeyIdLoginDialog({
        toOneKeyIdPageOnLoginSuccess,
        preserveLocalKeylessAuth,
        renderContent: ({ onComplete, onLoginSuccess, onCancel }) => (
          <PrimeLoginOAuthDialog
            onComplete={onComplete}
            onLoginSuccess={onLoginSuccess}
            onCancel={onCancel}
            localKeylessLoginPrepareResult={localKeylessLoginPrepareResult}
          />
        ),
      });
    },
    [showOneKeyIdLoginDialog],
  );

  const loginOneKeyIdWithLegacyEmail = useCallback(
    async ({
      toOneKeyIdPageOnLoginSuccess,
      preserveLocalKeylessAuth,
    }: {
      toOneKeyIdPageOnLoginSuccess?: boolean;
      preserveLocalKeylessAuth?: boolean;
    } = {}) =>
      showOneKeyIdLoginDialog({
        toOneKeyIdPageOnLoginSuccess,
        preserveLocalKeylessAuth,
        renderContent: ({ onComplete, onLoginSuccess, onCancel }) => (
          <PrimeLoginEmailDialogV2
            onComplete={onComplete}
            onLoginSuccess={onLoginSuccess}
            onCancel={onCancel}
          />
        ),
      }),
    [showOneKeyIdLoginDialog],
  );

  const sendEmailOTP = useCallback(
    async ({
      onConfirm,
      onCancel,
      scene,
      description,
    }: {
      onCancel?: () => void;
      onConfirm: ({
        code,
        uuid,
      }: {
        code: string;
        uuid: string;
      }) => Promise<unknown>;
      scene: EPrimeEmailOTPScene;
      description?: ({ userInfo }: { userInfo: IPrimeUserInfo }) => string;
    }) => {
      const userInfo = await backgroundApiProxy.servicePrime.getLocalUserInfo();
      return new Promise<void>((resolve) => {
        let uuid = '';
        const dialog = Dialog.show({
          onCancel: () => {
            onCancel?.();
          },
          onClose: () => {
            onCancel?.();
          },
          renderContent: (
            <EmailOTPDialog
              title={intl.formatMessage({
                id: ETranslations.prime_enter_verification_code,
              })}
              description={
                description?.({ userInfo }) ||
                intl.formatMessage(
                  { id: ETranslations.prime_sent_to },
                  {
                    email: getDisplayEmailOrUnknown({
                      intl,
                      displayEmail: userInfo.displayEmail,
                    }),
                  },
                )
              }
              onConfirm={async (code: string) => {
                await timerUtils.wait(120);
                await onConfirm({ code, uuid });
                await dialog.close();
                resolve();
              }}
              sendCode={async () => {
                const result =
                  await backgroundApiProxy.servicePrime.sendEmailOTP(scene);
                uuid = result.uuid;
                return result;
              }}
            />
          ),
        });
      });
    },
    [intl],
  );

  const useLoginWithEmail = useCallback(
    // ({
    //   onComplete,
    //   onError,
    // }: {
    //   onComplete: () => void;
    //   onError: (error: Error) => void;
    // })
    () => {
      return {
        sendCode: async ({ email }: { email: string }) => {
          const _res = await supabaseSignInWithOtp({ email });
          console.log(_res);
        },
        loginWithCode: async ({
          code,
          email,
        }: {
          code: string;
          email: string;
        }) => {
          const _res = await supabaseVerifyOtp({ email, otp: code });
          console.log(_res);
        },
      };
    },
    [supabaseSignInWithOtp, supabaseVerifyOtp],
  );

  return useMemo(() => {
    return {
      ...methods,
      toOneKeyIdPage,
      loginOneKeyId,
      loginOneKeyIdWithLegacyEmail,
      sendEmailOTP,
      useLoginWithEmail,
    };
  }, [
    methods,
    sendEmailOTP,
    loginOneKeyId,
    loginOneKeyIdWithLegacyEmail,
    toOneKeyIdPage,
    useLoginWithEmail,
  ]);
}

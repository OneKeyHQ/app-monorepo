import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Dialog, Spinner, Stack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { LazyLoadPage } from '@onekeyhq/kit/src/components/LazyLoadPage';
import { useSupabaseAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/supabase/useSupabaseAuth';
import { usePrimePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { EPrimeEmailOTPScene } from '@onekeyhq/shared/src/consts/primeConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EPrimePages } from '@onekeyhq/shared/src/routes/prime';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IPrimeUserInfo } from '@onekeyhq/shared/types/prime/primeTypes';

import useAppNavigation from '../../hooks/useAppNavigation';

import { getSupabaseClient } from './supabase/getSupabaseClient';

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
    import(
      '@onekeyhq/kit/src/views/Prime/components/PrimeLoginEmailDialogV2/PrimeLoginEmailDialogV2'
    ),
  0,
  true,
  <Stack>
    <Spinner size="large" />
  </Stack>,
);

export function useOneKeyAuth() {
  const [user] = usePrimePersistAtom();
  const intl = useIntl();
  const navigation = useAppNavigation();

  const {
    signOut: supabaseSignOut,
    getAccessToken,
    isReady,
    isLoggedIn: isSupabaseLoggedIn,
    supabaseUser,
    signInWithOtp: supabaseSignInWithOtp,
    verifyOtp: supabaseVerifyOtp,
  } = useSupabaseAuth();

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
          // return res;
        },
      };
    },
    [supabaseSignInWithOtp, supabaseVerifyOtp],
  );

  const apiLogout = useCallback(async () => {
    await backgroundApiProxy.servicePrime.apiLogout();
  }, []);

  const logout: () => Promise<void> = useCallback(async () => {
    try {
      await apiLogout();
    } finally {
      await supabaseSignOut();
    }
  }, [apiLogout, supabaseSignOut]);

  const sendEmailOTP = useCallback(
    async ({
      onConfirm,
      scene,
      description,
    }: {
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
          renderContent: (
            <EmailOTPDialog
              title={intl.formatMessage({
                id: ETranslations.prime_enter_verification_code,
              })}
              description={
                description?.({ userInfo }) ||
                intl.formatMessage(
                  { id: ETranslations.prime_sent_to },
                  { email: userInfo.displayEmail ?? '' },
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

  const toOneKeyIdPage = useCallback(() => {
    navigation.pushModal(EModalRoutes.PrimeModal, {
      screen: EPrimePages.OneKeyId,
    });
  }, [navigation]);

  const loginOneKeyId = useCallback(
    async ({
      toOneKeyIdPageOnLoginSuccess,
    }: {
      toOneKeyIdPageOnLoginSuccess?: boolean;
    } = {}) => {
      const isLoggedIn = await backgroundApiProxy.servicePrime.isLoggedIn();
      const onLoginSuccess = async () => {
        if (toOneKeyIdPageOnLoginSuccess) {
          await timerUtils.wait(120);
          toOneKeyIdPage();
        }
      };
      if (isLoggedIn) {
        await onLoginSuccess();
      } else {
        defaultLogger.prime.subscription.onekeyIdLogout({
          reason:
            'useLoginOneKeyId.loginOneKeyId(): call logout() before showing login dialog',
        });
        // logout before login, make sure local supabase storage cache is cleared
        void logout();

        // 跳转到登录页面
        const loginDialog = Dialog.show({
          renderContent: (
            <PrimeLoginEmailDialogV2
              title={intl.formatMessage({
                id: ETranslations.prime_signup_login,
              })}
              description={intl.formatMessage({
                id: ETranslations.prime_onekeyid_continue_description,
              })}
              onComplete={() => {
                void loginDialog.close();
              }}
              onLoginSuccess={onLoginSuccess}
            />
          ),
        });
      }
    },
    [intl, logout, toOneKeyIdPage],
  );

  return useMemo(() => {
    return {
      isLoggedIn: user?.isLoggedIn && user?.isLoggedInOnServer,
      isPrimeSubscriptionActive: user?.primeSubscription?.isActive,
      user,
      logout,
      // apiLogout,
      // sdkLogout,
      getAccessToken,
      isReady,
      isSupabaseLoggedIn,
      useLoginWithEmail,
      getSupabaseClient,
      supabaseUser,
      supabaseSignInWithOtp,
      supabaseVerifyOtp,
      supabaseSignOut,
      sendEmailOTP,
      loginOneKeyId,
      toOneKeyIdPage,
    };
  }, [
    getAccessToken,
    isReady,
    isSupabaseLoggedIn,
    logout,
    user,
    useLoginWithEmail,
    supabaseUser,
    supabaseSignInWithOtp,
    supabaseVerifyOtp,
    supabaseSignOut,
    sendEmailOTP,
    loginOneKeyId,
    toOneKeyIdPage,
  ]);
}

import type { ReactNode } from 'react';
import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Dialog, Spinner, Stack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { LazyLoadPage } from '@onekeyhq/kit/src/components/LazyLoadPage';
import { useSupabaseAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/supabase/useSupabaseAuth';
import { usePrimePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/prime';
import { EExtOneKeyIdAuthFlow } from '@onekeyhq/shared/src/consts/authConsts';
import type { EPrimeEmailOTPScene } from '@onekeyhq/shared/src/consts/primeConsts';
import { PrimeLoginDialogCancelError } from '@onekeyhq/shared/src/errors';
import { toPlainErrorObject } from '@onekeyhq/shared/src/errors/utils/errorUtils';
import {
  EOneKeyIdLoginWithLocalKeylessPrepareStatus,
  type IOneKeyIdLoginWithLocalKeylessPrepareResult,
} from '@onekeyhq/shared/src/keylessWallet/keylessWalletTypes';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EPrimePages } from '@onekeyhq/shared/src/routes/prime';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IPrimeUserInfo } from '@onekeyhq/shared/types/prime/primeTypes';

import useAppNavigation from '../../hooks/useAppNavigation';

import {
  redirectOneKeyIdAuthToExtExpandTab,
  shouldRunOneKeyIdAuthInExtExpandTab,
} from './extOneKeyIdAuthExpandTab';
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
    getAccessToken,
    isReady,
    isLoggedIn: isSupabaseLoggedIn,
    supabaseUser,
    signInWithOtp: supabaseSignInWithOtp,
    verifyOtp: supabaseVerifyOtp,
    getSupabaseClient,
  } = useSupabaseAuth();

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
      getAccessToken,
      isReady,
      isSupabaseLoggedIn,
      getSupabaseClient,
      supabaseUser,
      supabaseSignInWithOtp,
      supabaseVerifyOtp,
      signInWithSocialLogin,
      persistKeylessOAuthSession,
    };
  }, [
    getAccessToken,
    isReady,
    isSupabaseLoggedIn,
    user,
    supabaseUser,
    supabaseSignInWithOtp,
    supabaseVerifyOtp,
    signInWithSocialLogin,
    persistKeylessOAuthSession,
    getSupabaseClient,
  ]);
}

export function useOneKeyAuth() {
  const navigation = useAppNavigation();
  const intl = useIntl();

  const methods = useOneKeyAuthMethods();
  const { supabaseSignInWithOtp, supabaseVerifyOtp } = methods;

  const toOneKeyIdPage = useCallback(() => {
    navigation.pushModal(EModalRoutes.PrimeModal, {
      screen: EPrimePages.OneKeyId,
    });
  }, [navigation]);

  const showOneKeyIdLoginDialog = useCallback(
    async ({
      toOneKeyIdPageOnLoginSuccess,
      renderContent,
    }: {
      toOneKeyIdPageOnLoginSuccess?: boolean;
      renderContent: (params: {
        onComplete: () => Promise<void>;
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

      // The extension action popup dies on focus loss, which destroys the
      // pending launchWebAuthFlow OAuth flow (see extOneKeyIdAuthExpandTab).
      // Hand the whole login flow off to the expand tab before touching any
      // local auth state, and settle this call as a user cancel.
      if (shouldRunOneKeyIdAuthInExtExpandTab()) {
        await redirectOneKeyIdAuthToExtExpandTab({
          flow: EExtOneKeyIdAuthFlow.Login,
          toOneKeyIdPageOnLoginSuccess,
        });
        throw new PrimeLoginDialogCancelError();
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
            onComplete: async () => {
              isClosedByNextStep = true;
              try {
                await loginDialog.close();
              } catch (error) {
                // The close handoff owns settling the outer login promise.
                // A failed close must not leave it pending forever.
                onCancelFn();
                throw error;
              }
            },
            onLoginSuccess: onLoginSuccessFn,
            onCancel: onCancelFn,
          }),
        });
      });
    },
    [toOneKeyIdPage],
  );

  const loginOneKeyId = useCallback(
    async ({
      toOneKeyIdPageOnLoginSuccess,
    }: {
      toOneKeyIdPageOnLoginSuccess?: boolean;
    } = {}) => {
      let localKeylessLoginPrepareResult: IOneKeyIdLoginWithLocalKeylessPrepareResult;
      let localKeylessLoginPrepareErrorMessage: string | undefined;
      try {
        localKeylessLoginPrepareResult =
          await backgroundApiProxy.serviceKeylessWallet.prepareOneKeyIdLoginWithLocalKeyless();
      } catch (error) {
        const plainErrorMessage =
          typeof error === 'string' ? error : toPlainErrorObject(error).message;
        localKeylessLoginPrepareErrorMessage =
          typeof plainErrorMessage === 'string' && plainErrorMessage
            ? plainErrorMessage
            : 'Unknown Keyless wallet data read error';
        // Keep the read failure distinct from a definitive no-wallet result.
        // OAuth clicks retry the probe and can offer confirmed Keyless removal
        // once the wallet row is readable again.
        console.error(
          'useOneKeyAuth.loginOneKeyId: prepareOneKeyIdLoginWithLocalKeyless failed, preserving local Keyless auth:',
          localKeylessLoginPrepareErrorMessage,
        );
        localKeylessLoginPrepareResult = {
          status:
            EOneKeyIdLoginWithLocalKeylessPrepareStatus.LocalKeylessDataUnavailable,
          errorMessage: localKeylessLoginPrepareErrorMessage,
        };
      }
      return showOneKeyIdLoginDialog({
        toOneKeyIdPageOnLoginSuccess,
        renderContent: ({ onComplete, onLoginSuccess, onCancel }) => (
          <PrimeLoginOAuthDialog
            onComplete={onComplete}
            onLoginSuccess={onLoginSuccess}
            onCancel={onCancel}
            localKeylessLoginPrepareResult={localKeylessLoginPrepareResult}
            localKeylessLoginPrepareErrorMessage={
              localKeylessLoginPrepareErrorMessage
            }
            toOneKeyIdPageOnLoginSuccess={toOneKeyIdPageOnLoginSuccess}
          />
        ),
      });
    },
    [showOneKeyIdLoginDialog],
  );

  const loginOneKeyIdWithLegacyEmail = useCallback(
    async ({
      toOneKeyIdPageOnLoginSuccess,
      isSignUpMode,
    }: {
      toOneKeyIdPageOnLoginSuccess?: boolean;
      isSignUpMode?: boolean;
    } = {}) =>
      showOneKeyIdLoginDialog({
        toOneKeyIdPageOnLoginSuccess,
        renderContent: ({ onComplete, onLoginSuccess, onCancel }) => (
          <PrimeLoginEmailDialogV2
            onComplete={onComplete}
            onLoginSuccess={onLoginSuccess}
            onCancel={onCancel}
            initialSignUpMode={isSignUpMode}
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
          await supabaseSignInWithOtp({ email });
        },
        loginWithCode: async ({
          code,
          email,
        }: {
          code: string;
          email: string;
        }) => {
          // Never log the response: verifyOtp resolves with a full
          // AuthResponse whose session carries the access + refresh tokens.
          await supabaseVerifyOtp({ email, otp: code });
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

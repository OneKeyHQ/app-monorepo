import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Dialog } from '@onekeyhq/components';
import { LazyLoadPage } from '@onekeyhq/kit/src/components/LazyLoadPage';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EModalReferFriendsRoutes,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';
import { usePrimeAuthV2 } from '../views/Prime/hooks/usePrimeAuthV2';

const PrimeLoginEmailDialogV2 = LazyLoadPage(
  () =>
    import(
      '@onekeyhq/kit/src/views/Prime/components/PrimeLoginEmailDialogV2/PrimeLoginEmailDialogV2'
    ),
  0,
  true,
);

export const useLoginOneKeyId = () => {
  const intl = useIntl();
  const navigation = useAppNavigation();

  const { logout } = usePrimeAuthV2();

  const toOneKeyIdPage = useCallback(() => {
    navigation.pushModal(EModalRoutes.ReferFriendsModal, {
      screen: EModalReferFriendsRoutes.OneKeyId,
    });
  }, [navigation]);

  const verifyOneKeyId = useCallback(async () => {
    return new Promise<string>((resolve) => {
      const loginDialog = Dialog.show({
        renderContent: (
          <PrimeLoginEmailDialogV2
            title="Check Email"
            description="Check Email by OTP Code"
            onComplete={() => {
              void loginDialog.close();
            }}
            onConfirm={async (code: string) => {
              await timerUtils.wait(120);
              resolve(code);
            }}
          />
        ),
      });
    });
  }, []);

  const loginOneKeyId = useCallback(
    async ({
      toOneKeyIdPageOnLoginSuccess,
    }: {
      toOneKeyIdPageOnLoginSuccess?: boolean;
    } = {}) => {
      const isLoggedIn = await backgroundApiProxy.servicePrime.isLoggedIn();
      if (isLoggedIn && toOneKeyIdPageOnLoginSuccess) {
        toOneKeyIdPage();
      } else {
        // logout before login, make sure local privy cache is cleared
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
              onLoginSuccess={async () => {
                if (toOneKeyIdPageOnLoginSuccess) {
                  await timerUtils.wait(120);
                  toOneKeyIdPage();
                }
              }}
            />
          ),
        });
      }
    },
    [intl, logout, toOneKeyIdPage],
  );
  return useMemo(
    () => ({ verifyOneKeyId, loginOneKeyId }),
    [loginOneKeyId, verifyOneKeyId],
  );
};

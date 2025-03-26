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

import backgroundApiProxy from '../background/instance/backgroundApiProxy';

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

  const toOneKeyIdPage = useCallback(() => {
    navigation.pushModal(EModalRoutes.ReferFriendsModal, {
      screen: EModalReferFriendsRoutes.OneKeyId,
    });
  }, [navigation]);

  const loginOneKeyId = useCallback(async () => {
    const isLoggedIn = await backgroundApiProxy.servicePrime.isLoggedIn();
    if (isLoggedIn) {
      toOneKeyIdPage();
    } else {
      // 跳转到登录页面
      const loginDialog = Dialog.show({
        renderContent: (
          <PrimeLoginEmailDialogV2
            title={intl.formatMessage({ id: ETranslations.prime_signup_login })}
            description={intl.formatMessage({
              id: ETranslations.prime_onekeyid_continue_description,
            })}
            onComplete={() => {
              void loginDialog.close();
            }}
            onLoginSuccess={() => {
              setTimeout(() => {
                toOneKeyIdPage();
              }, 120);
            }}
          />
        ),
      });
    }
  }, [intl, toOneKeyIdPage]);
  return useMemo(() => ({ loginOneKeyId }), [loginOneKeyId]);
};

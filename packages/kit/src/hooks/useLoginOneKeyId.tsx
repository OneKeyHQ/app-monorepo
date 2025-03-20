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
  const { isLoggedIn } = usePrimeAuthV2();
  const intl = useIntl();
  const navigation = useAppNavigation();

  const toOneKeyIdPage = useCallback(() => {
    navigation.pushModal(EModalRoutes.ReferFriendsModal, {
      screen: EModalReferFriendsRoutes.OneKeyId,
    });
  }, [navigation]);

  const loginOneKeyId = useCallback(() => {
    if (isLoggedIn) {
      toOneKeyIdPage();
    } else {
      // 跳转到登录页面
      const loginDialog = Dialog.show({
        renderContent: (
          <PrimeLoginEmailDialogV2
            title={intl.formatMessage({ id: ETranslations.prime_signup_login })}
            description="OneKey ID is all you need to access all OneKey services and earn referral rewards."
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
  }, [intl, isLoggedIn, toOneKeyIdPage]);
  return useMemo(() => ({ loginOneKeyId }), [loginOneKeyId]);
};

import {
  ManagerWalletModalRoutes,
  ModalRoutes,
  RootRoutes,
} from '@onekeyhq/kit/src/routes/routesEnum';

import useAppNavigation from './useAppNavigation';

import type { ValidationFields } from '../components/Protected';

export default function useLocalAuthenticationModal() {
  const navigation = useAppNavigation();

  const showVerify = (
    onSuccess: (password: string, requestId: string) => void,
    onCancel: () => void,
    requestId?: string | null,
    field?: ValidationFields,
    walletId?: string,
  ) => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.ManagerWallet,
      params: {
        screen: ManagerWalletModalRoutes.ManagerWalletAuthorityVerifyModal,
        params: {
          field,
          requestId: requestId ?? '',
          onSuccess,
          onCancel,
          walletId,
        },
      },
    });
  };

  return { showVerify };
}

import { useNavigation } from '@react-navigation/core';

import { ManagerWalletModalRoutes } from '@onekeyhq/kit/src/routes/Modal/ManagerWallet';
import { ModalRoutes, RootRoutes } from '@onekeyhq/kit/src/routes/types';

export default function useLocalAuthenticationModal() {
  const navigation = useNavigation();

  const showVerify = (
    onSuccess: (password: string, requestId: string) => void,
    onCancel: () => void,
    requestId?: string | null,
  ) => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.ManagerWallet,
      params: {
        screen: ManagerWalletModalRoutes.ManagerWalletAuthorityVerifyModal,
        params: {
          requestId: requestId ?? '',
          onSuccess,
          onCancel,
        },
      },
    });
  };

  return { showVerify };
}

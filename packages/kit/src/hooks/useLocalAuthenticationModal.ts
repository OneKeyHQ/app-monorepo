import { useNavigation } from '@react-navigation/core';

import { ManagerWalletModalRoutes } from '@onekeyhq/kit/src/routes/Modal/ManagerWallet';
import { ModalRoutes, RootRoutes } from '@onekeyhq/kit/src/routes/types';

export default function useLocalAuthenticationModal() {
  const navigation = useNavigation();

  const showVerify = (
    requestId: string,
    onSuccess: (requestId: string, password: string) => void,
    onCancel: () => void,
  ) => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.ManagerWallet,
      params: {
        screen: ManagerWalletModalRoutes.ManagerWalletAuthorityVerifyModal,
        params: {
          requestId,
          onSuccess,
          onCancel,
        },
      },
    });
  };

  return { showVerify };
}

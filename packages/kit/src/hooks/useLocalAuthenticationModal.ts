import { useManegerWalletLocalValidation } from './useProtectedVerify';

import type { ValidationFields } from '../components/Protected';

export default function useLocalAuthenticationModal() {
  const managerWalletLocalValidation = useManegerWalletLocalValidation();
  const showVerify = (
    onSuccess: (password: string, requestId: string) => void,
    onCancel: () => void,
    requestId?: string | null,
    field?: ValidationFields,
    // walletId?: string,
  ) => {
    managerWalletLocalValidation({ requestId, field, onSuccess, onCancel });
    // navigation.navigate(RootRoutes.Modal, {
    //   screen: ModalRoutes.ManagerWallet,
    //   params: {
    //     screen: ManagerWalletModalRoutes.ManagerWalletAuthorityVerifyModal,
    //     params: {
    //       field,
    //       requestId: requestId ?? '',
    //       onSuccess,
    //       onCancel,
    //       walletId,
    //     },
    //   },
    // });
  };

  return { showVerify };
}

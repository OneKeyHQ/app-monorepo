import { useCallback } from 'react';

import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';
import {
  EModalAssetListRoutes,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';

function useManageToken({
  accountId,
  networkId,
  walletId,
  isOthersWallet,
  indexedAccountId,
  deriveType,
}: {
  accountId: string;
  networkId: string;
  walletId: string;
  isOthersWallet?: boolean;
  indexedAccountId?: string;
  deriveType: IAccountDeriveTypes;
}) {
  const navigation = useAppNavigation();

  const handleOnManageToken = useCallback(() => {
    navigation.pushModal(EModalRoutes.MainModal, {
      screen: EModalAssetListRoutes.TokenManagerModal,
      params: {
        walletId,
        isOthersWallet,
        indexedAccountId,
        networkId,
        accountId,
        deriveType,
      },
    });
  }, [
    navigation,
    walletId,
    isOthersWallet,
    indexedAccountId,
    networkId,
    accountId,
    deriveType,
  ]);

  return {
    handleOnManageToken,
  };
}

export { useManageToken };
